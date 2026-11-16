/**
 * Geração de sessões a partir da grade fixa (contratos). Função pura: recebe os
 * contratos, o intervalo e os feriados e devolve as vagas. Quem chama decide o que
 * já existe (a unicidade contrato+vaga no banco impede duplicar).
 */
import { instanteDeParede, type Dinheiro } from "@consultorio/shared";

export interface ContratoGrade {
  id: string;
  pacienteId: string;
  diasSemana: number[];
  horario: string;
  horariosDia?: Record<string, string> | null;
  duracaoMin: number;
  valor: Dinheiro;
  vigenteDe: string;
  vigenteAte: string | null;
}

export interface VagaGerada {
  contratoId: string;
  pacienteId: string;
  /** "yyyy-MM-dd#dia" — identifica a vaga mesmo depois de remarcada. */
  vaga: string;
  inicio: string;
  duracaoMin: number;
  valor: Dinheiro;
}

/** Soma dias a uma data civil "yyyy-MM-dd" (aritmética em UTC, imune a horário de verão). */
export function somarDias(data: string, dias: number): string {
  const [a, m, d] = data.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
}

/** 1 = segunda … 7 = domingo. */
export function diaDaSemanaIso(data: string): number {
  const [a, m, d] = data.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay() || 7;
}

export function gerarVagas(
  contrato: ContratoGrade,
  opcoes: { de: string; ate: string; feriados: ReadonlySet<string>; fuso: string },
): VagaGerada[] {
  const inicio = contrato.vigenteDe > opcoes.de ? contrato.vigenteDe : opcoes.de;
  const fim = contrato.vigenteAte && contrato.vigenteAte < opcoes.ate ? contrato.vigenteAte : opcoes.ate;
  const dias = new Set(contrato.diasSemana);
  const vagas: VagaGerada[] = [];
  for (let data = inicio; data <= fim; data = somarDias(data, 1)) {
    const dia = diaDaSemanaIso(data);
    if (!dias.has(dia) || opcoes.feriados.has(data)) continue;
    const [a, m, d] = data.split("-").map(Number) as [number, number, number];
    const [hh, mm] = horarioDoDia(contrato, dia).split(":").map(Number) as [number, number];
    vagas.push({
      contratoId: contrato.id,
      pacienteId: contrato.pacienteId,
      vaga: `${data}#${dia}`,
      inicio: new Date(instanteDeParede(a, m - 1, d, hh, mm, opcoes.fuso)).toISOString(),
      duracaoMin: contrato.duracaoMin,
      valor: contrato.valor,
    });
  }
  return vagas;
}

/** Horário de um dia da grade: o próprio do dia, se houver, ou o geral. */
export function horarioDoDia(c: Pick<ContratoGrade, "horario" | "horariosDia">, dia: number): string {
  return c.horariosDia?.[String(dia)] ?? c.horario;
}

export interface GradeSemanal {
  diasSemana: number[];
  horario: string;
  horariosDia: Record<string, string> | null;
}

/**
 * "Esta e as seguintes": a vaga do dia `diaAntigo` passa para `diaNovo` às `horarioNovo`.
 * Os outros dias mantêm o horário que tinham. Se todos ficarem no mesmo horário, some o
 * `horariosDia`. Se o novo dia já existia na grade, ele passa a valer no novo horário.
 */
export function moverVagaDaGrade(
  c: Pick<ContratoGrade, "diasSemana" | "horario" | "horariosDia">,
  diaAntigo: number,
  diaNovo: number,
  horarioNovo: string,
): GradeSemanal {
  const porDia = new Map<number, string>();
  for (const d of c.diasSemana) if (d !== diaAntigo) porDia.set(d, horarioDoDia(c, d));
  porDia.set(diaNovo, horarioNovo);
  const diasSemana = [...porDia.keys()].sort((a, b) => a - b);
  const contagem = new Map<string, number>();
  for (const h of porDia.values()) contagem.set(h, (contagem.get(h) ?? 0) + 1);
  // O horário geral é o mais comum (empate: o do primeiro dia).
  const horario = [...contagem.entries()].sort((a, b) => b[1] - a[1] || (a[0] === porDia.get(diasSemana[0]!) ? -1 : 1))[0]![0];
  const proprios = Object.fromEntries([...porDia.entries()].filter(([, h]) => h !== horario).map(([d, h]) => [String(d), h]));
  return { diasSemana, horario, horariosDia: Object.keys(proprios).length ? proprios : null };
}
