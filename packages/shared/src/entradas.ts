/**
 * Schemas do que o front envia para a API (formulários). Validados dos dois lados.
 */
import { z } from "zod";
import { dinheiroSchema } from "./money";
import { lerRegra, TIPOS_COMPROMISSO } from "./recorrencia";
import { COBRANCAS, ESTADOS_SESSAO, MEIOS_PAGAMENTO, MODALIDADES, ORIGENS, STATUS_PACIENTE, TIPOS_LANCAMENTO } from "./types";

const dataCivil = z.iso.date({ error: "Data inválida" });
const texto = (min = 1, msg = "Obrigatório") => z.string().trim().min(min, msg);

export const pacienteEntradaSchema = z.object({
  nome: texto(1, "Informe o nome (ou um pseudônimo)"),
  apelido: texto(1, "Informe iniciais ou pseudônimo").max(24, "Máximo de 24 caracteres"),
  contato: z.string().trim().optional(),
  origem: z.enum(ORIGENS),
  modalidade: z.enum(MODALIDADES),
  status: z.enum(STATUS_PACIENTE),
  inicioEm: dataCivil,
  fuso: z.string().min(1),
  pontosFixos: z.string().optional(),
});
export type PacienteEntrada = z.infer<typeof pacienteEntradaSchema>;

