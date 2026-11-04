/**
 * Conversões de fuso baseadas só em Intl (sem subclasses de Date), para
 * funcionar igual no Node, no navegador e sob relógio falso nos testes.
 *
 * "Hora de parede" = o que o relógio marca naquele fuso.
 */

export interface PartesData {
  ano: number;
  /** 0–11, como Date */
  mes: number;
  dia: number;
  hora: number;
  minuto: number;
  segundo: number;
}

const formatadores = new Map<string, Intl.DateTimeFormat>();

function formatador(fuso: string): Intl.DateTimeFormat {
  let f = formatadores.get(fuso);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: fuso,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
    formatadores.set(fuso, f);
  }
  return f;
}

/** Componentes da hora de parede de um instante (ms) num fuso. */
export function partesNoFuso(ms: number, fuso: string): PartesData {
  const p: Record<string, number> = {};
  for (const { type, value } of formatador(fuso).formatToParts(ms)) {
    if (type !== "literal") p[type] = Number(value);
  }
  return { ano: p.year!, mes: p.month! - 1, dia: p.day!, hora: p.hour!, minuto: p.minute!, segundo: p.second! };
}

/** Diferença (ms) entre a hora de parede no fuso e UTC, naquele instante. */
export function offsetMs(ms: number, fuso: string): number {
  const p = partesNoFuso(ms, fuso);
  const comoUtc = Date.UTC(p.ano, p.mes, p.dia, p.hora, p.minuto, p.segundo);
  return comoUtc - (ms - (ms % 1000 + 1000) % 1000);
}

/**
 * Instante (ms) em que o relógio do fuso marca a data/hora dada.
 * Dias/minutos fora do intervalo são normalizados (ex.: minuto 600 = 10:00).
 */
export function instanteDeParede(
  ano: number,
  mes: number,
  dia: number,
  hora: number,
  minuto: number,
  fuso: string,
): number {
  const alvo = Date.UTC(ano, mes, dia, hora, minuto);
  let ms = alvo - offsetMs(alvo, fuso);
  // Segunda passada corrige casos perto de mudança de horário de verão.
  ms = alvo - offsetMs(ms, fuso);
  return ms;
}

/** Chave "yyyy-MM-dd" do dia civil do instante no fuso. */
export function chaveDiaNoFuso(ms: number, fuso: string): string {
  const p = partesNoFuso(ms, fuso);
  return `${p.ano}-${String(p.mes + 1).padStart(2, "0")}-${String(p.dia).padStart(2, "0")}`;
}

/**
 * Date "de parede": um Date comum cujos componentes locais (getHours etc.)
 * são a hora de parede no fuso. Serve para formatar e para aritmética de
 * calendário com date-fns. NÃO representa o instante real — não persista.
 */
export function paraParede(ms: number, fuso: string): Date {
  const p = partesNoFuso(ms, fuso);
  return new Date(p.ano, p.mes, p.dia, p.hora, p.minuto, p.segundo);
}

/** Inverso de paraParede: instante real a partir de um Date de parede. */
export function deParede(parede: Date, fuso: string): number {
  return instanteDeParede(
    parede.getFullYear(),
    parede.getMonth(),
    parede.getDate(),
    parede.getHours(),
    parede.getMinutes(),
    fuso,
  );
}
