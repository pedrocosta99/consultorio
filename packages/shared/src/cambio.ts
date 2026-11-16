/**
 * Câmbio para EXIBIÇÃO: o valor fica sempre gravado na moeda original; a conversão
 * só acontece na tela, com a cotação registrada (PTAX do Banco Central ou manual).
 *
 * A taxa é guardada como inteiro em décimos de milésimo de real por unidade
 * (5,4618 → 54618), para não carregar ponto flutuante no banco.
 */
import { z } from "zod";
import type { Dinheiro, Moeda } from "./money";

export const ESCALA_TAXA = 10_000;

export const cotacaoSchema = z.object({
  /** Data civil "yyyy-MM-dd". */
  data: z.iso.date(),
  moeda: z.enum(["USD", "EUR"]),
  /** Reais por 1 unidade da moeda × 10.000. */
  taxa: z.number().int().positive(),
  fonte: z.enum(["bcb", "manual"]),
});
export type Cotacao = z.infer<typeof cotacaoSchema>;

/** Converte "5,4618" (ou 5.4618) para a escala inteira; null se inválido. */
export function lerTaxa(texto: string | number): number | null {
  const n = typeof texto === "number" ? texto : Number(texto.trim().replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * ESCALA_TAXA);
}

export function formatarTaxa(taxa: number): string {
  return (taxa / ESCALA_TAXA).toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

/**
 * Taxa (reais por unidade, escala inteira) de uma moeda numa data: a última cotação até
 * aquela data; se não houver anterior, a primeira depois. BRL = 1. null = nenhuma cotação.
 */
export function taxaEm(cotacoes: readonly Cotacao[], moeda: Moeda, data: string): number | null {
  if (moeda === "BRL") return ESCALA_TAXA;
  let antes: Cotacao | null = null;
  let depois: Cotacao | null = null;
  for (const c of cotacoes) {
    if (c.moeda !== moeda) continue;
    if (c.data <= data) {
      if (!antes || c.data > antes.data) antes = c;
    } else if (!depois || c.data < depois.data) depois = c;
  }
  return (antes ?? depois)?.taxa ?? null;
}

/** Valor convertido para `para` pela cotação da data; null se faltar cotação. */
export function converter(valor: Dinheiro, para: Moeda, data: string, cotacoes: readonly Cotacao[]): Dinheiro | null {
  if (valor.moeda === para) return valor;
  const de = taxaEm(cotacoes, valor.moeda, data);
  const ate = taxaEm(cotacoes, para, data);
  if (de === null || ate === null) return null;
  return { centavos: Math.round((valor.centavos * de) / ate), moeda: para };
}

/** Lê a resposta da API PTAX do Banco Central: o fechamento de cada dia. */
export function lerPtax(resposta: unknown, moeda: Exclude<Moeda, "BRL">): Cotacao[] {
  const itens = (resposta as { value?: Array<{ cotacaoVenda?: number; dataHoraCotacao?: string; tipoBoletim?: string }> })?.value ?? [];
  const porDia = new Map<string, Cotacao>();
  const comFechamento = new Set<string>();
  for (const it of itens) {
    if (typeof it.cotacaoVenda !== "number" || !it.dataHoraCotacao) continue;
    const data = it.dataHoraCotacao.slice(0, 10);
    const fechamento = (it.tipoBoletim ?? "").startsWith("Fechamento");
    // Fica o fechamento; sem ele, o último boletim do dia (a lista vem em ordem).
    if (comFechamento.has(data)) continue;
    if (fechamento) comFechamento.add(data);
    porDia.set(data, { data, moeda, taxa: Math.round(it.cotacaoVenda * ESCALA_TAXA), fonte: "bcb" });
  }
  return [...porDia.values()].sort((a, b) => a.data.localeCompare(b.data));
}
