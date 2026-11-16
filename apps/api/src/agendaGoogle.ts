/**
 * Integração com o Google Agenda: conexão, preferências e o worker que esvazia a fila
 * de saída (preenchida por triggers; ver a migração 0013).
 *
 * Na versão local tudo é SIMULADO: o `adaptadorSimulado` responde como o Google, mas
 * nada sai da máquina. Na Fase 6.6 entra um adaptador que chama a Calendar API com o
 * refresh token (cifrado com Cloud KMS), sem mudar o resto.
 */
import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  eventoDaSessao,
  eventoDoCompromisso,
  FUSO_CONSULTORIO,
  type Contexto,
  type EventoGoogle,
  type TituloSessao,
} from "@consultorio/shared";
import type { Db } from "./db/conexao";
import * as t from "./db/schema";
import { ErroDominio, listarCompromissos, listarSessoes } from "./servico";

export interface AdaptadorGoogle {
  criar(calendarioId: string, evento: EventoGoogle): Promise<{ id: string; etag: string }>;
  atualizar(calendarioId: string, id: string, evento: EventoGoogle): Promise<{ etag: string }>;
  apagar(calendarioId: string, id: string): Promise<void>;
}

/** Responde como a Calendar API, sem rede. */
export function adaptadorSimulado(): AdaptadorGoogle {
  return {
    criar: async () => ({ id: `sim_${randomUUID().replaceAll("-", "").slice(0, 20)}`, etag: "1" }),
    atualizar: async () => ({ etag: String(Date.now()) }),
    apagar: async () => {},
  };
}

/** Agendas que a pessoa pode escolher (simulado: a do app ou a principal). */
export const CALENDARIOS_SIMULADOS = [
  { id: "consultorio", nome: "Consultório (criada pelo app)" },
  { id: "primary", nome: "Agenda principal" },
];

export interface EstadoIntegracao {
  conectada: boolean;
  simulada?: boolean;
  email?: string;
  calendarioId?: string;
  calendarioNome?: string;
  tituloSessao?: TituloSessao;
  ultimoSyncEm?: string | null;
  erro?: string | null;
  pendentes?: number;
  sincronizados?: number;
}

function integracao(db: Db, ctx: Contexto) {
  return db
    .select()
    .from(t.integracoesGoogle)
    .where(and(eq(t.integracoesGoogle.consultorioId, ctx.consultorioId), eq(t.integracoesGoogle.usuarioId, ctx.usuarioId)))
    .get();
}

export function estadoIntegracao(db: Db, ctx: Contexto): EstadoIntegracao {
  const i = integracao(db, ctx);
  if (!i) return { conectada: false };
  const pendentes = db.select({ n: sql<number>`count(distinct ${t.filaSaida.origem} || ${t.filaSaida.origemId})` }).from(t.filaSaida).where(isNull(t.filaSaida.processadoEm)).get()!.n;
  const sincronizados = db.select({ n: sql<number>`count(*)` }).from(t.eventosAgenda).where(eq(t.eventosAgenda.integracaoId, i.id)).get()!.n;
  return {
    conectada: true,
    simulada: i.simulada,
    email: i.emailGoogle,
    calendarioId: i.calendarioId,
    calendarioNome: i.calendarioNome,
    tituloSessao: i.tituloSessao,
    ultimoSyncEm: i.ultimoSyncEm,
    erro: i.erro,
    pendentes,
    sincronizados,
  };
}

/** Põe na fila tudo o que deve estar no Google: sessões de 30 dias atrás em diante e compromissos. */
function enfileirarTudo(db: Db, agora: Date) {
  const desde = new Date(agora.getTime() - 30 * 86_400_000).toISOString();
  db.run(sql`insert into ${t.filaSaida} (origem, origem_id) select 'sessao', id from ${t.sessoes} where inicio >= ${desde}`);
  db.run(sql`insert into ${t.filaSaida} (origem, origem_id) select 'compromisso', id from ${t.compromissos}`);
}

/** Conecta (simulado: sem OAuth; na 6.6, recebe o código do OAuth e guarda o token cifrado). */
export function conectar(db: Db, ctx: Contexto, agora: Date, email = "conta.google@exemplo.com") {
  if (integracao(db, ctx)) throw new ErroDominio(409, "O Google Agenda já está conectado.");
  const cal = CALENDARIOS_SIMULADOS[0]!;
  db.transaction((tx) => {
    tx.insert(t.integracoesGoogle)
      .values({ id: `ig_${randomUUID().slice(0, 8)}`, consultorioId: ctx.consultorioId, usuarioId: ctx.usuarioId, emailGoogle: email, calendarioId: cal.id, calendarioNome: cal.nome, simulada: true })
      .run();
    enfileirarTudo(tx as unknown as Db, agora);
  });
}

export function configurar(db: Db, ctx: Contexto, e: { tituloSessao?: TituloSessao; calendarioId?: string }, agora: Date) {
  const i = integracao(db, ctx);
  if (!i) throw new ErroDominio(409, "Conecte o Google Agenda primeiro.");
  const cal = e.calendarioId ? CALENDARIOS_SIMULADOS.find((c) => c.id === e.calendarioId) : undefined;
  if (e.calendarioId && !cal) throw new ErroDominio(400, "Agenda não encontrada.");
  db.transaction((tx) => {
    tx.update(t.integracoesGoogle)
      .set({ ...(e.tituloSessao ? { tituloSessao: e.tituloSessao } : {}), ...(cal ? { calendarioId: cal.id, calendarioNome: cal.nome } : {}) })
      .where(eq(t.integracoesGoogle.id, i.id))
      .run();
    // Título ou agenda mudaram: tudo é reenviado. Trocar de agenda recria os eventos.
    if (cal && cal.id !== i.calendarioId) tx.delete(t.eventosAgenda).where(eq(t.eventosAgenda.integracaoId, i.id)).run();
    enfileirarTudo(tx as unknown as Db, agora);
  });
}

