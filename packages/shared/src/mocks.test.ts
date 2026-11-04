import { describe, expect, it } from "vitest";
import { gerarMocks } from "./mocks";
import { contaSchema, pacienteSchema, sessaoSchema, transacaoSchema } from "./types";

const REF = new Date("2026-11-04T14:30:00-03:00");

describe("mocks", () => {
  it("são determinísticos para a mesma data", () => {
    expect(gerarMocks(REF)).toEqual(gerarMocks(REF));
  });

  it("respeitam os schemas", () => {
    const m = gerarMocks(REF);
    m.pacientes.forEach((p) => pacienteSchema.parse(p));
    m.sessoes.forEach((s) => sessaoSchema.parse(s));
    m.contas.forEach((c) => contaSchema.parse(c));
    m.transacoes.forEach((t) => transacaoSchema.parse(t));
  });

  it("sessões futuras estão agendadas e valores são inteiros", () => {
    const m = gerarMocks(REF);
    for (const s of m.sessoes) {
      if (new Date(s.inicio) > REF) expect(s.estado).toBe("agendada");
      expect(Number.isInteger(s.valor.centavos)).toBe(true);
    }
  });

  it("08:00 em São Paulo vira 11:00 UTC", () => {
    const m = gerarMocks(REF);
    const s = m.sessoes.find((x) => x.pacienteId === "p01")!;
    expect(s.inicio).toMatch(/T11:00:00\.000Z$/);
  });
});
