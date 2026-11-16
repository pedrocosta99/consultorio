/**
 * Compromissos (supervisão, análise, folgas…) e a recorrência deles, no formato RRULE
 * do Google Agenda (RFC 5545), num subconjunto suficiente para o consultório:
 * FREQ=DAILY|WEEKLY|MONTHLY, INTERVAL, BYDAY (semanal), UNTIL (data) e COUNT.
 *
 * Tudo é calculado na hora de parede do fuso do compromisso: "toda segunda às 9h"
 * continua às 9h depois de uma mudança de horário de verão.
 */
import { z } from "zod";
import { chaveDiaNoFuso, instanteDeParede, partesNoFuso } from "./fuso";

export const TIPOS_COMPROMISSO = ["compromisso", "bloqueio"] as const;
export type TipoCompromisso = (typeof TIPOS_COMPROMISSO)[number];

/** Sugestões; a categoria aceita texto livre. */
export const CATEGORIAS_COMPROMISSO = ["Supervisão", "Análise pessoal", "Grupo de estudo", "Reunião", "Pessoal", "Outro"] as const;

const dataCivil = z.iso.date();
const instante = z.iso.datetime();

/** Mudança numa ocorrência só ("só este evento"). */
export const excecaoSchema = z.object({
  /** Data civil original da ocorrência (no fuso do compromisso). */
  data: dataCivil,
  cancelado: z.boolean(),
  inicio: instante.nullable().optional(),
  duracaoMin: z.number().int().positive().nullable().optional(),
  titulo: z.string().nullable().optional(),
});
export type Excecao = z.infer<typeof excecaoSchema>;

export const compromissoSchema = z.object({
  id: z.string().min(1),
  tipo: z.enum(TIPOS_COMPROMISSO),
  titulo: z.string(),
  categoria: z.string(),
  /** Início da primeira ocorrência. */
  inicio: instante,
  duracaoMin: z.number().int().positive(),
  fuso: z.string(),
  /** Regra sem o prefixo "RRULE:"; null = não se repete. */
  recorrencia: z.string().nullable(),
  excecoes: z.array(excecaoSchema),
});
export type Compromisso = z.infer<typeof compromissoSchema>;

// ── Regra ────────────────────────────────────────────────────

const DIAS_RRULE = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"] as const;

export interface Regra {
  freq: "DAILY" | "WEEKLY" | "MONTHLY";
  intervalo: number;
  /** 1 = segunda … 7 = domingo (só semanal). Vazio = o dia do início. */
  dias: number[];
  /** Última data civil incluída. */
  ate: string | null;
  /** Número máximo de ocorrências. */
  vezes: number | null;
}

export function lerRegra(rrule: string): Regra {
  const partes = new Map(
    rrule
      .replace(/^RRULE:/, "")
      .split(";")
      .filter(Boolean)
      .map((p) => p.split("=") as [string, string]),
  );
  const freq = partes.get("FREQ");
  if (freq !== "DAILY" && freq !== "WEEKLY" && freq !== "MONTHLY") throw new Error(`Recorrência não suportada: ${rrule}`);
  const until = partes.get("UNTIL");
  return {
    freq,
    intervalo: Math.max(1, Number(partes.get("INTERVAL") ?? 1)),
    dias: (partes.get("BYDAY") ?? "")
      .split(",")
      .filter(Boolean)
      .map((d) => DIAS_RRULE.indexOf(d as (typeof DIAS_RRULE)[number]) + 1)
      .filter((d) => d > 0)
      .sort((a, b) => a - b),
    ate: until ? `${until.slice(0, 4)}-${until.slice(4, 6)}-${until.slice(6, 8)}` : null,
    vezes: partes.has("COUNT") ? Number(partes.get("COUNT")) : null,
  };
}

export function escreverRegra(r: Regra): string {
  const p = [`FREQ=${r.freq}`];
  if (r.intervalo > 1) p.push(`INTERVAL=${r.intervalo}`);
  if (r.freq === "WEEKLY" && r.dias.length) p.push(`BYDAY=${r.dias.map((d) => DIAS_RRULE[d - 1]).join(",")}`);
  if (r.ate) p.push(`UNTIL=${r.ate.replaceAll("-", "")}`);
  else if (r.vezes) p.push(`COUNT=${r.vezes}`);
  return p.join(";");
}

const NOMES_DIA = ["segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"];

function lista(itens: string[]): string {
  return itens.length <= 1 ? (itens[0] ?? "") : `${itens.slice(0, -1).join(", ")} e ${itens.at(-1)}`;
}

/** "Toda semana na segunda e quarta", "A cada 2 semanas na terça", "Todo mês no dia 5"… */
export function descreverRecorrencia(rrule: string | null, inicio: string, fuso: string): string {
  if (!rrule) return "Não se repete";
  const r = lerRegra(rrule);
  const p = partesNoFuso(Date.parse(inicio), fuso);
  let texto: string;
  if (r.freq === "DAILY") texto = r.intervalo === 1 ? "Todo dia" : `A cada ${r.intervalo} dias`;
  else if (r.freq === "MONTHLY") texto = `${r.intervalo === 1 ? "Todo mês" : `A cada ${r.intervalo} meses`} no dia ${p.dia}`;
  else {
    const dias = r.dias.length ? r.dias : [diaIso(chaveDiaNoFuso(Date.parse(inicio), fuso))];
    const nomes = lista(dias.map((d) => NOMES_DIA[d - 1]!));
    texto = r.intervalo === 1 ? `Toda semana ${dias.length > 1 || dias[0]! < 6 ? "na" : "no"} ${nomes}` : `A cada ${r.intervalo} semanas ${dias[0]! < 6 ? "na" : "no"} ${nomes}`;
  }
  if (r.ate) texto += `, até ${r.ate.slice(8, 10)}/${r.ate.slice(5, 7)}/${r.ate.slice(0, 4)}`;
  else if (r.vezes) texto += `, ${r.vezes} vezes`;
  return texto;
}

