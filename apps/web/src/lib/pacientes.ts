import type { Contrato, Paciente } from "@consultorio/shared";

const DIAS = ["", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const DIAS_LONGOS = ["", "segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"];

/** "Seg e Qui · 08:00" */
export function descreverGrade(c: Contrato | undefined): string {
  if (!c) return "Sem horário fixo";
  const dias = c.diasSemana.map((d) => DIAS[d]);
  const lista = dias.length > 1 ? `${dias.slice(0, -1).join(", ")} e ${dias.at(-1)}` : dias[0];
  return `${lista} · ${c.horario}`;
}

/** "1x por semana, às segundas" */
export function descreverFrequencia(c: Contrato): string {
  const dias = c.diasSemana.map((d) => DIAS_LONGOS[d] + "s");
  const lista = dias.length > 1 ? `${dias.slice(0, -1).join(", ")} e ${dias.at(-1)}` : dias[0];
  return `${c.frequencia}x por semana, às ${lista}`;
}

/**
 * Contrato vigente do paciente: o que cobre hoje; se não houver, o próximo a começar
 * (ex.: reajuste agendado) ou o último sem data de fim.
 */
export function contratoVigente(contratos: Contrato[], pacienteId: string, hoje = new Date().toISOString().slice(0, 10)): Contrato | undefined {
  const dele = contratos.filter((c) => c.pacienteId === pacienteId);
  return (
    dele.find((c) => c.vigenteDe <= hoje && (c.vigenteAte === null || c.vigenteAte >= hoje)) ??
    dele.find((c) => c.vigenteDe > hoje) ??
    dele.find((c) => c.vigenteAte === null)
  );
}

export const ESTILO_STATUS: Record<Paciente["status"], string> = {
  ativo: "border-[var(--st-realizada-bd)] text-[var(--st-realizada-fg)] bg-[var(--st-realizada-bg)]",
  pausa: "border-[var(--st-falta-bd)] text-[var(--st-falta-fg)] bg-[var(--st-falta-bg)]",
  alta: "border-[var(--st-agendada-bd)] text-[var(--st-agendada-fg)] bg-[var(--st-agendada-bg)]",
  interrompido: "border-[var(--st-cancelada-bd)] text-[var(--st-cancelada-fg)] bg-[var(--st-cancelada-bg)]",
};
