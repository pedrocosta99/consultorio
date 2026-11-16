import { describe, expect, it } from "vitest";
import { eventoDaSessao, eventoDoCompromisso } from "./google";
import type { Sessao } from "./types";
import type { Compromisso } from "./recorrencia";

const FUSO = "America/Sao_Paulo";
const sessao: Sessao = {
  id: "s_1",
  pacienteId: "p_1",
  contratoId: "k_1",
  inicio: "2026-11-04T17:00:00.000Z",
  duracaoMin: 50,
  estado: "agendada",
  valor: { centavos: 25000, moeda: "BRL" },
  pago: false,
};

describe("Google Agenda: sessão → evento", () => {
  it("só 'Sessão' e, se escolhido, o apelido; privado, sem nada clínico", () => {
    const e = eventoDaSessao(sessao, { apelido: "A.M." }, { titulo: "iniciais", fuso: FUSO })!;
    expect(e).toMatchObject({
      summary: "Sessão · A.M.",
      start: { dateTime: "2026-11-04T17:00:00.000Z", timeZone: FUSO },
      end: { dateTime: "2026-11-04T17:50:00.000Z", timeZone: FUSO },
      visibility: "private",
      extendedProperties: { private: { consultorioOrigem: "sessao", consultorioId: "s_1" } },
    });
    const texto = JSON.stringify(e);
    for (const proibido of ["250", "agendada", "p_1", "@"]) expect(texto).not.toContain(proibido);
    expect(eventoDaSessao(sessao, { apelido: "A.M." }, { titulo: "so_sessao", fuso: FUSO })!.summary).toBe("Sessão");
  });

  it("sessão cancelada sai do Google; falta continua (o horário foi ocupado)", () => {
    expect(eventoDaSessao({ ...sessao, estado: "cancelada" }, undefined, { titulo: "iniciais", fuso: FUSO })).toBeNull();
    expect(eventoDaSessao({ ...sessao, estado: "falta_cobrada" }, undefined, { titulo: "iniciais", fuso: FUSO })).not.toBeNull();
  });
});

describe("Google Agenda: compromisso → evento", () => {
  const sup: Compromisso = {
    id: "c_1",
    tipo: "compromisso",
    titulo: "Supervisão",
    categoria: "Supervisão",
    inicio: "2026-11-02T12:00:00.000Z",
    duracaoMin: 60,
    fuso: FUSO,
    recorrencia: "FREQ=WEEKLY;BYDAY=MO",
    excecoes: [{ data: "2026-11-09", cancelado: true }],
  };
  it("recorrente com RRULE e EXDATE das canceladas, na hora de parede", () => {
    expect(eventoDoCompromisso(sup).recurrence).toEqual(["RRULE:FREQ=WEEKLY;BYDAY=MO", "EXDATE;TZID=America/Sao_Paulo:20261109T090000"]);
    expect(eventoDoCompromisso({ ...sup, recorrencia: null, excecoes: [] }).recurrence).toBeUndefined();
  });
});
