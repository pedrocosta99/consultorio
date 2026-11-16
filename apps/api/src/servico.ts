/**
 * Regras do consultório sobre o banco. Tudo síncrono (better-sqlite3) e, quando
 * mexe em mais de uma tabela, dentro de transação.
 *
 * SIGILO: nada aqui loga dados de pacientes.
 */
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, gt, inArray, isNotNull, isNull, notInArray, sql } from "drizzle-orm";
import {
  FUSO_CONSULTORIO,
  MENSAGENS_PADRAO,
  HORARIO_ATENDIMENTO_PADRAO,
  horarioAtendimentoSchema,
  type HorarioAtendimento,
  MOEDAS,
  chaveDiaNoFuso,
  dataNoMes,
  dinheiro,
  fixosPendentes,
  sessaoCobravel,
  type Conta,
  type ContratoEntrada,
  type Contrato,
  type FeriadoEntrada,
  type Lancamento,
  type LancamentoEntrada,
  type Mensagens,
  type ReciboEntrada,
  type Moeda,
  type NotaEntrada,
  type ResultadoBusca,
  type PacienteEntrada,
  type Paciente,
  type PacoteConsultorio,
  type Pagamento,
  type PagamentoEntrada,
  type Sessao,
  type SessaoAvulsa,
  type SessaoPatch,
  type SessaoSeguintes,
  type Contexto,
  type SessaoUsuario,
  type Cotacao,
  lerPtax,
  type Compromisso,
  type CompromissoAlteracao,
  type CompromissoEntrada,
  type CompromissoExclusao,
  diaIso,
  escreverRegra,
  lerRegra,
  partesNoFuso,
  instanteDeParede,
  regraAte,
  regraMovida,
} from "@consultorio/shared";
import type { Db } from "./db/conexao";
import * as t from "./db/schema";
import { diaDaSemanaIso, gerarVagas, moverVagaDaGrade, somarDias } from "./dominio/grade";

export class ErroDominio extends Error {
  constructor(
    public status: 400 | 403 | 404 | 409,
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
    ...(r.horariosDia ? { horariosDia: r.horariosDia } : {}),
    duracaoMin: r.duracaoMin,
    valor: dinheiro(r.valorCentavos, r.moeda),
    cobranca: r.cobranca,
    politicaFaltas: r.politicaFaltas,
    vigenteDe: r.vigenteDe,
    vigenteAte: r.vigenteAte,
  };
}

export function carregarConsultorio(db: Db, agora: Date, consultorioId = CONSULTORIO_LOCAL): PacoteConsultorio {
  const pagos = new Map(db.select().from(t.pagamentoSessoes).all().map((v) => [v.sessaoId, v.pagamentoId]));
  const sessoes: Sessao[] = db
    .select()
    .from(t.sessoes)
    .orderBy(asc(t.sessoes.inicio))
    .all()
    .map((s) => ({
      id: s.id,
      pacienteId: s.pacienteId,
      contratoId: s.contratoId,
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
      reciboEm: p.reciboEm,
      ...(p.reciboNumero ? { reciboNumero: p.reciboNumero } : {}),
    }));
  return {
    agora: agora.toISOString(),
    pacientes: db.select().from(t.pacientes).orderBy(asc(t.pacientes.nome)).all().map(paraPaciente),
    contratos: db.select().from(t.contratos).orderBy(asc(t.contratos.vigenteDe)).all().map(paraContrato),
    sessoes,
    pagamentos,
    contas: db.select().from(t.contas).all() as Conta[],
    feriados: db.select().from(t.feriados).orderBy(asc(t.feriados.data)).all(),
    moedas: moedasAtivas(db, consultorioId),
    notas: db
      .select()
      .from(t.notas)
      .orderBy(asc(t.notas.criadoEm))
      .all()
      .map(({ supervisaoTexto, ...n }) => ({ ...n, sessaoId: n.sessaoId ?? null, ...(supervisaoTexto ? { supervisaoTexto } : {}) })),
    lancamentos: listarLancamentos(db),
    compromissos: listarCompromissos(db),
    mensagens: lerMensagens(db, consultorioId),
    horarioAtendimento: lerHorarioAtendimento(db, consultorioId),
    cotacoes: listarCotacoes(db),
  };
}

