import { describe, expect, it } from "vitest";
import { dinheiro } from "./money";
import { dataNoMes, fixosPendentes } from "./lancamentos";
import type { Lancamento } from "./types";

const l = (id: string, data: string, extra: Partial<Lancamento> = {}): Lancamento => ({
  id,
  data,
  valor: dinheiro(90000),
  tipo: "saida",
  descricao: "Aluguel da sala",
  categoria: "Aluguel da sala",
  fixo: true,
  serieId: "s1",
  ...extra,
});

describe("dataNoMes", () => {
  it("mantém o dia e ajusta no fim do mês", () => {
    expect(dataNoMes("2026-10-05", "2026-11")).toBe("2026-11-05");
    expect(dataNoMes("2026-01-31", "2026-02")).toBe("2026-02-28");
    expect(dataNoMes("2026-10-31", "2026-11")).toBe("2026-11-30");
  });
});

describe("fixosPendentes", () => {
  it("o último da série manda; mês já lançado não fica pendente", () => {
    const ls = [l("a", "2026-09-05"), l("b", "2026-10-05")];
    expect(fixosPendentes(ls, "2026-11").map((x) => x.id)).toEqual(["b"]);
    expect(fixosPendentes([...ls, l("c", "2026-11-05")], "2026-11")).toEqual([]);
  });

  it("desmarcar fixo no último encerra a série; avulso nunca é pendente", () => {
    expect(fixosPendentes([l("a", "2026-09-05"), l("b", "2026-10-05", { fixo: false })], "2026-11")).toEqual([]);
    expect(fixosPendentes([l("a", "2026-10-05", { fixo: false, serieId: null })], "2026-11")).toEqual([]);
  });

  it("não volta para meses anteriores ao último lançamento", () => {
    expect(fixosPendentes([l("a", "2026-11-05")], "2026-10")).toEqual([]);
  });
});
