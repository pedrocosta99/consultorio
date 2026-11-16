import { describe, expect, it } from "vitest";
import { dinheiro } from "@consultorio/shared";
import { diaDaSemanaIso, gerarVagas, moverVagaDaGrade, somarDias, type ContratoGrade } from "./grade";

const FUSO = "America/Sao_Paulo";
const base: ContratoGrade = {
  id: "k1",
  pacienteId: "p1",
  diasSemana: [1, 4],
  horario: "08:00",
  duracaoMin: 50,
  valor: dinheiro(25000),
  vigenteDe: "2026-11-01",
  vigenteAte: null,
};

describe("datas civis", () => {
  it("somam dias atravessando mês e ano", () => {
    expect(somarDias("2026-12-31", 1)).toBe("2027-01-01");
    expect(somarDias("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("dia da semana ISO", () => {
    expect(diaDaSemanaIso("2026-11-02")).toBe(1); // segunda
    expect(diaDaSemanaIso("2026-11-08")).toBe(7); // domingo
  });
});

describe("gerarVagas", () => {
  const sem = { feriados: new Set<string>(), fuso: FUSO };

  it("gera uma sessão por dia da grade, no horário do consultório (em UTC)", () => {
    const v = gerarVagas(base, { ...sem, de: "2026-11-02", ate: "2026-11-15" });
    expect(v.map((x) => x.vaga)).toEqual(["2026-11-02#1", "2026-11-05#4", "2026-11-09#1", "2026-11-12#4"]);
    expect(v[0]!.inicio).toBe("2026-11-02T11:00:00.000Z"); // 08:00 em Brasília
    expect(v[0]!.valor).toEqual(dinheiro(25000));
  });

  it("pula feriados manuais", () => {
    const v = gerarVagas(base, { ...sem, feriados: new Set(["2026-11-02"]), de: "2026-11-02", ate: "2026-11-08" });
    expect(v.map((x) => x.vaga)).toEqual(["2026-11-05#4"]);
  });

  it("respeita vigência (início e fim do contrato)", () => {
    const k = { ...base, vigenteDe: "2026-11-04", vigenteAte: "2026-11-09" };
    const v = gerarVagas(k, { ...sem, de: "2026-11-01", ate: "2026-11-30" });
    expect(v.map((x) => x.vaga)).toEqual(["2026-11-05#4", "2026-11-09#1"]);
  });

  it("mudança de contrato: o antigo para na véspera, o novo assume com outro valor e horário", () => {
    const antigo = { ...base, vigenteAte: "2026-11-15" };
    const novo: ContratoGrade = { ...base, id: "k2", diasSemana: [3], horario: "19:30", valor: dinheiro(28000), vigenteDe: "2026-11-16" };
    const opc = { ...sem, de: "2026-11-09", ate: "2026-11-22" };
    const todas = [...gerarVagas(antigo, opc), ...gerarVagas(novo, opc)];
    expect(todas.map((x) => `${x.contratoId} ${x.vaga} ${x.valor.centavos}`)).toEqual([
      "k1 2026-11-09#1 25000",
      "k1 2026-11-12#4 25000",
      "k2 2026-11-18#3 28000",
    ]);
    expect(todas[2]!.inicio).toBe("2026-11-18T22:30:00.000Z");
  });

  it("paciente em outro fuso: o horário da grade continua no fuso do consultório", () => {
    const v = gerarVagas({ ...base, diasSemana: [3], horario: "07:00" }, { ...sem, de: "2026-11-04", ate: "2026-11-04" });
    expect(v[0]!.inicio).toBe("2026-11-04T10:00:00.000Z");
  });
});

describe("horários por dia", () => {
  const sem = { feriados: new Set<string>(), fuso: FUSO };

  it("usa o horário próprio do dia quando há", () => {
    const v = gerarVagas({ ...base, horariosDia: { "4": "19:30" } }, { ...sem, de: "2026-11-02", ate: "2026-11-08" });
    expect(v.map((x) => x.inicio)).toEqual(["2026-11-02T11:00:00.000Z", "2026-11-05T22:30:00.000Z"]);
  });

  it("mover a vaga de um dia mantém o horário dos outros", () => {
    expect(moverVagaDaGrade(base, 4, 5, "10:00")).toEqual({ diasSemana: [1, 5], horario: "08:00", horariosDia: { "5": "10:00" } });
  });

  it("mover a única vaga troca o horário geral", () => {
    expect(moverVagaDaGrade({ ...base, diasSemana: [3] }, 3, 4, "10:00")).toEqual({ diasSemana: [4], horario: "10:00", horariosDia: null });
  });

  it("voltar todos ao mesmo horário limpa os horários próprios", () => {
    const g = { ...base, horariosDia: { "4": "10:00" } };
    expect(moverVagaDaGrade(g, 4, 4, "08:00")).toEqual({ diasSemana: [1, 4], horario: "08:00", horariosDia: null });
  });

  it("mover para um dia que já está na grade junta as vagas", () => {
    expect(moverVagaDaGrade(base, 4, 1, "09:00").diasSemana).toEqual([1]);
  });
});
