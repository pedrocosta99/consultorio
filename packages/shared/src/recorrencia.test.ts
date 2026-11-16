import { describe, expect, it } from "vitest";
import {
  datasDaRegra,
  descreverRecorrencia,
  escreverRegra,
  lerRegra,
  ocorrencias,
  regraAte,
  regraMovida,
  type Compromisso,
} from "./recorrencia";

const FUSO = "America/Sao_Paulo";
const base: Compromisso = {
  id: "c1",
  tipo: "compromisso",
  titulo: "Supervisão",
  categoria: "Supervisão",
  inicio: "2026-11-02T12:00:00.000Z", // segunda, 09:00 em Brasília
  duracaoMin: 60,
  fuso: FUSO,
  recorrencia: "FREQ=WEEKLY;BYDAY=MO,WE",
  excecoes: [],
};

describe("regra (RRULE)", () => {
  it("lê e escreve de volta", () => {
    const r = lerRegra("RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=TU,TH;UNTIL=20261231");
    expect(r).toEqual({ freq: "WEEKLY", intervalo: 2, dias: [2, 4], ate: "2026-12-31", vezes: null });
    expect(escreverRegra(r)).toBe("FREQ=WEEKLY;INTERVAL=2;BYDAY=TU,TH;UNTIL=20261231");
  });

  it("datas: semanal, quinzenal, diária, mensal e COUNT", () => {
    expect(datasDaRegra("FREQ=WEEKLY;BYDAY=MO,WE", "2026-11-02", "2026-11-11")).toEqual(["2026-11-02", "2026-11-04", "2026-11-09", "2026-11-11"]);
    expect(datasDaRegra("FREQ=WEEKLY;INTERVAL=2;BYDAY=MO", "2026-11-02", "2026-11-30")).toEqual(["2026-11-02", "2026-11-16", "2026-11-30"]);
    expect(datasDaRegra("FREQ=DAILY;INTERVAL=3", "2026-11-02", "2026-11-09")).toEqual(["2026-11-02", "2026-11-05", "2026-11-08"]);
    expect(datasDaRegra("FREQ=MONTHLY", "2026-11-05", "2027-01-31")).toEqual(["2026-11-05", "2026-12-05", "2027-01-05"]);
    expect(datasDaRegra("FREQ=WEEKLY;COUNT=3", "2026-11-04", "2027-01-01")).toEqual(["2026-11-04", "2026-11-11", "2026-11-18"]);
    expect(datasDaRegra("FREQ=DAILY;UNTIL=20261104", "2026-11-02", "2026-11-30")).toHaveLength(3);
  });

  it("descreve em português", () => {
    expect(descreverRecorrencia(null, base.inicio, FUSO)).toBe("Não se repete");
    expect(descreverRecorrencia("FREQ=WEEKLY;BYDAY=MO,WE", base.inicio, FUSO)).toBe("Toda semana na segunda e quarta");
    expect(descreverRecorrencia("FREQ=WEEKLY;INTERVAL=2;BYDAY=SA", base.inicio, FUSO)).toBe("A cada 2 semanas no sábado");
    expect(descreverRecorrencia("FREQ=MONTHLY;UNTIL=20270131", base.inicio, FUSO)).toBe("Todo mês no dia 2, até 31/01/2027");
  });

  it("mover um dia e encerrar a série", () => {
    expect(regraMovida("FREQ=WEEKLY;BYDAY=MO,WE", 3, 4)).toBe("FREQ=WEEKLY;BYDAY=MO,TH");
    expect(regraMovida("FREQ=DAILY", 3, 4)).toBe("FREQ=DAILY");
    expect(regraAte("FREQ=WEEKLY;BYDAY=MO;COUNT=10", "2026-11-16")).toBe("FREQ=WEEKLY;BYDAY=MO;UNTIL=20261115");
  });
});

describe("ocorrências", () => {
  it("expande no intervalo, na hora de parede do fuso", () => {
    const o = ocorrencias(base, "2026-11-03", "2026-11-10");
    expect(o.map((x) => x.inicio)).toEqual(["2026-11-04T12:00:00.000Z", "2026-11-09T12:00:00.000Z"]);
    expect(o[0]).toMatchObject({ data: "2026-11-04", duracaoMin: 60, recorrente: true, alterada: false });
  });

  it("aplica exceções: cancelada some; movida aparece no novo horário", () => {
    const c: Compromisso = {
      ...base,
      excecoes: [
        { data: "2026-11-04", cancelado: true },
        { data: "2026-11-09", cancelado: false, inicio: "2026-11-10T18:00:00.000Z", duracaoMin: 30 },
      ],
    };
    const o = ocorrencias(c, "2026-11-02", "2026-11-11");
    expect(o.map((x) => [x.data, x.inicio, x.duracaoMin, x.alterada])).toEqual([
      ["2026-11-02", "2026-11-02T12:00:00.000Z", 60, false],
      ["2026-11-09", "2026-11-10T18:00:00.000Z", 30, true],
      ["2026-11-11", "2026-11-11T12:00:00.000Z", 60, false],
    ]);
  });

  it("sem recorrência: uma ocorrência só", () => {
    expect(ocorrencias({ ...base, recorrencia: null }, "2026-11-01", "2026-11-30")).toHaveLength(1);
    expect(ocorrencias({ ...base, recorrencia: null }, "2026-11-03", "2026-11-30")).toHaveLength(0);
  });
});