/**
 * Esvazia a fila: para cada sessão/compromisso que mudou, cria, atualiza ou apaga o
 * evento. Itens repetidos contam uma vez. Falha num item não para os outros (ele fica
 * na fila, com a tentativa anotada).
 */
export async function processarFila(db: Db, ctx: Contexto, adaptador: AdaptadorGoogle, agora: Date, limite = 500): Promise<{ enviados: number; falhas: number }> {
  const i = integracao(db, ctx);
  if (!i) return { enviados: 0, falhas: 0 };
  const pendentes = db.select().from(t.filaSaida).where(isNull(t.filaSaida.processadoEm)).orderBy(asc(t.filaSaida.id)).limit(limite).all();
  const unicos = new Map<string, { origem: "sessao" | "compromisso"; origemId: string; ids: number[] }>();
  for (const p of pendentes) {
    const k = `${p.origem}:${p.origemId}`;
    const u = unicos.get(k) ?? { origem: p.origem, origemId: p.origemId, ids: [] };
    u.ids.push(p.id);
    unicos.set(k, u);
  }
  const apelidos = new Map(db.select({ id: t.pacientes.id, apelido: t.pacientes.apelido }).from(t.pacientes).all().map((p) => [p.id, { apelido: p.apelido }]));
  const sessoes = new Map(listarSessoes(db).map((s) => [s.id, s]));
  const compromissos = new Map(listarCompromissos(db).map((c) => [c.id, c]));
  let enviados = 0;
  let falhas = 0;
  let ultimoErro: string | null = null;

  for (const u of unicos.values()) {
    try {
      let evento: EventoGoogle | null = null;
      if (u.origem === "sessao") {
        const s = sessoes.get(u.origemId);
        evento = s ? eventoDaSessao(s, apelidos.get(s.pacienteId), { titulo: i.tituloSessao, fuso: FUSO_CONSULTORIO }) : null;
      } else {
        const c = compromissos.get(u.origemId);
        evento = c ? eventoDoCompromisso(c) : null;
      }
      const ligado = db
        .select()
        .from(t.eventosAgenda)
        .where(and(eq(t.eventosAgenda.integracaoId, i.id), eq(t.eventosAgenda.origem, u.origem), eq(t.eventosAgenda.origemId, u.origemId)))
        .get();
      const chave = and(eq(t.eventosAgenda.integracaoId, i.id), eq(t.eventosAgenda.origem, u.origem), eq(t.eventosAgenda.origemId, u.origemId));
      if (!evento) {
        if (ligado) {
          await adaptador.apagar(i.calendarioId, ligado.googleEventoId);
          db.delete(t.eventosAgenda).where(chave).run();
        }
      } else if (ligado) {
        const r = await adaptador.atualizar(i.calendarioId, ligado.googleEventoId, evento);
        db.update(t.eventosAgenda).set({ etag: r.etag, sincronizadoEm: agora.toISOString() }).where(chave).run();
      } else {
        const r = await adaptador.criar(i.calendarioId, evento);
        db.insert(t.eventosAgenda)
          .values({ integracaoId: i.id, origem: u.origem, origemId: u.origemId, googleEventoId: r.id, etag: r.etag, sincronizadoEm: agora.toISOString() })
          .run();
      }
      db.update(t.filaSaida).set({ processadoEm: agora.toISOString() }).where(inArray(t.filaSaida.id, u.ids)).run();
      enviados++;
    } catch (e) {
      falhas++;
      ultimoErro = e instanceof Error ? e.message : "Falha ao falar com o Google";
      db.update(t.filaSaida)
        .set({ tentativas: sql`${t.filaSaida.tentativas} + 1`, erro: ultimoErro })
        .where(inArray(t.filaSaida.id, u.ids))
        .run();
    }
  }
  db.update(t.integracoesGoogle).set({ ultimoSyncEm: agora.toISOString(), erro: ultimoErro }).where(eq(t.integracoesGoogle.id, i.id)).run();
  // Itens já enviados há mais de 7 dias saem da fila.
  db.delete(t.filaSaida).where(sql`${t.filaSaida.processadoEm} < ${new Date(agora.getTime() - 7 * 86_400_000).toISOString()}`).run();
  return { enviados, falhas };
}

/** Desconecta; se pedido, apaga do Google os eventos criados pelo app. */
export async function desconectar(db: Db, ctx: Contexto, adaptador: AdaptadorGoogle, apagarEventos: boolean): Promise<{ apagados: number }> {
  const i = integracao(db, ctx);
  if (!i) return { apagados: 0 };
  let apagados = 0;
  if (apagarEventos) {
    for (const e of db.select().from(t.eventosAgenda).where(eq(t.eventosAgenda.integracaoId, i.id)).all()) {
      await adaptador.apagar(i.calendarioId, e.googleEventoId);
      apagados++;
    }
  }
  db.transaction((tx) => {
    tx.delete(t.integracoesGoogle).where(eq(t.integracoesGoogle.id, i.id)).run();
    tx.delete(t.filaSaida).run();
  });
  return { apagados };
}
