import { MOEDAS, type Dinheiro, type Moeda } from "./money";
import { sessaoCobravel, type EstadoSessao } from "./types";

/**
 * Saldo do paciente por moeda: sessões cobráveis − pagamentos recebidos.
 * Positivo = o paciente deve; negativo = crédito (pagou adiantado). Moedas nunca se misturam.
 * Só sessões que já começaram contam (uma sessão agendada no futuro não é devida).
 */
export function saldoPorMoeda(
  sessoes: Array<{ estado: EstadoSessao; valor: Dinheiro; inicio: string }>,
  pagamentos: Array<{ valor: Dinheiro }>,
  agora: Date,
): Dinheiro[] {
  const mapa = new Map<Moeda, number>();
  const somar = (v: Dinheiro, sinal: 1 | -1) => mapa.set(v.moeda, (mapa.get(v.moeda) ?? 0) + sinal * v.centavos);
  for (const s of sessoes) {
    if (sessaoCobravel(s.estado) && Date.parse(s.inicio) <= agora.getTime()) somar(s.valor, 1);
  }
  for (const p of pagamentos) somar(p.valor, -1);
  return MOEDAS.filter((m) => (mapa.get(m) ?? 0) !== 0).map((m) => ({ moeda: m, centavos: mapa.get(m)! }));
}
