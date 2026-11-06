import { z } from "zod";

/** Moedas aceitas. BRL é a principal (moeda de relatório padrão). */
export const MOEDAS = ["BRL", "USD", "EUR"] as const;
export const moedaSchema = z.enum(MOEDAS);
export type Moeda = z.infer<typeof moedaSchema>;
export const MOEDA_PRINCIPAL: Moeda = "BRL";

/** Valor monetário: SEMPRE centavos inteiros + código da moeda. Nunca float. */
export const dinheiroSchema = z.object({
  centavos: z.number().int(),
  moeda: moedaSchema,
});
export type Dinheiro = z.infer<typeof dinheiroSchema>;

export function dinheiro(centavos: number, moeda: Moeda = MOEDA_PRINCIPAL): Dinheiro {
  if (!Number.isInteger(centavos)) {
    throw new Error(`Valor monetário precisa ser inteiro em centavos, recebi ${centavos}`);
  }
  return { centavos, moeda };
}

export function somar(a: Dinheiro, b: Dinheiro): Dinheiro {
  if (a.moeda !== b.moeda) {
    throw new Error(`Não dá para somar ${a.moeda} com ${b.moeda} sem conversão explícita`);
  }
  return { centavos: a.centavos + b.centavos, moeda: a.moeda };
}

const formatadores = new Map<string, Intl.NumberFormat>();

/** Formata para exibição. Ex.: formatarDinheiro(dinheiro(25000)) → "R$ 250,00" */
export function formatarDinheiro(
  valor: Dinheiro,
  opcoes: { semCentavos?: boolean; sinal?: boolean } = {},
): string {
  const chave = `${valor.moeda}|${opcoes.semCentavos ? 0 : 2}|${opcoes.sinal ? 1 : 0}`;
  let fmt = formatadores.get(chave);
  if (!fmt) {
    fmt = new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: valor.moeda,
      minimumFractionDigits: opcoes.semCentavos ? 0 : 2,
      maximumFractionDigits: opcoes.semCentavos ? 0 : 2,
      signDisplay: opcoes.sinal ? "exceptZero" : "auto",
    });
    formatadores.set(chave, fmt);
  }
  // Divisão só na exibição; o valor armazenado continua inteiro.
  return fmt.format(valor.centavos / 100).replace(/ /g, " ");
}

/**
 * Lê um valor digitado ("240", "240,50", "1.234,56", "R$ 90") e devolve centavos.
 * Aceita vírgula ou ponto como separador decimal. null = não é um número válido.
 */
export function lerCentavos(texto: string): number | null {
  let t = texto.replace(/[^\d.,-]/g, "");
  if (!t || t === "-") return null;
  const ultimo = Math.max(t.lastIndexOf(","), t.lastIndexOf("."));
  // Separador decimal = o último, se tiver 1 ou 2 dígitos depois dele.
  if (ultimo >= 0 && t.length - ultimo - 1 <= 2) {
    t = t.slice(0, ultimo).replace(/[.,]/g, "") + "." + t.slice(ultimo + 1);
  } else {
    t = t.replace(/[.,]/g, "");
  }
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

/** Centavos → texto editável ("1234,5" → "1.234,50"), sem símbolo. */
export function centavosParaTexto(centavos: number): string {
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(centavos / 100);
}
