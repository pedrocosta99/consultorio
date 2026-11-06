import { describe, expect, it } from "vitest";
import { dinheiro } from "@consultorio/shared";
import { saldoPorMoeda } from "./saldo";

const AGORA = new Date("2026-11-04T17:30:00Z");
const s = (estado: Parameters<typeof saldoPorMoeda>[0][number]["estado"], centavos: number, moeda: "BRL" | "EUR" = "BRL", inicio = "2026-11-01T12:00:00Z") => ({
  estado,
  valor: dinheiro(centavos, moeda),
  inicio,
});

describe("saldoPorMoeda", () => {
  it("soma realizadas e faltas cobradas; ignora canceladas e faltas não cobradas", () => {
    const r = saldoPorMoeda([s("realizada", 20000), s("falta_cobrada", 20000), s("cancelada", 20000), s("falta_nao_cobrada", 20000)], [], AGORA);
    expect(r).toEqual([dinheiro(40000)]);
  });

  it("desconta pagamentos e zera quando quitado", () => {
    expect(saldoPorMoeda([s("realizada", 20000)], [{ valor: dinheiro(20000) }], AGORA)).toEqual([]);
  });

  it("pagamento adiantado vira crédito (negativo)", () => {
    expect(saldoPorMoeda([s("realizada", 20000)], [{ valor: dinheiro(50000) }], AGORA)).toEqual([dinheiro(-30000)]);
  });

  it("nunca mistura moedas", () => {
    const r = saldoPorMoeda([s("realizada", 20000), s("realizada", 6000, "EUR")], [{ valor: dinheiro(6000, "EUR") }], AGORA);
    expect(r).toEqual([dinheiro(20000)]);
  });

  it("sessão futura não é devida", () => {
    expect(saldoPorMoeda([s("realizada", 20000, "BRL", "2026-11-05T12:00:00Z")], [], AGORA)).toEqual([]);
  });
});
