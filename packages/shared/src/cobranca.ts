/**
 * Fechamento do mês, sessões esquecidas e mensagens prontas (cobrança, lembrete).
 * Regras puras: sem relógio implícito, sem formatação de tela.
 */
import { z } from "zod";
import { chaveDiaNoFuso } from "./fuso";
import { MOEDAS, type Dinheiro, type Moeda } from "./money";
import { sessaoCobravel, type Sessao } from "./types";

// ── Textos configuráveis ─────────────────────────────────────

export const mensagensSchema = z.object({
  /** Chave Pix que entra na mensagem de cobrança. */
  chavePix: z.string().trim().max(120),
  /** Variáveis: {nome} {mes} {qtd} {lista} {total} {pix} */
  modeloCobranca: z.string().max(2000),
  /** Variáveis: {nome} {dia} {hora} */
  modeloLembrete: z.string().max(1000),
  /** Modelo inserido numa nota de registro documental. */
  modeloNota: z.string().max(2000),
});
export type Mensagens = z.infer<typeof mensagensSchema>;

export const MENSAGENS_PADRAO: Mensagens = {
  chavePix: "",
  modeloCobranca:
    "Olá, {nome}! Segue o fechamento de {mes}:\n{lista}\nTotal: {total}.\n{pix}\nQualquer dúvida, me avise. Obrigada!",
  modeloLembrete: "Olá, {nome}! Passando para lembrar da nossa sessão {dia}, às {hora}. Até lá!",
  // Itens do registro documental (Resolução CFP 001/2009, art. 2º).
  modeloNota: "**Evolução:** \n\n**Procedimentos / intervenções:** \n\n**Encaminhamentos:** ",
};

/** Troca {variavel} pelo valor. Variáveis desconhecidas ficam como estão. */
export function preencherModelo(modelo: string, vars: Record<string, string>): string {
  return modelo.replace(/\{(\w+)\}/g, (inteiro, chave: string) => (chave in vars ? vars[chave]! : inteiro));
}

// ── Fechamento do mês ────────────────────────────────────────

function somarPorMoeda(valores: Dinheiro[]): Dinheiro[] {
  const mapa = new Map<Moeda, number>();
  for (const v of valores) mapa.set(v.moeda, (mapa.get(v.moeda) ?? 0) + v.centavos);
  return MOEDAS.filter((m) => mapa.has(m)).map((m) => ({ moeda: m, centavos: mapa.get(m)! }));
}

export interface Fechamento {
  pacienteId: string;
  /** Sessões cobráveis do mês (realizadas e faltas cobradas), em ordem. */
  sessoes: Sessao[];
  total: Dinheiro[];
  pago: Dinheiro[];
  aberto: Dinheiro[];
}

/**
 * Fechamento de um mês ("yyyy-MM") por paciente. O dia de cada sessão é o do
 * fuso do consultório. Só entra quem tem sessão cobrável no mês.
 */
export function fechamentoDoMes(sessoes: Sessao[], mes: string, fuso: string): Fechamento[] {
  const porPaciente = new Map<string, Sessao[]>();
  for (const s of sessoes) {
    if (!sessaoCobravel(s.estado)) continue;
    if (!chaveDiaNoFuso(Date.parse(s.inicio), fuso).startsWith(mes)) continue;
    porPaciente.set(s.pacienteId, [...(porPaciente.get(s.pacienteId) ?? []), s]);
  }
  return [...porPaciente.entries()].map(([pacienteId, lista]) => {
    const ordenadas = [...lista].sort((a, b) => a.inicio.localeCompare(b.inicio));
    return {
      pacienteId,
      sessoes: ordenadas,
      total: somarPorMoeda(ordenadas.map((s) => s.valor)),
      pago: somarPorMoeda(ordenadas.filter((s) => s.pago).map((s) => s.valor)),
      aberto: somarPorMoeda(ordenadas.filter((s) => !s.pago).map((s) => s.valor)),
    };
  });
}

// ── Sessões esquecidas e pacientes sumidos ───────────────────

/**
 * Sessões que já terminaram e continuam "agendadas" (ninguém marcou o que houve),
 * dos últimos `dias` dias. Mais antigas primeiro.
 */
export function sessoesSemRegistro(sessoes: Sessao[], agora: Date, dias = 60): Sessao[] {
  const desde = agora.getTime() - dias * 86_400_000;
  return sessoes
    .filter((s) => {
      if (s.estado !== "agendada") return false;
      const inicio = Date.parse(s.inicio);
      return inicio >= desde && inicio + s.duracaoMin * 60_000 <= agora.getTime();
    })
    .sort((a, b) => a.inicio.localeCompare(b.inicio));
}

/** Instante da última sessão realizada do paciente (ou undefined). */
export function ultimaRealizada(sessoes: Sessao[], pacienteId: string, agora: Date): string | undefined {
  let ultima: string | undefined;
  for (const s of sessoes) {
    if (s.pacienteId !== pacienteId || s.estado !== "realizada" || Date.parse(s.inicio) > agora.getTime()) continue;
    if (!ultima || s.inicio > ultima) ultima = s.inicio;
  }
  return ultima;
}
