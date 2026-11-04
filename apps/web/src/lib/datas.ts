import { format, type Locale } from "date-fns";
import { ptBR } from "date-fns/locale";
import { chaveDiaNoFuso, instanteDeParede, paraParede, partesNoFuso } from "@consultorio/shared";

export const locale: Locale = ptBR;
export const SEMANA = { weekStartsOn: 1 as const, locale: ptBR };

function ms(instante: string | Date | number): number {
  return instante instanceof Date ? instante.getTime() : typeof instante === "string" ? Date.parse(instante) : instante;
}

/**
 * Hora de parede do instante no fuso, como Date comum (para formatar e para
 * aritmética de calendário). Não use o resultado como instante real.
 */
export function noFuso(instante: string | Date | number, fuso: string): Date {
  return paraParede(ms(instante), fuso);
}

export function fmt(data: Date, padrao: string): string {
  return format(data, padrao, { locale: ptBR });
}

export function hora(instante: string | Date | number, fuso: string): string {
  const p = partesNoFuso(ms(instante), fuso);
  return `${String(p.hora).padStart(2, "0")}:${String(p.minuto).padStart(2, "0")}`;
}

/** Minutos desde a meia-noite no fuso informado. */
export function minutosDoDia(instante: string | Date | number, fuso: string): number {
  const p = partesNoFuso(ms(instante), fuso);
  return p.hora * 60 + p.minuto;
}

/** Chave de dia civil "yyyy-MM-dd" no fuso informado. */
export function chaveDia(instante: string | Date | number, fuso: string): string {
  return chaveDiaNoFuso(ms(instante), fuso);
}

/** Instante real a partir de um dia (Date de parede) + minutos no fuso. */
export function instanteEm(dia: Date, minutos: number, fuso: string): Date {
  return new Date(instanteDeParede(dia.getFullYear(), dia.getMonth(), dia.getDate(), 0, minutos, fuso));
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