// ── Consultório, usuário e contexto ──────────────────────────

/** Consultório e usuário da versão local (criados pela migração 0010). */
export const CONSULTORIO_LOCAL = "cons_local";
export const USUARIO_LOCAL = "u_local";

/**
 * Contexto da versão local: o usuário fixo, no seu consultório, com o papel que ele
 * tem lá. Com o login (Fase 6.3), o usuário vem do token.
 */
export function contextoLocal(db: Db): Contexto {
  const m = db.select().from(t.membros).where(eq(t.membros.usuarioId, USUARIO_LOCAL)).get();
  if (!m) throw new ErroDominio(409, "Banco sem o usuário local. Rode as migrações.");
  return { usuarioId: m.usuarioId, consultorioId: m.consultorioId, papel: m.papel };
}

/** Quem está usando, em qual consultório e com que papel (para a tela). */
export function sessaoDoUsuario(db: Db, ctx: Contexto): SessaoUsuario {
  const u = existe(db.select().from(t.usuarios).where(eq(t.usuarios.id, ctx.usuarioId)).get(), "Usuário não encontrado");
  const c = existe(db.select().from(t.consultorios).where(eq(t.consultorios.id, ctx.consultorioId)).get(), "Consultório não encontrado");
  return { usuario: { id: u.id, nome: u.nome, email: u.email }, consultorio: { id: c.id, nome: c.nome }, papel: ctx.papel };
}

type LinhaConfig = typeof t.configuracoes.$inferSelect;

function lerConfig(db: Db, consultorioId: string): LinhaConfig {
  return (
    db.select().from(t.configuracoes).where(eq(t.configuracoes.consultorioId, consultorioId)).get() ?? {
      consultorioId,
      moedas: [],
      mensagens: null,
      horarioAtendimento: null,
      atualizadoEm: "",
    }
  );
}

function gravarConfig(db: Db, consultorioId: string, mudanca: Partial<Omit<LinhaConfig, "consultorioId" | "atualizadoEm">>) {
  const set = { ...mudanca, atualizadoEm: new Date().toISOString() };
  db.insert(t.configuracoes)
    .values({ consultorioId, ...set })
    .onConflictDoUpdate({ target: t.configuracoes.consultorioId, set })
    .run();
}

// ── Mensagens e modelos (Configurações) ──────────────────────

export function lerMensagens(db: Db, consultorioId = CONSULTORIO_LOCAL): Mensagens {
  return { ...MENSAGENS_PADRAO, ...((lerConfig(db, consultorioId).mensagens ?? {}) as Partial<Mensagens>) };
}

export function definirMensagens(db: Db, m: Mensagens, consultorioId = CONSULTORIO_LOCAL) {
  gravarConfig(db, consultorioId, { mensagens: m });
}

// ── Horário de atendimento ───────────────────────────────────

export function lerHorarioAtendimento(db: Db, consultorioId = CONSULTORIO_LOCAL): HorarioAtendimento {
  const v = lerConfig(db, consultorioId).horarioAtendimento;
  const r = v ? horarioAtendimentoSchema.safeParse(v) : null;
  return r?.success ? r.data : HORARIO_ATENDIMENTO_PADRAO;
}

export function definirHorarioAtendimento(db: Db, h: HorarioAtendimento, consultorioId = CONSULTORIO_LOCAL) {
  gravarConfig(db, consultorioId, { horarioAtendimento: h });
}

// ── Moedas ───────────────────────────────────────────────────

export function moedasAtivas(db: Db, consultorioId = CONSULTORIO_LOCAL): Moeda[] {
  const lista = lerConfig(db, consultorioId).moedas;
  return MOEDAS.filter((m) => m === "BRL" || lista.includes(m));
}