export const contratoEntradaSchema = z.object({
  diasSemana: z.array(z.number().int().min(1).max(7)).min(1, "Escolha ao menos um dia").max(6),
  horario: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Horário inválido"),
  /** Horário próprio de alguns dias ("1".."7" → "HH:mm"). */
  horariosDia: z.record(z.string().regex(/^[1-7]$/), z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Horário inválido")).optional(),
  duracaoMin: z.number().int().min(5).max(240),
  valor: dinheiroSchema.refine((v) => v.centavos > 0, "Valor deve ser maior que zero"),
  cobranca: z.enum(COBRANCAS),
  politicaFaltas: z.string().optional(),
  /** A partir de quando vale. Se já houver contrato, o anterior termina na véspera. */
  vigenteDe: dataCivil,
});
export type ContratoEntrada = z.infer<typeof contratoEntradaSchema>;

export const sessaoPatchSchema = z
  .object({
    estado: z.enum(ESTADOS_SESSAO).optional(),
    inicio: z.iso.datetime().optional(),
    duracaoMin: z.number().int().min(5).max(240).optional(),
    pago: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "Nada para atualizar");
export type SessaoPatch = z.infer<typeof sessaoPatchSchema>;

/** "Esta e as seguintes": muda a grade fixa a partir desta sessão. */
export const sessaoSeguintesSchema = z.object({
  inicio: z.iso.datetime(),
  duracaoMin: z.number().int().min(5).max(240),
});
export type SessaoSeguintes = z.infer<typeof sessaoSeguintesSchema>;

export const sessaoAvulsaSchema = z.object({
  pacienteId: z.string().min(1),
  inicio: z.iso.datetime(),
  duracaoMin: z.number().int().min(5).max(240),
  valor: dinheiroSchema,
});
export type SessaoAvulsa = z.infer<typeof sessaoAvulsaSchema>;

export const pagamentoEntradaSchema = z.object({
  pacienteId: z.string().min(1),
  valor: dinheiroSchema.refine((v) => v.centavos > 0, "Valor deve ser maior que zero"),
  data: dataCivil,
  meio: z.enum(MEIOS_PAGAMENTO),
  contaId: z.string().min(1, "Escolha a conta"),
  /** Sessões que este pagamento quita (mesma moeda). */
  sessaoIds: z.array(z.string()).default([]),
  observacao: z.string().optional(),
});
export type PagamentoEntrada = z.input<typeof pagamentoEntradaSchema>;

export const lancamentoEntradaSchema = z.object({
  tipo: z.enum(TIPOS_LANCAMENTO),
  descricao: texto(1, "Descreva o lançamento").max(120, "Máximo de 120 caracteres"),
  valor: dinheiroSchema.refine((v) => v.centavos > 0, "Valor deve ser maior que zero"),
  data: dataCivil,
  categoria: texto(1, "Escolha ou digite a categoria").max(40, "Máximo de 40 caracteres"),
  fixo: z.boolean().default(false),
});
export type LancamentoEntrada = z.input<typeof lancamentoEntradaSchema>;
export const lancamentoPatchSchema = lancamentoEntradaSchema.partial().refine((v) => Object.keys(v).length > 0, "Nada para atualizar");

export const feriadoEntradaSchema = z.object({
  data: dataCivil,
  descricao: texto(1, "Descreva (ex.: Natal, férias)"),
});
export type FeriadoEntrada = z.infer<typeof feriadoEntradaSchema>;


export interface Feriado {
  data: string;
  descricao: string;
}

/** Tudo o que o front precisa do consultório, numa chamada (o volume é pequeno). */
export interface PacoteConsultorio {
  /** Relógio da API (fixo nos testes). */
  agora: string;
  pacientes: import("./types").Paciente[];
  contratos: import("./types").Contrato[];
  sessoes: import("./types").Sessao[];
  pagamentos: import("./types").Pagamento[];
  contas: import("./types").Conta[];
  feriados: Feriado[];
  notas: import("./types").Nota[];
  lancamentos: import("./types").Lancamento[];
  compromissos: import("./recorrencia").Compromisso[];
  /** Moedas em uso. BRL sempre; USD/EUR só se ligadas em Configurações. */
  moedas: import("./money").Moeda[];
  /** Chave Pix e modelos de mensagem/nota (Configurações). */
  mensagens: import("./cobranca").Mensagens;
}

export const reciboEntradaSchema = z.object({
  /** Data em que o recibo foi emitido; null desfaz. */
  em: dataCivil.nullable(),
  numero: z.string().trim().max(60).optional(),
});
export type ReciboEntrada = z.infer<typeof reciboEntradaSchema>;


export const notaEntradaSchema = z.object({
  pacienteId: z.string().min(1),
  sessaoId: z.string().nullable().optional(),
  texto: z.string().trim().min(1, "A nota está vazia"),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  levarSupervisao: z.boolean().default(false),
  natureza: z.enum(["documental", "pessoal"]).default("documental"),
  supervisaoTexto: z.string().max(10000, "Texto longo demais").optional(),
  supervisaoEm: z.iso.date({ error: "Data inválida" }).nullable().optional(),
});
export type NotaEntrada = z.input<typeof notaEntradaSchema>;
/**
 * PATCH de nota: só os campos enviados. Sem `.default()` aqui: no Zod 4, `.partial()`
 * mantém os defaults, e um PATCH parcial zeraria tags, supervisão e natureza.
 */
export const notaPatchSchema = z.object({
  sessaoId: z.string().nullable().optional(),
  texto: z.string().trim().min(1, "A nota está vazia").optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  levarSupervisao: z.boolean().optional(),
  natureza: z.enum(["documental", "pessoal"]).optional(),
  supervisaoTexto: z.string().max(10000, "Texto longo demais").optional(),
  supervisaoEm: z.iso.date({ error: "Data inválida" }).nullable().optional(),
});

/** Resultado da busca de texto completo. O trecho marca o termo entre [[ e ]]. */
export interface ResultadoBusca {
  origem: "nota" | "fixos";
  refId: string;
  pacienteId: string;
  trecho: string;
  criadoEm?: string;
}

// ── Compromissos (agenda) ────────────────────────────────────

const regraValida = z
  .string()
  .refine((r) => {
    try {
      lerRegra(r);
      return true;
    } catch {
      return false;
    }
  }, "Recorrência inválida");

export const compromissoEntradaSchema = z.object({
  tipo: z.enum(TIPOS_COMPROMISSO),
  titulo: texto(1, "Dê um título").max(80, "Máximo de 80 caracteres"),
  categoria: z.string().trim().max(40, "Máximo de 40 caracteres").default(""),
  inicio: z.iso.datetime(),
  duracaoMin: z.number().int().min(5).max(24 * 60),
  recorrencia: regraValida.nullable().default(null),
});
export type CompromissoEntrada = z.input<typeof compromissoEntradaSchema>;

export const ALCANCES = ["este", "seguintes", "todos"] as const;
export type Alcance = (typeof ALCANCES)[number];

/** Mudança numa ocorrência, com o alcance da pergunta do Google. */
export const compromissoAlteracaoSchema = z.object({
  alcance: z.enum(ALCANCES),
  /** Data civil original da ocorrência em que o clique aconteceu. */
  data: dataCivil,
  tipo: z.enum(TIPOS_COMPROMISSO).optional(),
  titulo: texto(1, "Dê um título").max(80, "Máximo de 80 caracteres").optional(),
  categoria: z.string().trim().max(40).optional(),
  inicio: z.iso.datetime().optional(),
  duracaoMin: z.number().int().min(5).max(24 * 60).optional(),
  /** Só vale para "seguintes" e "todos". */
  recorrencia: regraValida.nullable().optional(),
});
export type CompromissoAlteracao = z.infer<typeof compromissoAlteracaoSchema>;

export const compromissoExclusaoSchema = z.object({ alcance: z.enum(ALCANCES), data: dataCivil });
export type CompromissoExclusao = z.infer<typeof compromissoExclusaoSchema>;
