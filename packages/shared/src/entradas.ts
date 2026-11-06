/**
 * Schemas do que o front envia para a API (formulários). Validados dos dois lados.
 */
import { z } from "zod";
import { dinheiroSchema } from "./money";
import { COBRANCAS, ESTADOS_SESSAO, MEIOS_PAGAMENTO, MODALIDADES, ORIGENS, STATUS_PACIENTE } from "./types";

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
    pago: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "Nada para atualizar");
export type SessaoPatch = z.infer<typeof sessaoPatchSchema>;

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

export const feriadoEntradaSchema = z.object({
  data: dataCivil,
  descricao: texto(1, "Descreva (ex.: Natal, férias)"),
});
export type FeriadoEntrada = z.infer<typeof feriadoEntradaSchema>;

/** PIN de 6 dígitos para abrir o app (uso local). Backups usam uma senha própria, mais longa. */
export const pinSchema = z.string().regex(/^\d{6}$/, "O PIN tem 6 dígitos (só números)");

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
  /** Moedas em uso. BRL sempre; USD/EUR só se ligadas em Configurações. */
  moedas: import("./money").Moeda[];
}

export interface EstadoAuth {
  /** Já existe banco (senha definida)? */
  configurado: boolean;
  desbloqueado: boolean;
  /** O cookie desta aba tem sessão válida? */
  sessaoValida: boolean;
}
