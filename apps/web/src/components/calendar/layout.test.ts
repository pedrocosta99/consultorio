import { describe, expect, it } from "vitest";
import { novoHorario, pixelsParaMinutos, posicionar } from "./layout";

describe("posicionar", () => {
  it("evento sozinho ocupa a largura toda", () => {
    expect(posicionar([{ id: "a", inicio: 480, fim: 530 }]).get("a")).toEqual({ coluna: 0, colunas: 1 });
  });

  it("dois sobrepostos ficam lado a lado", () => {
    const r = posicionar([
      { id: "a", inicio: 480, fim: 530 },
      { id: "b", inicio: 500, fim: 550 },
    ]);
    expect(r.get("a")).toEqual({ coluna: 0, colunas: 2 });
    expect(r.get("b")).toEqual({ coluna: 1, colunas: 2 });
  });

  it("encostar na borda não é sobreposição", () => {
    const r = posicionar([
      { id: "a", inicio: 480, fim: 530 },
      { id: "b", inicio: 530, fim: 580 },
    ]);
    expect(r.get("a")?.colunas).toBe(1);
    expect(r.get("b")?.colunas).toBe(1);
  });

  it("reaproveita coluna livre dentro do mesmo grupo", () => {
    const r = posicionar([
      { id: "a", inicio: 480, fim: 600 },
      { id: "b", inicio: 490, fim: 520 },
      { id: "c", inicio: 530, fim: 560 },
    ]);
    expect(r.get("b")?.coluna).toBe(1);
    expect(r.get("c")?.coluna).toBe(1);
    expect(r.get("a")?.colunas).toBe(2);
  });
});

describe("arrastar", () => {
  it("encaixa em passos de 15 min", () => {
    expect(pixelsParaMinutos(20, 0.8)).toBe(30); // 25 min → 30
    expect(pixelsParaMinutos(5, 0.8)).toBe(0);
    expect(pixelsParaMinutos(-50, 0.8)).toBe(-60);
  });

  it("não deixa sair do dia", () => {
    expect(novoHorario(60, -120, 50)).toBe(0);
    expect(novoHorario(23 * 60, 60, 50)).toBe(24 * 60 - 50);
    expect(novoHorario(600, 30, 50)).toBe(630);
  });
});
