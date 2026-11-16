/**
 * Esquema do banco local (SQLite). Valores monetários SEMPRE em centavos (inteiro)
 * + código da moeda. Instantes em ISO UTC; datas civis como "yyyy-MM-dd".
 */
import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import {
  COBRANCAS,
  ESTADOS_SESSAO,
  MEIOS_PAGAMENTO,
  MODALIDADES,
  MOEDAS,
  ORIGENS,
  STATUS_PACIENTE,
  TIPOS_CONTA,
  TIPOS_LANCAMENTO,
  PAPEIS,
  TIPOS_COMPROMISSO,
  TIPOS_NOTA,
} from "@consultorio/shared";

const criadoEm = () => text("criado_em").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`);

/** Versão do esquema, id do dispositivo, hash da senha, último sync… */
export const metaSistema = sqliteTable("meta_sistema", {
  chave: text("chave").primaryKey(),
  valor: text("valor").notNull(),
});

export const pacientes = sqliteTable(
  "pacientes",
  {
    id: text("id").primaryKey(),
    nome: text("nome").notNull(),
    apelido: text("apelido").notNull(),
    contato: text("contato"),
    origem: text("origem", { enum: ORIGENS }).notNull(),
    modalidade: text("modalidade", { enum: MODALIDADES }).notNull(),
    status: text("status", { enum: STATUS_PACIENTE }).notNull(),
    inicioEm: text("inicio_em").notNull(),
    fuso: text("fuso").notNull(),
    pontosFixos: text("pontos_fixos").notNull().default(""),
    /** Arquivado = some das listas, mas o prontuário fica guardado (CFP: 5 anos). */
    arquivadoEm: text("arquivado_em"),
    criadoEm: criadoEm(),
  },
  (t) => [index("pacientes_status").on(t.status)],
);

export const contratos = sqliteTable(
  "contratos",
  {
    id: text("id").primaryKey(),
    pacienteId: text("paciente_id").notNull().references(() => pacientes.id, { onDelete: "cascade" }),
    /** JSON: [1..7] ISO, um item por sessão semanal. */
    diasSemana: text("dias_semana", { mode: "json" }).$type<number[]>().notNull(),
    /** "HH:mm" no fuso do consultório. */
    horario: text("horario").notNull(),
    /** JSON { "1".."7": "HH:mm" }: horário próprio de alguns dias. null = todos em `horario`. */
    horariosDia: text("horarios_dia", { mode: "json" }).$type<Record<string, string>>(),
    duracaoMin: integer("duracao_min").notNull(),
    valorCentavos: integer("valor_centavos").notNull(),
    moeda: text("moeda", { enum: MOEDAS }).notNull(),
    cobranca: text("cobranca", { enum: COBRANCAS }).notNull(),
    politicaFaltas: text("politica_faltas").notNull().default(""),
    vigenteDe: text("vigente_de").notNull(),
    vigenteAte: text("vigente_ate"),
    criadoEm: criadoEm(),
  },
  (t) => [index("contratos_paciente").on(t.pacienteId)],
);

export const sessoes = sqliteTable(
  "sessoes",
  {
    id: text("id").primaryKey(),
    pacienteId: text("paciente_id").notNull().references(() => pacientes.id, { onDelete: "cascade" }),
    /** null = sessão avulsa. */
    contratoId: text("contrato_id").references(() => contratos.id, { onDelete: "set null" }),
    /**
     * Vaga da grade que gerou a sessão ("2026-11-04#1"). Única por contrato: mesmo
     * remarcada ou cancelada, a vaga não é gerada de novo.
     */
    vaga: text("vaga"),
    inicio: text("inicio").notNull(),
    duracaoMin: integer("duracao_min").notNull(),
    estado: text("estado", { enum: ESTADOS_SESSAO }).notNull(),
    valorCentavos: integer("valor_centavos").notNull(),
    moeda: text("moeda", { enum: MOEDAS }).notNull(),
    criadoEm: criadoEm(),
  },
  (t) => [
    index("sessoes_paciente").on(t.pacienteId),
    index("sessoes_inicio").on(t.inicio),
    uniqueIndex("sessoes_vaga").on(t.contratoId, t.vaga),
  ],
);

export const contas = sqliteTable("contas", {
  id: text("id").primaryKey(),
  nome: text("nome").notNull(),
  instituicao: text("instituicao").notNull(),
  pais: text("pais").notNull(),
  moeda: text("moeda", { enum: MOEDAS }).notNull(),
  tipo: text("tipo", { enum: TIPOS_CONTA }).notNull(),
  ativa: integer("ativa", { mode: "boolean" }).notNull().default(true),
});

export const pagamentos = sqliteTable(
  "pagamentos",
  {
    id: text("id").primaryKey(),
    pacienteId: text("paciente_id").notNull().references(() => pacientes.id, { onDelete: "cascade" }),
    valorCentavos: integer("valor_centavos").notNull(),
    moeda: text("moeda", { enum: MOEDAS }).notNull(),
    data: text("data").notNull(),
    meio: text("meio", { enum: MEIOS_PAGAMENTO }).notNull(),
    contaId: text("conta_id").notNull().references(() => contas.id),
    /** Ponte com Finanças (Fase 3). */
    transacaoId: text("transacao_id"),
    observacao: text("observacao").notNull().default(""),
    /** Recibo emitido (ex.: Receita Saúde) em "yyyy-MM-dd"; null = ainda não. */
    reciboEm: text("recibo_em"),
    reciboNumero: text("recibo_numero").notNull().default(""),
    criadoEm: criadoEm(),
  },
  (t) => [index("pagamentos_paciente").on(t.pacienteId)],
);

/** Quais sessões um pagamento quita. Cada sessão é quitada por no máximo um pagamento. */
export const pagamentoSessoes = sqliteTable(
  "pagamento_sessoes",
  {
    pagamentoId: text("pagamento_id").notNull().references(() => pagamentos.id, { onDelete: "cascade" }),
    sessaoId: text("sessao_id").notNull().references(() => sessoes.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.pagamentoId, t.sessaoId] }), uniqueIndex("pagamento_sessoes_sessao").on(t.sessaoId)],
);

/** Feriados e folgas: a grade não gera sessão nesses dias. */
export const feriados = sqliteTable("feriados", {
  data: text("data").primaryKey(),
  descricao: text("descricao").notNull(),
});

/**
 * Notas clínicas (dado sensível). A busca de texto completo fica em `busca_fts`
 * (FTS5), mantida por triggers — ver a migração 0001.
 */
export const notas = sqliteTable(
  "notas",
  {
    id: text("id").primaryKey(),
    pacienteId: text("paciente_id").notNull().references(() => pacientes.id, { onDelete: "cascade" }),
    sessaoId: text("sessao_id").references(() => sessoes.id, { onDelete: "set null" }),
    tipo: text("tipo", { enum: TIPOS_NOTA }).notNull(),
    texto: text("texto").notNull(),
    tags: text("tags", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
    levarSupervisao: integer("levar_supervisao", { mode: "boolean" }).notNull().default(false),
    /** documental = poderia ser exigido; pessoal = anotação do analista. */
    natureza: text("natureza", { enum: ["documental", "pessoal"] }).notNull(),
    /** O que foi discutido na supervisão (só faz sentido com levar_supervisao). */
    supervisaoTexto: text("supervisao_texto").notNull().default(""),
    /** Data civil em que foi discutida; null = ainda a levar. */
    supervisaoEm: text("supervisao_em"),
    criadoEm: criadoEm(),
    atualizadoEm: text("atualizado_em").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
  },
  (t) => [index("notas_paciente").on(t.pacienteId), index("notas_sessao").on(t.sessaoId)],
);

/**
 * Finanças v0: lançamentos manuais (aluguel, supervisão…). Pagamentos de pacientes
 * já são entradas por si e não são copiados para cá.
 */
export const lancamentos = sqliteTable(
  "lancamentos",
  {
    id: text("id").primaryKey(),
    data: text("data").notNull(),
    tipo: text("tipo", { enum: TIPOS_LANCAMENTO }).notNull(),
    descricao: text("descricao").notNull(),
    /** Sempre positivo; o sentido vem de `tipo`. */
    valorCentavos: integer("valor_centavos").notNull(),
    moeda: text("moeda", { enum: MOEDAS }).notNull(),
    categoria: text("categoria").notNull(),
    fixo: integer("fixo", { mode: "boolean" }).notNull().default(false),
    /** Série de um fixo mensal (id do primeiro lançamento). */
    serieId: text("serie_id"),
    criadoEm: criadoEm(),
  },
  (t) => [index("lancamentos_data").on(t.data), index("lancamentos_serie").on(t.serieId)],
);

/**
 * Compromissos e bloqueios da agenda (supervisão, análise, folgas…): o que não é
 * sessão de paciente. `recorrencia` é uma RRULE do Google (sem "RRULE:"); null = única.
 */
export const compromissos = sqliteTable(
  "compromissos",
  {
    id: text("id").primaryKey(),
    tipo: text("tipo", { enum: TIPOS_COMPROMISSO }).notNull(),
    titulo: text("titulo").notNull(),
    categoria: text("categoria").notNull(),
    /** Início da primeira ocorrência (ISO UTC). */
    inicio: text("inicio").notNull(),
    duracaoMin: integer("duracao_min").notNull(),
    fuso: text("fuso").notNull(),
    recorrencia: text("recorrencia"),
    criadoEm: criadoEm(),
  },
  (t) => [index("compromissos_inicio").on(t.inicio)],
);

/** "Só este evento": uma ocorrência movida, encurtada, renomeada ou cancelada. */
export const compromissosExcecoes = sqliteTable(
  "compromissos_excecoes",
  {
    compromissoId: text("compromisso_id").notNull().references(() => compromissos.id, { onDelete: "cascade" }),
    /** Data civil original da ocorrência. */
    data: text("data").notNull(),
    cancelado: integer("cancelado", { mode: "boolean" }).notNull().default(false),
    inicio: text("inicio"),
    duracaoMin: integer("duracao_min"),
    titulo: text("titulo"),
  },
  (t) => [primaryKey({ columns: [t.compromissoId, t.data] })],
);

/** Cotações para exibir valores convertidos (PTAX do Banco Central ou manual). */
export const cotacoes = sqliteTable(
  "cotacoes",
  {
    data: text("data").notNull(),
    moeda: text("moeda", { enum: MOEDAS }).notNull(),
    /** Reais por 1 unidade × 10.000 (5,4618 → 54618). */
    taxa: integer("taxa").notNull(),
    fonte: text("fonte", { enum: ["bcb", "manual"] }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.data, t.moeda] })],
);

// ── Consultórios, usuários e papéis ──────────────────────────
// Local: um consultório e um usuário fixos (migração 0010). Com o login (Fase 6.3),
// `uid_externo` guarda o id do Identity Platform.

export const consultorios = sqliteTable("consultorios", {
  id: text("id").primaryKey(),
  nome: text("nome").notNull(),
  fuso: text("fuso").notNull(),
  moedaPrincipal: text("moeda_principal", { enum: MOEDAS }).notNull().default("BRL"),
  criadoEm: criadoEm(),
});

export const usuarios = sqliteTable(
  "usuarios",
  {
    id: text("id").primaryKey(),
    uidExterno: text("uid_externo"),
    nome: text("nome").notNull(),
    email: text("email").notNull(),
    criadoEm: criadoEm(),
  },
  (t) => [uniqueIndex("usuarios_email").on(t.email), uniqueIndex("usuarios_uid").on(t.uidExterno)],
);

export const membros = sqliteTable(
  "membros",
  {
    consultorioId: text("consultorio_id").notNull().references(() => consultorios.id, { onDelete: "cascade" }),
    usuarioId: text("usuario_id").notNull().references(() => usuarios.id, { onDelete: "cascade" }),
    papel: text("papel", { enum: PAPEIS }).notNull(),
    criadoEm: criadoEm(),
  },
  (t) => [primaryKey({ columns: [t.consultorioId, t.usuarioId] })],
);

/** Configurações do consultório (antes no meta_sistema). JSON validado na leitura. */
export const configuracoes = sqliteTable("configuracoes", {
  consultorioId: text("consultorio_id").primaryKey().references(() => consultorios.id, { onDelete: "cascade" }),
  moedas: text("moedas", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
  mensagens: text("mensagens", { mode: "json" }).$type<Record<string, string>>(),
  horarioAtendimento: text("horario_atendimento", { mode: "json" }).$type<unknown[]>(),
  atualizadoEm: text("atualizado_em").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
});
