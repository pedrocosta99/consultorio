import { TZDate } from "@date-fns/tz";
import { format, type Locale } from "date-fns";
import { ptBR } from "date-fns/locale";

export const locale: Locale = ptBR;
export const SEMANA = { weekStartsOn: 1 as const, locale: ptBR };

/** Converte um instante (ISO ou Date) para o fuso informado. */
export function noFuso(instante: string | Date | number, fuso: string): TZDate {
  const ms = instante instanceof Date ? instante.getTime() : typeof instante === "string" ? Date.parse(instante) : instante;
  return new TZDate(ms, fuso);
}

export function fmt(data: Date, padrao: string): string {
  return format(data, padrao, { locale: ptBR });
}

export function hora(instante: string | Date, fuso: string): string {
  return fmt(noFuso(instante, fuso), "HH:mm");
}

/** Minutos desde a meia-noite no fuso informado. */
export function minutosDoDia(instante: string | Date, fuso: string): number {
  const d = noFuso(instante, fuso);
  return d.getHours() * 60 + d.getMinutes();
}

/** Chave de dia civil "yyyy-MM-dd" no fuso informado. */
export function chaveDia(instante: string | Date | number, fuso: string): string {
  return format(noFuso(instante, fuso), "yyyy-MM-dd");
}

/** Cria um instante a partir de dia civil + minutos no fuso informado. */
export function instanteEm(dia: Date, minutos: number, fuso: string): Date {
  const d = new TZDate(dia.getFullYear(), dia.getMonth(), dia.getDate(), 0, minutos, fuso);
  return new Date(d.getTime());
}

/** Rótulo curto do fuso: "Brasília", "Lisboa"… */
const NOMES_FUSO: Record<string, string> = {
  "America/Sao_Paulo": "Brasília",
  "America/Manaus": "Manaus",
  "America/Fortaleza": "Fortaleza",
  "America/Noronha": "Noronha",
  "America/New_York": "Nova York",
  "Europe/Lisbon": "Lisboa",
  "Europe/London": "Londres",
  "Europe/Paris": "Paris",
  "Asia/Dubai": "Dubai",
  UTC: "UTC",
};
export function nomeFuso(fuso: string): string {
  return NOMES_FUSO[fuso] ?? fuso.split("/").pop()!.replace(/_/g, " ");
}

/** Abreviação/offset do fuso num instante: "GMT-3". */
export function offsetFuso(fuso: string, em: Date = new Date()): string {
  const partes = new Intl.DateTimeFormat("pt-BR", { timeZone: fuso, timeZoneName: "shortOffset" }).formatToParts(em);
  return partes.find((p) => p.type === "timeZoneName")?.value ?? "";
}

export const FUSOS_DISPONIVEIS = Object.keys(NOMES_FUSO);

export function capitalizar(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
