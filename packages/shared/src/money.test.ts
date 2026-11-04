import { describe, expect, it } from "vitest";
import { dinheiro, formatarDinheiro, somar } from "./money";

describe("dinheiro", () => {
  it("formata BRL em pt-BR", () => {
    expect(formatarDinheiro(dinheiro(25000))).toBe("R$ 250,00");
    expect(formatarDinheiro(dinheiro(123456789))).toBe("R$ 1.234.567,89");
  });

  it("formata USD e EUR", () => {
    expect(formatarDinheiro(dinheiro(9950, "USD"))).toBe("US$ 99,50");
    expect(formatarDinheiro(dinheiro(9950, "EUR"))).toBe("€ 99,50");
  });

  it("formata sem centavos e com sinal", () => {
    expect(formatarDinheiro(dinheiro(-25050), { semCentavos: true })).toBe("-R$ 251");
    expect(formatarDinheiro(dinheiro(1000), { sinal: true })).toBe("+R$ 10,00");
  });

  it("recusa valores não inteiros", () => {
    expect(() => dinheiro(10.5)).toThrow();
  });

  it("não soma moedas diferentes", () => {
    expect(somar(dinheiro(100), dinheiro(250))).toEqual(dinheiro(350));
    expect(() => somar(dinheiro(100), dinheiro(100, "USD"))).toThrow();
  });
});
