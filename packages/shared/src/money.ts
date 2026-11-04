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
