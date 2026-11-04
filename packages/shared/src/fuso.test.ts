import { describe, expect, it } from "vitest";
import { chaveDiaNoFuso, instanteDeParede, partesNoFuso } from "./fuso";

describe("fuso", () => {
  const ms = Date.parse("2026-11-11T10:00:00Z");

  it("lê a hora de parede em fusos diferentes", () => {
    expect(partesNoFuso(ms, "America/Sao_Paulo").hora).toBe(7);
    expect(partesNoFuso(ms, "Europe/Lisbon").hora).toBe(10);
    expect(partesNoFuso(ms, "America/New_York").hora).toBe(5);
    expect(partesNoFuso(ms, "Asia/Dubai").hora).toBe(14);
  });

  it("monta o instante a partir da hora de parede", () => {
    expect(new Date(instanteDeParede(2026, 10, 11, 7, 0, "America/Sao_Paulo")).toISOString()).toBe("2026-11-11T10:00:00.000Z");
    // Lisboa no verão (UTC+1) e no inverno (UTC+0)
    expect(new Date(instanteDeParede(2026, 6, 1, 9, 0, "Europe/Lisbon")).toISOString()).toBe("2026-07-01T08:00:00.000Z");
    expect(new Date(instanteDeParede(2026, 11, 1, 9, 0, "Europe/Lisbon")).toISOString()).toBe("2026-12-01T09:00:00.000Z");
  });

  it("normaliza minutos além de 60", () => {
    expect(new Date(instanteDeParede(2026, 10, 11, 0, 600, "America/Sao_Paulo")).toISOString()).toBe("2026-11-11T13:00:00.000Z");
  });

  it("chave do dia depende do fuso", () => {
    const tarde = Date.parse("2026-11-11T23:30:00Z");
    expect(chaveDiaNoFuso(tarde, "America/Sao_Paulo")).toBe("2026-11-11");
    expect(chaveDiaNoFuso(tarde, "Europe/Lisbon")).toBe("2026-11-11");
    expect(chaveDiaNoFuso(tarde, "Asia/Dubai")).toBe("2026-11-12");
  });
});
