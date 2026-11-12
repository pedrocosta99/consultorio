/**
 * Fixos mensais. Cada fixo é uma série de lançamentos (um por mês) ligados por
 * `serieId`. O último lançamento da série manda: se ainda está marcado como fixo e
 * é de um mês anterior, a série está pendente para o mês escolhido.
 * Desmarcar "fixo" no último lançamento encerra a série.
 */
import type { Lancamento } from "./types";

/** "yyyy-MM" → número de dias do mês. */
function diasNoMes(mes: string): number {
  const [a, m] = mes.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(a, m, 0)).getUTCDate();
}

/** Mesmo dia do modelo no mês alvo (31 vira 30/28 quando o mês é menor). */
export function dataNoMes(modelo: string, mes: string): string {
  const dia = Math.min(Number(modelo.slice(8, 10)), diasNoMes(mes));
  return `${mes}-${String(dia).padStart(2, "0")}`;
}

/** Último lançamento de cada série que ainda está como fixo e não tem lançamento em `mes` (nem depois). */
export function fixosPendentes(lancamentos: Lancamento[], mes: string): Lancamento[] {
  const ultimo = new Map<string, Lancamento>();
  for (const l of lancamentos) {
    if (!l.serieId) continue;
    const atual = ultimo.get(l.serieId);
    if (!atual || l.data > atual.data || (l.data === atual.data && l.id > atual.id)) ultimo.set(l.serieId, l);
  }
  return [...ultimo.values()].filter((l) => l.fixo && l.data.slice(0, 7) < mes).sort((a, b) => a.data.slice(8).localeCompare(b.data.slice(8)) || a.descricao.localeCompare(b.descricao));
}
