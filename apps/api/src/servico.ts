/**
 * Regras do consultório sobre o banco. Tudo síncrono (better-sqlite3) e, quando
 * mexe em mais de uma tabela, dentro de transação.
 *
 * SIGILO: nada aqui loga dados de pacientes.
 */
import { randomUUID } from "node:crypto";
import { and, asc, eq, gt, inArray, isNotNull, isNull, notInArray, sql } from "drizzle-orm";
import {
  FUSO_CONSULTORIO,
  MOEDAS,
  chaveDiaNoFuso,
  dinheiro,
  sessaoCobravel,
  type Conta,
  type ContratoEntrada,
  type Contrato,
  type FeriadoEntrada,
  type Moeda,
  type PacienteEntrada,
  type Paciente,
  type PacoteConsultorio,
  type Pagamento,
  type PagamentoEntrada,
  type Sessao,
  type SessaoAvulsa,
  type SessaoPatch,
} from "@consultorio/shared";
import type { Db } from "./db/conexao";
import * as t from "./db/schema";
import { gerarVagas, somarDias } from "./dominio/grade";

export class ErroDominio extends Error {
  constructor(
    public status: 400 | 404 | 409,
    mensagem: string,
  ) {
    super(mensagem);
  }
}

/** Quantas semanas à frente a grade fica gerada. */
export const SEMANAS_GERADAS = 8;

