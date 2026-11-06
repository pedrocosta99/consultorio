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
  const [hh, mm] = contrato.horario.split(":").map(Number) as [number, number];
  const dias = new Set(contrato.diasSemana);
  const vagas: VagaGerada[] = [];
  for (let data = inicio; data <= fim; data = somarDias(data, 1)) {
    const dia = diaDaSemanaIso(data);
    if (!dias.has(dia) || opcoes.feriados.has(data)) continue;
    const [a, m, d] = data.split("-").map(Number) as [number, number, number];
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
