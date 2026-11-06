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
    criadoEm: criadoEm(),
    atualizadoEm: text("atualizado_em").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
  },
  (t) => [index("notas_paciente").on(t.pacienteId), index("notas_sessao").on(t.sessaoId)],
);