export const novoId = (prefixo: string) => `${prefixo}_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
export const hojeCivil = (agora: Date) => chaveDiaNoFuso(agora.getTime(), FUSO_CONSULTORIO);

function existe<T>(v: T | undefined, msg: string): T {
  if (v === undefined) throw new ErroDominio(404, msg);
  return v;
}

// ── Leitura ──────────────────────────────────────────────────

function paraPaciente(r: typeof t.pacientes.$inferSelect): Paciente {
  return {
    id: r.id,
    nome: r.nome,
    apelido: r.apelido,
    ...(r.contato ? { contato: r.contato } : {}),
    origem: r.origem,
    modalidade: r.modalidade,
    status: r.status,
    inicioEm: r.inicioEm,
    fuso: r.fuso,
    pontosFixos: r.pontosFixos,
    arquivadoEm: r.arquivadoEm,
  };
}

function paraContrato(r: typeof t.contratos.$inferSelect): Contrato {
  return {
    id: r.id,
    pacienteId: r.pacienteId,
    frequencia: r.diasSemana.length,
    diasSemana: r.diasSemana,
    horario: r.horario,
    duracaoMin: r.duracaoMin,
    valor: dinheiro(r.valorCentavos, r.moeda),
    cobranca: r.cobranca,
    politicaFaltas: r.politicaFaltas,
    vigenteDe: r.vigenteDe,
    vigenteAte: r.vigenteAte,
  };
}

export function carregarConsultorio(db: Db, agora: Date): PacoteConsultorio {
  const pagos = new Map(db.select().from(t.pagamentoSessoes).all().map((v) => [v.sessaoId, v.pagamentoId]));
  const sessoes: Sessao[] = db
    .select()
    .from(t.sessoes)
    .orderBy(asc(t.sessoes.inicio))
    .all()
    .map((s) => ({
      id: s.id,
      pacienteId: s.pacienteId,
      inicio: s.inicio,
      duracaoMin: s.duracaoMin,
      estado: s.estado,
      valor: dinheiro(s.valorCentavos, s.moeda),
      pago: pagos.has(s.id),
    }));
  const sessoesPorPagamento = new Map<string, string[]>();
  for (const [sessaoId, pagamentoId] of pagos) sessoesPorPagamento.set(pagamentoId, [...(sessoesPorPagamento.get(pagamentoId) ?? []), sessaoId]);
  const pagamentos: Pagamento[] = db
    .select()
    .from(t.pagamentos)
    .orderBy(asc(t.pagamentos.data))
    .all()
    .map((p) => ({
      id: p.id,
      pacienteId: p.pacienteId,
      sessaoIds: sessoesPorPagamento.get(p.id) ?? [],
      valor: dinheiro(p.valorCentavos, p.moeda),
      data: p.data,
      meio: p.meio,
      contaId: p.contaId,
    }));
  return {
    agora: agora.toISOString(),
    pacientes: db.select().from(t.pacientes).orderBy(asc(t.pacientes.nome)).all().map(paraPaciente),
    contratos: db.select().from(t.contratos).orderBy(asc(t.contratos.vigenteDe)).all().map(paraContrato),
    sessoes,
    pagamentos,
    contas: db.select().from(t.contas).all() as Conta[],
    feriados: db.select().from(t.feriados).orderBy(asc(t.feriados.data)).all(),
    moedas: moedasAtivas(db),
  };
}

// ── Moedas ───────────────────────────────────────────────────

export function moedasAtivas(db: Db): Moeda[] {
  const v = db.select().from(t.metaSistema).where(eq(t.metaSistema.chave, "moedas_ativas")).get()?.valor;
  const lista = v ? (JSON.parse(v) as Moeda[]) : [];
  return MOEDAS.filter((m) => m === "BRL" || lista.includes(m));
}

export function definirMoedas(db: Db, moedas: Moeda[]) {
  const novas = MOEDAS.filter((m) => m === "BRL" || moedas.includes(m));
  const desligadas = MOEDAS.filter((m) => !novas.includes(m));
  if (desligadas.length) {
    const emUso = db
      .select({ moeda: t.contratos.moeda })
      .from(t.contratos)
      .where(and(inArray(t.contratos.moeda, desligadas), isNull(t.contratos.vigenteAte)))
      .get();
    if (emUso) throw new ErroDominio(409, `Há contrato vigente em ${emUso.moeda}. Altere o contrato antes de desligar a moeda.`);
  }
  const valor = JSON.stringify(novas);
  db.insert(t.metaSistema).values({ chave: "moedas_ativas", valor }).onConflictDoUpdate({ target: t.metaSistema.chave, set: { valor } }).run();
}

// ── Grade → sessões ─────────────────────────────────────────

/** Gera (sem duplicar) as sessões das próximas semanas para pacientes ativos. */
export function garantirSessoes(db: Db, agora: Date): number {
  const hoje = hojeCivil(agora);
  const ate = somarDias(hoje, SEMANAS_GERADAS * 7);
  const ativos = db
    .select({ id: t.pacientes.id })
    .from(t.pacientes)
    .where(and(eq(t.pacientes.status, "ativo"), isNull(t.pacientes.arquivadoEm)))
    .all()
    .map((p) => p.id);
  if (ativos.length === 0) return 0;
  const feriados = new Set(db.select({ data: t.feriados.data }).from(t.feriados).all().map((f) => f.data));
  const contratos = db.select().from(t.contratos).where(inArray(t.contratos.pacienteId, ativos)).all();
  let criadas = 0;
  db.transaction((tx) => {
    for (const k of contratos) {
      if (k.vigenteAte && k.vigenteAte < hoje) continue;
      const vagas = gerarVagas(
        { ...k, valor: dinheiro(k.valorCentavos, k.moeda) },
        { de: hoje, ate, feriados, fuso: FUSO_CONSULTORIO },
      );
      for (const v of vagas) {
        const r = tx
          .insert(t.sessoes)
          .values({
            id: novoId("s"),
            pacienteId: v.pacienteId,
            contratoId: v.contratoId,
            vaga: v.vaga,
            inicio: v.inicio,
            duracaoMin: v.duracaoMin,
            estado: "agendada",
            valorCentavos: v.valor.centavos,
            moeda: v.valor.moeda,
          })
          .onConflictDoNothing()
          .run();
        criadas += r.changes;
      }
    }
  });
  return criadas;
}

/** Sessões geradas pela grade, ainda agendadas e não pagas, que podem ser descartadas. */
function descartaveis() {
  return and(
    eq(t.sessoes.estado, "agendada"),
    isNotNull(t.sessoes.contratoId),
    notInArray(t.sessoes.id, sql`(select ${t.pagamentoSessoes.sessaoId} from ${t.pagamentoSessoes})`),
  );
}

function removerFuturas(db: Db, pacienteId: string, agora: Date) {
  db.delete(t.sessoes)
    .where(and(eq(t.sessoes.pacienteId, pacienteId), gt(t.sessoes.inicio, agora.toISOString()), descartaveis()))
    .run();
}

// ── Sessões ──────────────────────────────────────────────────

function contaPadrao(db: Db, moeda: Moeda): string {
  const contas = db
    .select()
    .from(t.contas)
    .where(and(eq(t.contas.moeda, moeda), eq(t.contas.ativa, true)))
    .all();
  const conta = contas.find((c) => c.tipo === "corrente") ?? contas[0];
  if (!conta) throw new ErroDominio(409, `Cadastre uma conta em ${moeda} (Configurações) para registrar pagamentos nessa moeda.`);
  return conta.id;
}

function desvincularPagamento(db: Db, sessaoId: string) {
  const v = db.select().from(t.pagamentoSessoes).where(eq(t.pagamentoSessoes.sessaoId, sessaoId)).get();
  if (!v) return;
  db.delete(t.pagamentoSessoes).where(eq(t.pagamentoSessoes.sessaoId, sessaoId)).run();
  // Pagamento que não quita mais nenhuma sessão some junto (era o "Pago" rápido).
  const restantes = db.select().from(t.pagamentoSessoes).where(eq(t.pagamentoSessoes.pagamentoId, v.pagamentoId)).all();
  if (restantes.length === 0) db.delete(t.pagamentos).where(eq(t.pagamentos.id, v.pagamentoId)).run();
}

export function atualizarSessao(db: Db, id: string, patch: SessaoPatch, agora: Date) {
  db.transaction((tx) => {
    const s = existe(tx.select().from(t.sessoes).where(eq(t.sessoes.id, id)).get(), "Sessão não encontrada");
    const estado = patch.estado ?? s.estado;
    const mudancas: Partial<typeof t.sessoes.$inferInsert> = {};
    if (patch.estado) mudancas.estado = patch.estado;
    if (patch.inicio) mudancas.inicio = new Date(patch.inicio).toISOString();
    if (Object.keys(mudancas).length) tx.update(t.sessoes).set(mudancas).where(eq(t.sessoes.id, id)).run();

    const vinculada = !!tx.select().from(t.pagamentoSessoes).where(eq(t.pagamentoSessoes.sessaoId, id)).get();
    const deveEstarPaga = sessaoCobravel(estado) && (patch.pago ?? vinculada);
    if (patch.pago && !sessaoCobravel(estado)) {
      throw new ErroDominio(409, "Só sessões realizadas ou faltas cobradas podem ser marcadas como pagas.");
    }
    if (vinculada && !deveEstarPaga) desvincularPagamento(tx as unknown as Db, id);
    if (!vinculada && deveEstarPaga) {
      const pagamentoId = novoId("pg");
      tx.insert(t.pagamentos)
        .values({
          id: pagamentoId,
          pacienteId: s.pacienteId,
          valorCentavos: s.valorCentavos,
          moeda: s.moeda,
          data: hojeCivil(agora),
          meio: s.moeda === "BRL" ? "pix" : "transferencia",
          contaId: contaPadrao(tx as unknown as Db, s.moeda),
        })
        .run();
      tx.insert(t.pagamentoSessoes).values({ pagamentoId, sessaoId: id }).run();
    }
  });
}

export function criarSessaoAvulsa(db: Db, e: SessaoAvulsa): string {
  existe(db.select().from(t.pacientes).where(eq(t.pacientes.id, e.pacienteId)).get(), "Paciente não encontrado");
  const id = novoId("s");
  db.insert(t.sessoes)
    .values({
      id,
      pacienteId: e.pacienteId,
      inicio: new Date(e.inicio).toISOString(),
      duracaoMin: e.duracaoMin,
      estado: "agendada",
      valorCentavos: e.valor.centavos,
      moeda: e.valor.moeda,
    })
    .run();
  return id;
}

// ── Pacientes ────────────────────────────────────────────────

export function criarPaciente(db: Db, e: PacienteEntrada): string {
  const id = novoId("p");
  db.insert(t.pacientes)
    .values({ id, ...e, contato: e.contato || null, pontosFixos: e.pontosFixos ?? "" })
    .run();
  return id;
}

export function atualizarPaciente(db: Db, id: string, e: Partial<PacienteEntrada>, agora: Date) {
  db.transaction((tx) => {
    const atual = existe(tx.select().from(t.pacientes).where(eq(t.pacientes.id, id)).get(), "Paciente não encontrado");
    const dados = { ...e, ...(e.contato !== undefined ? { contato: e.contato || null } : {}) };
    tx.update(t.pacientes).set(dados).where(eq(t.pacientes.id, id)).run();
    // Saiu de "ativo": as sessões futuras geradas pela grade deixam de existir.
    if (e.status && e.status !== "ativo" && atual.status === "ativo") removerFuturas(tx as unknown as Db, id, agora);
  });
  garantirSessoes(db, agora);
}

function exigirInterrompido(db: Db, id: string) {
  const p = existe(db.select().from(t.pacientes).where(eq(t.pacientes.id, id)).get(), "Paciente não encontrado");
  if (p.status !== "interrompido") {
    throw new ErroDominio(409, "Só pacientes com status “interrompido” podem ser arquivados ou excluídos.");
  }
  return p;
}

/** Padrão: arquiva (some das listas, prontuário fica guardado — CFP pede 5 anos). */
export function arquivarPaciente(db: Db, id: string, agora: Date) {
  exigirInterrompido(db, id);
  db.transaction((tx) => {
    tx.update(t.pacientes).set({ arquivadoEm: agora.toISOString() }).where(eq(t.pacientes.id, id)).run();
    removerFuturas(tx as unknown as Db, id, agora);
  });
}

export function desarquivarPaciente(db: Db, id: string) {
  existe(db.select().from(t.pacientes).where(eq(t.pacientes.id, id)).get(), "Paciente não encontrado");
  db.update(t.pacientes).set({ arquivadoEm: null }).where(eq(t.pacientes.id, id)).run();
}

/** Exclusão definitiva: apaga paciente, contratos, sessões, pagamentos (e notas). Sem volta. */
export function excluirPaciente(db: Db, id: string) {
  exigirInterrompido(db, id);
  db.delete(t.pacientes).where(eq(t.pacientes.id, id)).run();
}

// ── Contratos ────────────────────────────────────────────────

export function salvarContrato(db: Db, pacienteId: string, e: ContratoEntrada, agora: Date): string {
  const id = novoId("k");
  db.transaction((tx) => {
    existe(tx.select().from(t.pacientes).where(eq(t.pacientes.id, pacienteId)).get(), "Paciente não encontrado");
    const vigentes = tx
      .select()
      .from(t.contratos)
      .where(and(eq(t.contratos.pacienteId, pacienteId), sql`(${t.contratos.vigenteAte} is null or ${t.contratos.vigenteAte} >= ${e.vigenteDe})`))
      .all();
    for (const atual of vigentes) {
      // Agendadas a partir da nova vigência saem; o passado fica intacto.
      tx.delete(t.sessoes)
        .where(and(eq(t.sessoes.contratoId, atual.id), sql`substr(${t.sessoes.vaga}, 1, 10) >= ${e.vigenteDe}`, descartaveis()))
        .run();
      if (atual.vigenteDe >= e.vigenteDe) {
        const usadas = tx.select({ n: sql<number>`count(*)` }).from(t.sessoes).where(eq(t.sessoes.contratoId, atual.id)).get()!.n;
        if (usadas > 0) {
          throw new ErroDominio(409, `O contrato atual começou em ${atual.vigenteDe} e já tem sessões. A nova vigência precisa começar depois dessa data.`);
        }
        tx.delete(t.contratos).where(eq(t.contratos.id, atual.id)).run();
      } else {
        tx.update(t.contratos).set({ vigenteAte: somarDias(e.vigenteDe, -1) }).where(eq(t.contratos.id, atual.id)).run();
      }
    }
    tx.insert(t.contratos)
      .values({
        id,
        pacienteId,
        diasSemana: [...new Set(e.diasSemana)].sort((a, b) => a - b),
        horario: e.horario,
        duracaoMin: e.duracaoMin,
        valorCentavos: e.valor.centavos,
        moeda: e.valor.moeda,
        cobranca: e.cobranca,
        politicaFaltas: e.politicaFaltas ?? "",
        vigenteDe: e.vigenteDe,
      })
      .run();
  });
  garantirSessoes(db, agora);
  return id;
}

export function encerrarContrato(db: Db, id: string, ate: string) {
  db.transaction((tx) => {
    const k = existe(tx.select().from(t.contratos).where(eq(t.contratos.id, id)).get(), "Contrato não encontrado");
    if (ate < k.vigenteDe) throw new ErroDominio(400, "O fim não pode ser antes do início do contrato.");
    tx.update(t.contratos).set({ vigenteAte: ate }).where(eq(t.contratos.id, id)).run();
    tx.delete(t.sessoes)
      .where(and(eq(t.sessoes.contratoId, id), sql`substr(${t.sessoes.vaga}, 1, 10) > ${ate}`, descartaveis()))
      .run();
  });
}

// ── Pagamentos ───────────────────────────────────────────────

export function registrarPagamento(db: Db, e: PagamentoEntrada & { sessaoIds: string[] }): string {
  const id = novoId("pg");
  db.transaction((tx) => {
    existe(tx.select().from(t.pacientes).where(eq(t.pacientes.id, e.pacienteId)).get(), "Paciente não encontrado");
    const conta = existe(tx.select().from(t.contas).where(eq(t.contas.id, e.contaId)).get(), "Conta não encontrada");
    if (conta.moeda !== e.valor.moeda) throw new ErroDominio(400, `A conta escolhida é em ${conta.moeda}, mas o pagamento é em ${e.valor.moeda}.`);
    if (e.sessaoIds.length) {
      const ss = tx.select().from(t.sessoes).where(inArray(t.sessoes.id, e.sessaoIds)).all();
      const ja = tx.select().from(t.pagamentoSessoes).where(inArray(t.pagamentoSessoes.sessaoId, e.sessaoIds)).all();
      if (ss.length !== e.sessaoIds.length || ss.some((s) => s.pacienteId !== e.pacienteId)) throw new ErroDominio(400, "Sessões inválidas para este paciente.");
      if (ss.some((s) => s.moeda !== e.valor.moeda)) throw new ErroDominio(400, "As sessões escolhidas estão em outra moeda.");
      if (ss.some((s) => !sessaoCobravel(s.estado))) throw new ErroDominio(400, "Só sessões realizadas ou faltas cobradas podem ser quitadas.");
      if (ja.length) throw new ErroDominio(409, "Alguma das sessões escolhidas já está paga.");
    }
    tx.insert(t.pagamentos)
      .values({
        id,
        pacienteId: e.pacienteId,
        valorCentavos: e.valor.centavos,
        moeda: e.valor.moeda,
        data: e.data,
        meio: e.meio,
        contaId: e.contaId,
        observacao: e.observacao ?? "",
      })
      .run();
    for (const sessaoId of e.sessaoIds) tx.insert(t.pagamentoSessoes).values({ pagamentoId: id, sessaoId }).run();
  });
  return id;
}

export function excluirPagamento(db: Db, id: string) {
  const r = db.delete(t.pagamentos).where(eq(t.pagamentos.id, id)).run();
  if (!r.changes) throw new ErroDominio(404, "Pagamento não encontrado");
}

// ── Feriados e contas ────────────────────────────────────────

export function adicionarFeriado(db: Db, e: FeriadoEntrada) {
  db.transaction((tx) => {
    tx.insert(t.feriados).values(e).onConflictDoUpdate({ target: t.feriados.data, set: { descricao: e.descricao } }).run();
    tx.delete(t.sessoes)
      .where(and(sql`substr(${t.sessoes.vaga}, 1, 10) = ${e.data}`, descartaveis()))
      .run();
  });
}

export function removerFeriado(db: Db, data: string, agora: Date) {
  db.delete(t.feriados).where(eq(t.feriados.data, data)).run();
  garantirSessoes(db, agora);
}

export function criarConta(db: Db, c: Omit<Conta, "id" | "ativa">): string {
  const id = novoId("c");
  db.insert(t.contas).values({ id, ...c, ativa: true }).run();
  return id;
}

