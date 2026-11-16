import { describe, expect, it } from "vitest";
import { converter, formatarTaxa, lerPtax, lerTaxa, taxaEm, type Cotacao } from "./cambio";

const cot: Cotacao[] = [
  { data: "2026-10-01", moeda: "USD", taxa: 55000, fonte: "bcb" },
  { data: "2026-11-02", moeda: "USD", taxa: 54000, fonte: "bcb" },
  { data: "2026-11-02", moeda: "EUR", taxa: 62000, fonte: "manual" },
];

describe("câmbio", () => {
  it("lê e formata taxas", () => {
    expect(lerTaxa("5,4618")).toBe(54618);
    expect(lerTaxa("0")).toBeNull();
    expect(formatarTaxa(54618)).toBe("5,4618");
  });

  it("usa a última cotação até a data; sem anterior, a primeira depois", () => {
    expect(taxaEm(cot, "USD", "2026-10-15")).toBe(55000);
    expect(taxaEm(cot, "USD", "2026-11-10")).toBe(54000);
    expect(taxaEm(cot, "EUR", "2026-01-01")).toBe(62000);
    expect(taxaEm(cot, "BRL", "2026-01-01")).toBe(10000);
  });

  it("converte entre moedas passando pelo real, com arredondamento único", () => {
    expect(converter({ centavos: 10000, moeda: "USD" }, "BRL", "2026-11-05", cot)).toEqual({ centavos: 54000, moeda: "BRL" });
    expect(converter({ centavos: 54000, moeda: "BRL" }, "USD", "2026-11-05", cot)).toEqual({ centavos: 10000, moeda: "USD" });
    expect(converter({ centavos: 10000, moeda: "EUR" }, "USD", "2026-11-05", cot)).toEqual({ centavos: 11481, moeda: "USD" });
    expect(converter({ centavos: 100, moeda: "USD" }, "USD", "2026-11-05", [])).toEqual({ centavos: 100, moeda: "USD" });
    expect(converter({ centavos: 100, moeda: "USD" }, "BRL", "2026-11-05", [])).toBeNull();
  });

  it("lê o PTAX: fica o fechamento de cada dia", () => {
    const r = lerPtax(
      {
        value: [
          { cotacaoVenda: 5.4618, dataHoraCotacao: "2026-11-05 10:07:53", tipoBoletim: "Abertura" },
          { cotacaoVenda: 5.47, dataHoraCotacao: "2026-11-05 13:09:00", tipoBoletim: "Fechamento PTAX" },
          { cotacaoVenda: 5.5, dataHoraCotacao: "2026-11-06 10:00:00", tipoBoletim: "Abertura" },
        ],
      },
      "USD",
    );
    expect(r.map((c) => [c.data, c.taxa])).toEqual([
      ["2026-11-05", 54700],
      ["2026-11-06", 55000],
    ]);
  });
});
