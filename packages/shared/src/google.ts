/**
 * Como sessões e compromissos viram eventos do Google Agenda (formato da Calendar API v3).
 *
 * SIGILO: o evento leva só "Sessão" e, se a pessoa escolher, as iniciais/pseudônimo do
 * paciente (`apelido`). Nunca o nome, contato, estado clínico, valor ou nota. O evento é
 * privado, e o paciente nunca é convidado (o e-mail dele não vai para o Google).
 */
import type { Paciente, Sessao } from "./types";
import { lerRegra, type Compromisso } from "./recorrencia";
import { partesNoFuso } from "./fuso";

/** Como a sessão aparece no Google. */
export const TITULOS_SESSAO = ["iniciais", "so_sessao"] as const;
export type TituloSessao = (typeof TITULOS_SESSAO)[number];

export interface EventoGoogle {
  summary: string;
  description: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  visibility: "private";
  /** opaque = ocupa o horário. */
  transparency: "opaque";
  recurrence?: string[];
  /** Liga o evento ao registro do app (para atualizar/apagar depois). */
  extendedProperties: { private: { consultorioOrigem: "sessao" | "compromisso"; consultorioId: string } };
}

const DESCRICAO = "Criado pelo Consultório. Os detalhes ficam no app.";

function fim(inicio: string, duracaoMin: number): string {
  return new Date(Date.parse(inicio) + duracaoMin * 60_000).toISOString();
}

export function tituloDaSessao(p: Pick<Paciente, "apelido"> | undefined, modo: TituloSessao): string {
  const apelido = p?.apelido?.trim();
  return modo === "iniciais" && apelido ? `Sessão · ${apelido}` : "Sessão";
}

/**
 * Evento de uma sessão, ou null se ela não deve estar no Google (cancelada). Faltas e
 * sessões realizadas continuam lá: o horário foi ocupado.
 */
export function eventoDaSessao(s: Sessao, p: Pick<Paciente, "apelido"> | undefined, opcoes: { titulo: TituloSessao; fuso: string }): EventoGoogle | null {
  if (s.estado === "cancelada") return null;
  return {
    summary: tituloDaSessao(p, opcoes.titulo),
    description: DESCRICAO,
    start: { dateTime: s.inicio, timeZone: opcoes.fuso },
    end: { dateTime: fim(s.inicio, s.duracaoMin), timeZone: opcoes.fuso },
    visibility: "private",
    transparency: "opaque",
    extendedProperties: { private: { consultorioOrigem: "sessao", consultorioId: s.id } },
  };
}

/** "20261104T090000": hora de parede no fuso, como o Google quer no EXDATE com TZID. */
function horaLocalCompacta(iso: string, fuso: string): string {
  const p = partesNoFuso(Date.parse(iso), fuso);
  const d2 = (n: number) => String(n).padStart(2, "0");
  return `${p.ano}${d2(p.mes + 1)}${d2(p.dia)}T${d2(p.hora)}${d2(p.minuto)}00`;
}

/**
 * Evento (recorrente, se for o caso) de um compromisso ou bloqueio. Ocorrências canceladas
 * viram EXDATE. Ocorrências mudadas só num dia ficam para a sincronização real (6.6), que
 * as manda como instâncias alteradas.
 */
export function eventoDoCompromisso(c: Compromisso): EventoGoogle {
  const recurrence: string[] = [];
  if (c.recorrencia) {
    lerRegra(c.recorrencia); // valida
    recurrence.push(`RRULE:${c.recorrencia}`);
    const p = partesNoFuso(Date.parse(c.inicio), c.fuso);
    for (const e of c.excecoes.filter((x) => x.cancelado)) {
      const [a, m, d] = e.data.split("-").map(Number) as [number, number, number];
      const original = new Date(Date.UTC(a, m - 1, d, p.hora, p.minuto)).toISOString();
      // A hora de parede é a mesma da série; monta direto, sem passar por UTC.
      recurrence.push(`EXDATE;TZID=${c.fuso}:${horaLocalCompacta(original, "UTC")}`);
    }
  }
  return {
    summary: c.titulo,
    description: DESCRICAO,
    start: { dateTime: c.inicio, timeZone: c.fuso },
    end: { dateTime: fim(c.inicio, c.duracaoMin), timeZone: c.fuso },
    visibility: "private",
    transparency: "opaque",
    ...(recurrence.length ? { recurrence } : {}),
    extendedProperties: { private: { consultorioOrigem: "compromisso", consultorioId: c.id } },
  };
}
