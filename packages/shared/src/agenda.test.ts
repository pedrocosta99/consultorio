import { describe, expect, it } from "vitest";
import { conflitos, faixaDoDia, HORARIO_ATENDIMENTO_PADRAO, horarioAtendimentoSchema } from "./agenda";

describe("agenda", () => {
  it("conflitos: sobreposição conta, encostar não, e ignora o próprio evento", () => {
    const outros = [
      { id: "a", inicio: "2026-11-04T13:00:00.000Z", duracaoMin: 50, rotulo: "A" },
      { id: "b", inicio: "2026-11-04T14:00:00.000Z", duracaoMin: 60, rotulo: "B" },
    ];
    expect(conflitos("2026-11-04T13:30:00.000Z", 50, outros).map((x) => x.id)).toEqual(["a", "b"]);
    expect(conflitos("2026-11-04T13:50:00.000Z", 10, outros)).toEqual([]);
    expect(conflitos("2026-11-04T13:00:00.000Z", 50, outros, "a")).toEqual([]);
  });

  it("horário de atendimento: padrão seg–sex e validação", () => {
    expect(faixaDoDia(HORARIO_ATENDIMENTO_PADRAO, 1)).toEqual({ inicio: "08:00", fim: "20:00" });
    expect(faixaDoDia(HORARIO_ATENDIMENTO_PADRAO, 7)).toBeNull();
    expect(horarioAtendimentoSchema.safeParse([...HORARIO_ATENDIMENTO_PADRAO.slice(0, 6), { inicio: "10:00", fim: "09:00" }]).success).toBe(false);
  });
});