// ── Datas civis ──────────────────────────────────────────────

export function somarDiasCivil(data: string, dias: number): string {
  const [a, m, d] = data.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
}

/** 1 = segunda … 7 = domingo. */
export function diaIso(data: string): number {
  const [a, m, d] = data.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay() || 7;
}

function diasEntre(a: string, b: string): number {
  return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86_400_000);
}

function mesesEntre(a: string, b: string): number {
  return (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + Number(b.slice(5, 7)) - Number(a.slice(5, 7));
}

/** Datas civis em que a regra cai, a partir da data inicial, até `fim` (inclusive). */
export function datasDaRegra(rrule: string, dataInicial: string, fim: string): string[] {
  const r = lerRegra(rrule);
  const limite = r.ate && r.ate < fim ? r.ate : fim;
  const datas: string[] = [];
  const diaInicial = Number(dataInicial.slice(8, 10));
  const dias = new Set(r.freq === "WEEKLY" && r.dias.length ? r.dias : [diaIso(dataInicial)]);
  // A semana da regra começa na segunda da semana inicial.
  const segundaInicial = somarDiasCivil(dataInicial, 1 - diaIso(dataInicial));
  for (let d = dataInicial; d <= limite; d = somarDiasCivil(d, 1)) {
    let cai = false;
    if (r.freq === "DAILY") cai = diasEntre(dataInicial, d) % r.intervalo === 0;
    else if (r.freq === "WEEKLY") cai = dias.has(diaIso(d)) && Math.floor(diasEntre(segundaInicial, d) / 7) % r.intervalo === 0;
    else cai = Number(d.slice(8, 10)) === diaInicial && mesesEntre(dataInicial, d) % r.intervalo === 0;
    if (cai) {
      datas.push(d);
      if (r.vezes && datas.length >= r.vezes) break;
    }
  }
  return datas;
}

// ── Ocorrências ──────────────────────────────────────────────

export interface Ocorrencia {
  compromissoId: string;
  /** Data civil original (identifica a ocorrência para exceções). */
  data: string;
  inicio: string;
  duracaoMin: number;
  titulo: string;
  tipo: TipoCompromisso;
  categoria: string;
  recorrente: boolean;
  /** Foi mudada só nesta ocorrência. */
  alterada: boolean;
}

/**
 * Ocorrências de um compromisso que começam entre `de` e `ate` (datas civis no fuso
 * do compromisso, inclusive), já com as exceções aplicadas e as canceladas fora.
 */
export function ocorrencias(c: Compromisso, de: string, ate: string): Ocorrencia[] {
  const inicioMs = Date.parse(c.inicio);
  const dataInicial = chaveDiaNoFuso(inicioMs, c.fuso);
  const p = partesNoFuso(inicioMs, c.fuso);
  const excecoes = new Map(c.excecoes.map((e) => [e.data, e]));
  // Exceções podem trazer uma ocorrência de fora do intervalo para dentro: olha uma semana a mais.
  const datas = c.recorrencia ? datasDaRegra(c.recorrencia, dataInicial, somarDiasCivil(ate, 7)) : [dataInicial];
  const resultado: Ocorrencia[] = [];
  for (const data of datas) {
    const e = excecoes.get(data);
    if (e?.cancelado) continue;
    const [a, m, d] = data.split("-").map(Number) as [number, number, number];
    const inicio = e?.inicio ?? new Date(instanteDeParede(a, m - 1, d, p.hora, p.minuto, c.fuso)).toISOString();
    const dia = chaveDiaNoFuso(Date.parse(inicio), c.fuso);
    if (dia < de || dia > ate) continue;
    resultado.push({
      compromissoId: c.id,
      data,
      inicio,
      duracaoMin: e?.duracaoMin ?? c.duracaoMin,
      titulo: e?.titulo ?? c.titulo,
      tipo: c.tipo,
      categoria: c.categoria,
      recorrente: !!c.recorrencia,
      alterada: !!e,
    });
  }
  return resultado.sort((x, y) => x.inicio.localeCompare(y.inicio));
}

/**
 * "Este e os seguintes" num compromisso semanal: a regra nova troca o dia da ocorrência
 * movida pelo dia novo (como no Google). Para diário/mensal a regra não muda.
 */
export function regraMovida(rrule: string, diaAntigo: number, diaNovo: number): string {
  const r = lerRegra(rrule);
  if (r.freq !== "WEEKLY" || diaAntigo === diaNovo) return rrule;
  const dias = new Set(r.dias.length ? r.dias : [diaAntigo]);
  dias.delete(diaAntigo);
  dias.add(diaNovo);
  return escreverRegra({ ...r, dias: [...dias].sort((a, b) => a - b) });
}

/** A regra encerrada na véspera de `data` (o que sobra da série antiga). */
export function regraAte(rrule: string, data: string): string {
  return escreverRegra({ ...lerRegra(rrule), ate: somarDiasCivil(data, -1), vezes: null });
}