export function definirMoedas(db: Db, moedas: Moeda[], consultorioId = CONSULTORIO_LOCAL) {
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
  gravarConfig(db, consultorioId, { moedas: novas });
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

/**
 * Sessões geradas pela grade, ainda agendadas, sem pagamento e sem nota, que podem
 * ser descartadas (e refeitas) quando a grade muda.
 */
function descartaveis() {
  return and(
    eq(t.sessoes.estado, "agendada"),
    isNotNull(t.sessoes.contratoId),
    notInArray(t.sessoes.id, sql`(select ${t.pagamentoSessoes.sessaoId} from ${t.pagamentoSessoes})`),
    notInArray(t.sessoes.id, sql`(select ${t.notas.sessaoId} from ${t.notas} where ${t.notas.sessaoId} is not null)`),
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
    if (patch.duracaoMin) mudancas.duracaoMin = patch.duracaoMin;
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
        horariosDia: e.horariosDia && Object.keys(e.horariosDia).length ? e.horariosDia : null,
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

/**
 * "Esta e as seguintes": a sessão `id` (da grade) vai para `e.inicio` com `e.duracaoMin`,
 * e a grade passa a valer assim a partir dela. O contrato atual termina na véspera e
 * começa uma nova versão (ou, se esta é a primeira vaga, o contrato muda no lugar).
 * Sessões já realizadas, pagas, com nota ou remarcadas à mão não mudam: o retorno diz
 * quantas ficaram como estavam.
 */
export function alterarDaquiEmDiante(db: Db, id: string, e: SessaoSeguintes, agora: Date): { mantidas: number } {
  let mantidas = 0;
  db.transaction((tx) => {
    const s = existe(tx.select().from(t.sessoes).where(eq(t.sessoes.id, id)).get(), "Sessão não encontrada");
    if (!s.contratoId || !s.vaga) throw new ErroDominio(400, "Sessão avulsa não faz parte de uma grade fixa.");
    const k = existe(tx.select().from(t.contratos).where(eq(t.contratos.id, s.contratoId)).get(), "Contrato não encontrado");
    const dataVaga = s.vaga.slice(0, 10);
    const diaAntigo = Number(s.vaga.split("#")[1]);
    const novoInicio = new Date(e.inicio);
    const dataNova = chaveDiaNoFuso(novoInicio.getTime(), FUSO_CONSULTORIO);
    const horaNova = new Intl.DateTimeFormat("en-GB", { timeZone: FUSO_CONSULTORIO, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(novoInicio);
    const grade = moverVagaDaGrade({ diasSemana: k.diasSemana, horario: k.horario, horariosDia: k.horariosDia }, diaAntigo, diaDaSemanaIso(dataNova), horaNova);
    const vigenteDe = dataNova < dataVaga ? dataNova : dataVaga;
    if (k.vigenteAte && k.vigenteAte < vigenteDe) throw new ErroDominio(409, "O contrato desta sessão já terminou.");
    const depois = tx
      .select({ id: t.contratos.id })
      .from(t.contratos)
      .where(and(eq(t.contratos.pacienteId, k.pacienteId), gt(t.contratos.vigenteDe, k.vigenteDe)))
      .get();
    if (depois) throw new ErroDominio(409, "Já existe uma mudança de horário marcada para depois. Ajuste pela ficha do paciente.");

    // Sessões da grade a partir daqui: as que podem ser refeitas saem; as outras ficam.
    const daqui = and(eq(t.sessoes.contratoId, k.id), sql`substr(${t.sessoes.vaga}, 1, 10) >= ${vigenteDe}`);
    const total = tx.select({ n: sql<number>`count(*)` }).from(t.sessoes).where(daqui).get()!.n;
    const removidas = tx.delete(t.sessoes).where(and(daqui, descartaveis())).run().changes;
    mantidas = total - removidas;

    const valores = {
      diasSemana: grade.diasSemana,
      horario: grade.horario,
      horariosDia: grade.horariosDia,
      duracaoMin: e.duracaoMin,
    };
    let contratoId = k.id;
    if (k.vigenteDe >= vigenteDe) {
      tx.update(t.contratos).set(valores).where(eq(t.contratos.id, k.id)).run();
    } else {
      contratoId = novoId("k");
      tx.update(t.contratos).set({ vigenteAte: somarDias(vigenteDe, -1) }).where(eq(t.contratos.id, k.id)).run();
      tx.insert(t.contratos)
        .values({
          ...valores,
          id: contratoId,
          pacienteId: k.pacienteId,
          valorCentavos: k.valorCentavos,
          moeda: k.moeda,
          cobranca: k.cobranca,
          politicaFaltas: k.politicaFaltas,
          vigenteDe,
          vigenteAte: k.vigenteAte,
        })
        .run();
      // As que ficaram passam para a nova versão, para a grade não gerar a mesma vaga de novo.
      tx.update(t.sessoes).set({ contratoId }).where(daqui).run();
    }

    // A própria sessão, se não pôde ser refeita (ex.: tem nota), muda de horário e de vaga.
    if (tx.select().from(t.sessoes).where(eq(t.sessoes.id, id)).get()) {
      tx.update(t.sessoes)
        .set({ inicio: novoInicio.toISOString(), duracaoMin: e.duracaoMin, contratoId, vaga: `${dataNova}#${diaDaSemanaIso(dataNova)}` })
        .where(eq(t.sessoes.id, id))
        .run();
      mantidas -= 1;
    }
  });
  garantirSessoes(db, agora);
  return { mantidas };
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

export function marcarRecibo(db: Db, id: string, e: ReciboEntrada) {
  const r = db
    .update(t.pagamentos)
    .set({ reciboEm: e.em, reciboNumero: e.em ? (e.numero ?? "") : "" })
    .where(eq(t.pagamentos.id, id))
    .run();
  if (!r.changes) throw new ErroDominio(404, "Pagamento não encontrado");
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


// ── Lançamentos (Finanças v0) ────────────────────────────────

function listarLancamentos(db: Db): Lancamento[] {
  return db
    .select()
    .from(t.lancamentos)
    .orderBy(desc(t.lancamentos.data), asc(t.lancamentos.id))
    .all()
    .map((l) => ({
      id: l.id,
      data: l.data,
      valor: dinheiro(l.valorCentavos, l.moeda),
      tipo: l.tipo,
      descricao: l.descricao,
      categoria: l.categoria,
      fixo: l.fixo,
      serieId: l.serieId,
    }));
}

function exigirMoedaAtiva(db: Db, moeda: Moeda) {
  if (!moedasAtivas(db).includes(moeda)) throw new ErroDominio(400, `Ligue ${moeda} em Configurações para lançar nessa moeda.`);
}

export function criarLancamento(db: Db, e: LancamentoEntrada): string {
  exigirMoedaAtiva(db, e.valor.moeda);
  const id = novoId("l");
  db.insert(t.lancamentos)
    .values({
      id,
      data: e.data,
      tipo: e.tipo,
      descricao: e.descricao,
      valorCentavos: e.valor.centavos,
      moeda: e.valor.moeda,
      categoria: e.categoria,
      fixo: e.fixo ?? false,
      serieId: e.fixo ? id : null,
    })
    .run();
  return id;
}

export function atualizarLancamento(db: Db, id: string, e: Partial<LancamentoEntrada>) {
  const l = existe(db.select().from(t.lancamentos).where(eq(t.lancamentos.id, id)).get(), "Lançamento não encontrado");
  if (e.valor) exigirMoedaAtiva(db, e.valor.moeda);
  const mudancas: Partial<typeof t.lancamentos.$inferInsert> = {};
  if (e.data !== undefined) mudancas.data = e.data;
  if (e.tipo !== undefined) mudancas.tipo = e.tipo;
  if (e.descricao !== undefined) mudancas.descricao = e.descricao;
  if (e.categoria !== undefined) mudancas.categoria = e.categoria;
  if (e.valor) {
    mudancas.valorCentavos = e.valor.centavos;
    mudancas.moeda = e.valor.moeda;
  }
  if (e.fixo !== undefined) {
    mudancas.fixo = e.fixo;
    // Virou fixo agora: começa uma série a partir dele.
    if (e.fixo && !l.serieId) mudancas.serieId = l.id;
  }
  db.update(t.lancamentos).set(mudancas).where(eq(t.lancamentos.id, id)).run();
}

export function excluirLancamento(db: Db, id: string) {
  const r = db.delete(t.lancamentos).where(eq(t.lancamentos.id, id)).run();
  if (!r.changes) throw new ErroDominio(404, "Lançamento não encontrado");
}

/** Repete no mês ("yyyy-MM") o último lançamento de cada fixo ainda não lançado. */
export function lancarFixos(db: Db, mes: string): number {
  return db.transaction((tx) => {
    const pendentes = fixosPendentes(listarLancamentos(tx as unknown as Db), mes);
    for (const m of pendentes) {
      tx.insert(t.lancamentos)
        .values({
          id: novoId("l"),
          data: dataNoMes(m.data, mes),
          tipo: m.tipo,
          descricao: m.descricao,
          valorCentavos: m.valor.centavos,
          moeda: m.valor.moeda,
          categoria: m.categoria,
          fixo: true,
          serieId: m.serieId,
        })
        .run();
    }
    return pendentes.length;
  });
}

// ── Notas e busca ────────────────────────────────────────────

export function criarNota(db: Db, e: NotaEntrada): string {
  existe(db.select().from(t.pacientes).where(eq(t.pacientes.id, e.pacienteId)).get(), "Paciente não encontrado");
  if (e.sessaoId) {
    const s = existe(db.select().from(t.sessoes).where(eq(t.sessoes.id, e.sessaoId)).get(), "Sessão não encontrada");
    if (s.pacienteId !== e.pacienteId) throw new ErroDominio(400, "A sessão é de outro paciente.");
  }
  const id = novoId("n");
  db.insert(t.notas)
    .values({
      id,
      pacienteId: e.pacienteId,
      sessaoId: e.sessaoId ?? null,
      tipo: e.sessaoId ? "sessao" : "fixa",
      texto: e.texto,
      tags: e.tags ?? [],
      levarSupervisao: e.levarSupervisao ?? false,
      natureza: e.natureza ?? "documental",
      supervisaoTexto: e.supervisaoTexto ?? "",
      supervisaoEm: e.supervisaoEm ?? null,
    })
    .run();
  return id;
}

export function atualizarNota(db: Db, id: string, e: Partial<Omit<NotaEntrada, "pacienteId">>) {
  const n = existe(db.select().from(t.notas).where(eq(t.notas.id, id)).get(), "Nota não encontrada");
  const mudancas: Partial<typeof t.notas.$inferInsert> = { atualizadoEm: new Date().toISOString() };
  if (e.texto !== undefined) mudancas.texto = e.texto;
  if (e.tags !== undefined) mudancas.tags = e.tags;
  if (e.levarSupervisao !== undefined) mudancas.levarSupervisao = e.levarSupervisao;
  if (e.natureza !== undefined) mudancas.natureza = e.natureza;
  if (e.supervisaoTexto !== undefined) mudancas.supervisaoTexto = e.supervisaoTexto;
  if (e.supervisaoEm !== undefined) mudancas.supervisaoEm = e.supervisaoEm;
  if (e.sessaoId !== undefined) {
    if (e.sessaoId) {
      const s = existe(db.select().from(t.sessoes).where(eq(t.sessoes.id, e.sessaoId)).get(), "Sessão não encontrada");
      if (s.pacienteId !== n.pacienteId) throw new ErroDominio(400, "A sessão é de outro paciente.");
    }
    mudancas.sessaoId = e.sessaoId ?? null;
    mudancas.tipo = e.sessaoId ? "sessao" : "fixa";
  }
  db.update(t.notas).set(mudancas).where(eq(t.notas.id, id)).run();
}

export function excluirNota(db: Db, id: string) {
  const r = db.delete(t.notas).where(eq(t.notas.id, id)).run();
  if (!r.changes) throw new ErroDominio(404, "Nota não encontrada");
}

/** Monta a consulta FTS5: cada palavra vira prefixo ("sonh" acha "sonho"), todas obrigatórias. */
export function consultaFts(q: string): string | null {
  const termos = q
    .normalize("NFC")
    .split(/\s+/)
    .map((p) => p.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(Boolean)
    .slice(0, 8);
  return termos.length ? termos.map((p) => `"${p}"*`).join(" ") : null;
}

export function buscar(sqlite: import("better-sqlite3").Database, q: string, limite = 30): ResultadoBusca[] {
  const consulta = consultaFts(q);
  if (!consulta) return [];
  const linhas = sqlite
    .prepare(
      `select f.origem, f.ref_id as refId, f.paciente_id as pacienteId,
              snippet(busca_fts, 3, '[[', ']]', '…', 14) as trecho, n.criado_em as criadoEm
         from busca_fts f left join notas n on f.origem = 'nota' and n.id = f.ref_id
        where busca_fts match ?
        order by bm25(busca_fts) limit ?`,
    )
    .all(consulta, limite) as Array<ResultadoBusca & { criadoEm: string | null }>;
  return linhas.map(({ criadoEm, ...r }) => (criadoEm ? { ...r, criadoEm } : r));
}

// ── Compromissos (agenda) ────────────────────────────────────

function listarCompromissos(db: Db): Compromisso[] {
  const excecoes = new Map<string, Compromisso["excecoes"]>();
  for (const e of db.select().from(t.compromissosExcecoes).all()) {
    excecoes.set(e.compromissoId, [
      ...(excecoes.get(e.compromissoId) ?? []),
      { data: e.data, cancelado: e.cancelado, inicio: e.inicio, duracaoMin: e.duracaoMin, titulo: e.titulo },
    ]);
  }
  return db
    .select()
    .from(t.compromissos)
    .orderBy(asc(t.compromissos.inicio))
    .all()
    .map((c) => ({
      id: c.id,
      tipo: c.tipo,
      titulo: c.titulo,
      categoria: c.categoria,
      inicio: c.inicio,
      duracaoMin: c.duracaoMin,
      fuso: c.fuso,
      recorrencia: c.recorrencia,
      excecoes: excecoes.get(c.id) ?? [],
    }));
}

export function criarCompromisso(db: Db, e: CompromissoEntrada): string {
  const id = novoId("c");
  db.insert(t.compromissos)
    .values({
      id,
      tipo: e.tipo,
      titulo: e.titulo.trim(),
      categoria: (e.categoria ?? "").trim(),
      inicio: new Date(e.inicio).toISOString(),
      duracaoMin: e.duracaoMin,
      fuso: FUSO_CONSULTORIO,
      recorrencia: e.recorrencia ?? null,
    })
    .run();
  return id;
}

/** Início original (sem exceção) da ocorrência da data civil `data`. */
function inicioOriginal(c: typeof t.compromissos.$inferSelect, data: string): string {
  const p = partesNoFuso(Date.parse(c.inicio), c.fuso);
  const [a, m, d] = data.split("-").map(Number) as [number, number, number];
  return new Date(instanteDeParede(a, m - 1, d, p.hora, p.minuto, c.fuso)).toISOString();
}

/** Desloca os dias de uma regra semanal (ex.: tudo um dia depois). */
function regraDeslocada(rrule: string, deltaDias: number): string {
  const r = lerRegra(rrule);
  if (r.freq !== "WEEKLY" || !r.dias.length || deltaDias % 7 === 0) return rrule;
  const dias = r.dias.map((d) => ((((d - 1 + deltaDias) % 7) + 7) % 7) + 1).sort((a, b) => a - b);
  return escreverRegra({ ...r, dias: [...new Set(dias)] });
}

/**
 * Muda uma ocorrência com o alcance escolhido: "este" vira exceção; "seguintes" encerra
 * a série na véspera e começa outra a partir desta; "todos" muda a série inteira.
 * Devolve o id do compromisso que ficou com a ocorrência.
 */
export function alterarCompromisso(db: Db, id: string, e: CompromissoAlteracao): string {
  return db.transaction((tx) => {
    const c = existe(tx.select().from(t.compromissos).where(eq(t.compromissos.id, id)).get(), "Compromisso não encontrado");
    const dataInicial = chaveDiaNoFuso(Date.parse(c.inicio), c.fuso);
    const excecao = tx
      .select()
      .from(t.compromissosExcecoes)
      .where(and(eq(t.compromissosExcecoes.compromissoId, id), eq(t.compromissosExcecoes.data, e.data)))
      .get();
    const original = inicioOriginal(c, e.data);
    const atual = excecao?.inicio ?? original;
    const novoInicio = e.inicio ? new Date(e.inicio).toISOString() : atual;
    const duracaoMin = e.duracaoMin ?? excecao?.duracaoMin ?? c.duracaoMin;
    const comuns = {
      ...(e.tipo ? { tipo: e.tipo } : {}),
      ...(e.titulo ? { titulo: e.titulo.trim() } : {}),
      ...(e.categoria !== undefined ? { categoria: e.categoria.trim() } : {}),
    };
    const alcance = !c.recorrencia ? "todos" : e.alcance === "seguintes" && e.data <= dataInicial ? "todos" : e.alcance;

    if (alcance === "este") {
      const valores = { cancelado: false, inicio: novoInicio, duracaoMin, titulo: e.titulo?.trim() ?? excecao?.titulo ?? null };
      tx.insert(t.compromissosExcecoes)
        .values({ compromissoId: id, data: e.data, ...valores })
        .onConflictDoUpdate({ target: [t.compromissosExcecoes.compromissoId, t.compromissosExcecoes.data], set: valores })
        .run();
      return id;
    }

    // O deslocamento é medido a partir de onde a ocorrência estava (com ou sem exceção).
    const deltaMs = Date.parse(novoInicio) - Date.parse(atual);
    const dataNova = chaveDiaNoFuso(Date.parse(novoInicio), c.fuso);
    const deltaDias = Math.round((Date.parse(dataNova + "T00:00:00Z") - Date.parse(chaveDiaNoFuso(Date.parse(atual), c.fuso) + "T00:00:00Z")) / 86_400_000);

    if (alcance === "todos") {
      const recorrencia = e.recorrencia !== undefined ? e.recorrencia : c.recorrencia ? regraDeslocada(c.recorrencia, deltaDias) : null;
      tx.update(t.compromissos)
        .set({ ...comuns, inicio: new Date(Date.parse(c.inicio) + deltaMs).toISOString(), duracaoMin, recorrencia })
        .where(eq(t.compromissos.id, id))
        .run();
      // Mudanças de horário pontuais perdem o sentido; cancelamentos ficam.
      if (deltaMs !== 0 || e.recorrencia !== undefined) {
        tx.delete(t.compromissosExcecoes)
          .where(and(eq(t.compromissosExcecoes.compromissoId, id), eq(t.compromissosExcecoes.cancelado, false)))
          .run();
      }
      return id;
    }

    // "seguintes": a série antiga para na véspera; a nova começa nesta ocorrência.
    const novoId_ = novoId("c");
    const recorrencia = e.recorrencia !== undefined ? e.recorrencia : regraMovida(c.recorrencia!, diaIso(e.data), diaIso(dataNova));
    tx.update(t.compromissos).set({ recorrencia: regraAte(c.recorrencia!, e.data) }).where(eq(t.compromissos.id, id)).run();
    tx.delete(t.compromissosExcecoes)
      .where(and(eq(t.compromissosExcecoes.compromissoId, id), sql`${t.compromissosExcecoes.data} >= ${e.data}`))
      .run();
    tx.insert(t.compromissos)
      .values({
        id: novoId_,
        tipo: comuns.tipo ?? c.tipo,
        titulo: comuns.titulo ?? c.titulo,
        categoria: comuns.categoria ?? c.categoria,
        inicio: novoInicio,
        duracaoMin,
        fuso: c.fuso,
        recorrencia: recorrencia ? escreverRegra({ ...lerRegra(recorrencia), vezes: null }) : null,
      })
      .run();
    return novoId_;
  });
}

export function excluirCompromisso(db: Db, id: string, e: CompromissoExclusao) {
  db.transaction((tx) => {
    const c = existe(tx.select().from(t.compromissos).where(eq(t.compromissos.id, id)).get(), "Compromisso não encontrado");
    const dataInicial = chaveDiaNoFuso(Date.parse(c.inicio), c.fuso);
    const tudo = !c.recorrencia || e.alcance === "todos" || (e.alcance === "seguintes" && e.data <= dataInicial);
    if (tudo) {
      tx.delete(t.compromissos).where(eq(t.compromissos.id, id)).run();
    } else if (e.alcance === "este") {
      tx.insert(t.compromissosExcecoes)
        .values({ compromissoId: id, data: e.data, cancelado: true })
        .onConflictDoUpdate({ target: [t.compromissosExcecoes.compromissoId, t.compromissosExcecoes.data], set: { cancelado: true } })
        .run();
    } else {
      tx.update(t.compromissos).set({ recorrencia: regraAte(c.recorrencia!, e.data) }).where(eq(t.compromissos.id, id)).run();
      tx.delete(t.compromissosExcecoes)
        .where(and(eq(t.compromissosExcecoes.compromissoId, id), sql`${t.compromissosExcecoes.data} >= ${e.data}`))
        .run();
    }
  });
}

// ── Cotações (câmbio só para exibição) ───────────────────────

function listarCotacoes(db: Db): Cotacao[] {
  return db
    .select()
    .from(t.cotacoes)
    .orderBy(asc(t.cotacoes.data))
    .all()
    .filter((c): c is Cotacao => c.moeda !== "BRL");
}

/** Cotação digitada à mão: substitui a do Banco Central naquele dia. */
export function definirCotacao(db: Db, c: Omit<Cotacao, "fonte">) {
  const valores = { taxa: c.taxa, fonte: "manual" as const };
  db.insert(t.cotacoes).values({ ...c, ...valores }).onConflictDoUpdate({ target: [t.cotacoes.data, t.cotacoes.moeda], set: valores }).run();
}

export function excluirCotacao(db: Db, moeda: Moeda, data: string) {
  const r = db.delete(t.cotacoes).where(and(eq(t.cotacoes.moeda, moeda), eq(t.cotacoes.data, data))).run();
  if (!r.changes) throw new ErroDominio(404, "Cotação não encontrada");
}

/** Grava as cotações do Banco Central sem passar por cima das manuais. Devolve quantas entraram. */
export function gravarCotacoesBcb(db: Db, lista: Cotacao[]): number {
  let n = 0;
  db.transaction((tx) => {
    for (const c of lista) {
      n += tx.insert(t.cotacoes).values({ ...c, fonte: "bcb" }).onConflictDoNothing().run().changes;
    }
  });
  return n;
}

/** Data mais antiga com dinheiro numa moeda (pagamento ou lançamento), para saber desde quando buscar. */
export function primeiraDataNaMoeda(db: Db, moeda: Moeda): string | null {
  const a = db.select({ d: sql<string | null>`min(${t.pagamentos.data})` }).from(t.pagamentos).where(eq(t.pagamentos.moeda, moeda)).get()?.d ?? null;
  const b = db.select({ d: sql<string | null>`min(${t.lancamentos.data})` }).from(t.lancamentos).where(eq(t.lancamentos.moeda, moeda)).get()?.d ?? null;
  return [a, b].filter((x): x is string => !!x).sort()[0] ?? null;
}

/**
 * Busca o PTAX (fechamento) no Banco Central. Só sai da máquina a moeda e o período;
 * nada do consultório. `buscar` é injetável para testes.
 */
export async function buscarPtax(moeda: Exclude<Moeda, "BRL">, de: string, ate: string, buscar: typeof fetch = fetch): Promise<Cotacao[]> {
  const mdY = (d: string) => `${d.slice(5, 7)}-${d.slice(8, 10)}-${d.slice(0, 4)}`;
  const url =
    "https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoMoedaPeriodo(moeda=@moeda,dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)" +
    `?@moeda='${moeda}'&@dataInicial='${mdY(de)}'&@dataFinalCotacao='${mdY(ate)}'&$format=json&$select=cotacaoVenda,dataHoraCotacao,tipoBoletim`;
  const r = await buscar(url, { signal: AbortSignal.timeout(20_000) });
  if (!r.ok) throw new ErroDominio(409, `O Banco Central não respondeu (${r.status}). Tente de novo mais tarde ou digite a cotação.`);
  return lerPtax(await r.json(), moeda);
}
