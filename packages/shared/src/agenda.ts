/**
 * Regras da agenda que não dependem de tela: horário de atendimento e conflitos.
 */
import { z } from "zod";

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Horário inválido");

/** Faixa de atendimento de um dia; null = não atende. */
export const faixaSchema = z
  .object({ inicio: hhmm, fim: hhmm })
  .refine((f) => f.fim > f.inicio, "O fim precisa ser depois do início")
  .nullable();
export type Faixa = z.infer<typeof faixaSchema>;

/** Sete faixas, de segunda (0) a domingo (6). */
export const horarioAtendimentoSchema = z.array(faixaSchema).length(7);
export type HorarioAtendimento = z.infer<typeof horarioAtendimentoSchema>;

export const HORARIO_ATENDIMENTO_PADRAO: HorarioAtendimento = [
  { inicio: "08:00", fim: "20:00" },
  { inicio: "08:00", fim: "20:00" },
  { inicio: "08:00", fim: "20:00" },
  { inicio: "08:00", fim: "20:00" },
  { inicio: "08:00", fim: "20:00" },
  null,
  null,
];

export function minutosDeHhmm(h: string): number {
  const [a, b] = h.split(":").map(Number) as [number, number];
  return a * 60 + b;
}

/** Faixa do dia ISO (1 = segunda … 7 = domingo). */
export function faixaDoDia(h: HorarioAtendimento, diaIso: number): Faixa {
  return h[diaIso - 1] ?? null;
}

export interface Intervalo {
  id: string;
  inicio: string;
  duracaoMin: number;
  rotulo: string;
}

/** Eventos (de `outros`) que se sobrepõem a [inicio, inicio + duração). Encostar na borda não conta. */
export function conflitos(inicio: string, duracaoMin: number, outros: Intervalo[], ignorar?: string): Intervalo[] {
  const a = Date.parse(inicio);
  const b = a + duracaoMin * 60_000;
  return outros.filter((o) => {
    if (o.id === ignorar) return false;
    const c = Date.parse(o.inicio);
    return c < b && c + o.duracaoMin * 60_000 > a;
  });
}
