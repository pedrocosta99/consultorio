import { z } from "zod";
import { dinheiroSchema, moedaSchema } from "./money";

const id = z.string().min(1);
/** Instante absoluto em ISO 8601 (UTC). A conversão de fuso acontece só na exibição. */
const instante = z.iso.datetime();
/** Data civil, sem hora: "2026-11-04". */
const dataCivil = z.iso.date();

// ── Consultório ───────────────────────────────────────────────

export const ORIGENS = ["clinica_escola", "particular", "indicacao"] as const;
export const MODALIDADES = ["online", "presencial"] as const;
export const STATUS_PACIENTE = ["ativo", "pausa", "alta", "interrompido"] as const;

export const pacienteSchema = z.object({
  id,
  nome: z.string().min(1),
  /** Iniciais ou pseudônimo — usado quando o modo discreto está ligado. */
  apelido: z.string().min(1),
  contato: z.string().optional(),
  origem: z.enum(ORIGENS),
  modalidade: z.enum(MODALIDADES),
  status: z.enum(STATUS_PACIENTE),
  inicioEm: dataCivil,
  /** Fuso IANA onde o paciente está (ex.: "America/Sao_Paulo"). */
  fuso: z.string(),
  pontosFixos: z.string().default(""),
});
export type Paciente = z.infer<typeof pacienteSchema>;

export const COBRANCAS = ["sessao", "mensal"] as const;

export const contratoSchema = z.object({
  id,
  pacienteId: id,
  /** Sessões por semana. */
  frequencia: z.number().int().min(1).max(5),
  /** 1 = segunda … 7 = domingo (ISO). Um item por sessão semanal. */
  diasSemana: z.array(z.number().int().min(1).max(7)).min(1),
  /** "HH:mm" no fuso do consultório. */
  horario: z.string().regex(/^\d{2}:\d{2}$/),
  duracaoMin: z.number().int().positive(),
  valor: dinheiroSchema,
  cobranca: z.enum(COBRANCAS),
  vigenteDe: dataCivil,
  vigenteAte: dataCivil.nullable(),
});
export type Contrato = z.infer<typeof contratoSchema>;

export const ESTADOS_SESSAO = [
  "agendada",
  "realizada",
  "falta_cobrada",
  "falta_nao_cobrada",
  "cancelada",
  "remarcada",
] as const;
export type EstadoSessao = (typeof ESTADOS_SESSAO)[number];

export const sessaoSchema = z.object({
  id,
  pacienteId: id,
  inicio: instante,
  duracaoMin: z.number().int().positive(),
  estado: z.enum(ESTADOS_SESSAO),
  valor: dinheiroSchema,
  pago: z.boolean(),
});
export type Sessao = z.infer<typeof sessaoSchema>;

/** Sessão gera cobrança? (realizada ou falta cobrada) */
export function sessaoCobravel(estado: EstadoSessao): boolean {
  return estado === "realizada" || estado === "falta_cobrada";
}

export const MEIOS_PAGAMENTO = ["pix", "transferencia", "dinheiro", "cartao"] as const;

export const pagamentoSchema = z.object({
  id,
  pacienteId: id,
  sessaoIds: z.array(id),
  valor: dinheiroSchema,
  data: dataCivil,
  meio: z.enum(MEIOS_PAGAMENTO),
  contaId: id,
});
export type Pagamento = z.infer<typeof pagamentoSchema>;

export const TIPOS_NOTA = ["sessao", "fixa", "supervisao"] as const;

export const notaSchema = z.object({
  id,
  pacienteId: id,
  sessaoId: id.nullable(),
  tipo: z.enum(TIPOS_NOTA),
  texto: z.string(),
  tags: z.array(z.string()),
  levarSupervisao: z.boolean(),
  /** documental = poderia ser exigido; pessoal = anotação do analista. */
  natureza: z.enum(["documental", "pessoal"]),
  criadoEm: instante,
});
export type Nota = z.infer<typeof notaSchema>;

// ── Finanças ──────────────────────────────────────────────────

export const TIPOS_CONTA = ["corrente", "poupanca", "cartao", "investimento", "dinheiro"] as const;

export const contaSchema = z.object({
  id,
  nome: z.string(),
  instituicao: z.string(),
  pais: z.string().length(2),
  moeda: moedaSchema,
  tipo: z.enum(TIPOS_CONTA),
  ativa: z.boolean(),
});
export type Conta = z.infer<typeof contaSchema>;

export const TIPOS_TRANSACAO = ["receita", "despesa", "transferencia"] as const;

export const transacaoSchema = z.object({
  id,
  data: dataCivil,
  /** Positivo = entrada na conta; negativo = saída. */
  valor: dinheiroSchema,
  tipo: z.enum(TIPOS_TRANSACAO),
  descricao: z.string(),
  contaId: id,
  categoria: z.string(),
  subcategoria: z.string().optional(),
  pacienteId: id.optional(),
});
export type Transacao = z.infer<typeof transacaoSchema>;

// ── Rótulos em português para a interface ────────────────────

export const ROTULO_ORIGEM: Record<Paciente["origem"], string> = {
  clinica_escola: "Clínica-escola",
  particular: "Particular",
  indicacao: "Indicação",
};
export const ROTULO_MODALIDADE: Record<Paciente["modalidade"], string> = {
  online: "Online",
  presencial: "Presencial",
};
export const ROTULO_STATUS: Record<Paciente["status"], string> = {
  ativo: "Ativo",
  pausa: "Em pausa",
  alta: "Alta",
  interrompido: "Interrompido",
};
export const ROTULO_ESTADO: Record<EstadoSessao, string> = {
  agendada: "Agendada",
  realizada: "Realizada",
  falta_cobrada: "Falta cobrada",
  falta_nao_cobrada: "Falta não cobrada",
  cancelada: "Cancelada",
  remarcada: "Remarcada",
};
export const ROTULO_MEIO: Record<Pagamento["meio"], string> = {
  pix: "Pix",
  transferencia: "Transferência",
  dinheiro: "Dinheiro",
  cartao: "Cartão",
};
