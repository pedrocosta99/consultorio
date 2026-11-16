/**
 * Finanças v0: entradas = pagamentos de pacientes + lançamentos de entrada;
 * saídas = lançamentos de saída. Nada é somado entre moedas.
 */
import { useMemo } from "react";
import { converter, ROTULO_ORIGEM, type Cotacao, type Dinheiro, type Lancamento, type Moeda } from "@consultorio/shared";
import { somarPorMoeda, useDados } from "@/app/dados";
import { usePreferencias } from "@/app/preferencias";

export const CATEGORIA_PACIENTES = "Pacientes";

export interface Movimento {
  id: string;
  data: string;
  tipo: "entrada" | "saida";
  valor: Dinheiro;
  descricao: string;
  categoria: string;
  /** Pagamento de paciente (somente leitura aqui) ou lançamento manual (editável). */
  pacienteId?: string;
  lancamento?: Lancamento;
}

/** Tudo o que entra e sai, mais recente primeiro. */
export function useMovimentos(): Movimento[] {
  const { pagamentos, lancamentos, paciente, nomeExibicao } = useDados();
  return useMemo(() => {
    const ms: Movimento[] = [
      ...pagamentos.map((pg) => ({
        id: pg.id,
        data: pg.data,
        tipo: "entrada" as const,
        valor: pg.valor,
        descricao: nomeExibicao(paciente(pg.pacienteId)),
        categoria: CATEGORIA_PACIENTES,
        pacienteId: pg.pacienteId,
      })),
      ...lancamentos.map((l) => ({ id: l.id, data: l.data, tipo: l.tipo, valor: l.valor, descricao: l.descricao, categoria: l.categoria, lancamento: l })),
    ];
    return ms.sort((a, b) => b.data.localeCompare(a.data) || a.tipo.localeCompare(b.tipo) || a.descricao.localeCompare(b.descricao));
  }, [pagamentos, lancamentos, paciente, nomeExibicao]);
}

export interface ResumoMes {
  mes: string;
  pacientes: Dinheiro[];
  outrasEntradas: Dinheiro[];
  entradas: Dinheiro[];
  saidas: Dinheiro[];
  /** Entradas − saídas, por moeda. */
  resultado: Dinheiro[];
}

export function resumir(movs: Movimento[], mes: string): ResumoMes {
  const doMes = movs.filter((m) => m.data.startsWith(mes));
  const ent = doMes.filter((m) => m.tipo === "entrada");
  const sai = doMes.filter((m) => m.tipo === "saida");
  const saidas = somarPorMoeda(sai.map((m) => m.valor));
  return {
    mes,
    pacientes: somarPorMoeda(ent.filter((m) => m.pacienteId).map((m) => m.valor)),
    outrasEntradas: somarPorMoeda(ent.filter((m) => !m.pacienteId).map((m) => m.valor)),
    entradas: somarPorMoeda(ent.map((m) => m.valor)),
    saidas,
    resultado: somarPorMoeda([...ent.map((m) => m.valor), ...saidas.map((v) => ({ ...v, centavos: -v.centavos }))]),
  };
}

/** Centavos de uma moeda numa lista por moeda (0 se não houver). */
export const emMoeda = (vs: Dinheiro[], moeda: Moeda = "BRL") => vs.find((v) => v.moeda === moeda)?.centavos ?? 0;

/** "yyyy-MM" deslocado em meses. */
export function somarMeses(mes: string, delta: number): string {
  const [a, m] = mes.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(a, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Agrupa somas por uma chave (categoria, origem…), maior primeiro. Só a moeda base
 * (`base`) vira barra; outras moedas aparecem no texto.
 */
export function agrupar(movs: Movimento[], chave: (m: Movimento) => string, base: Moeda = "BRL"): Array<{ nome: string; valores: Dinheiro[]; brl: number }> {
  const grupos = new Map<string, Dinheiro[]>();
  for (const m of movs) grupos.set(chave(m), [...(grupos.get(chave(m)) ?? []), m.valor]);
  return [...grupos.entries()]
    .map(([nome, vs]) => {
      const valores = somarPorMoeda(vs);
      return { nome, valores, brl: emMoeda(valores, base) };
    })
    .sort((a, b) => b.brl - a.brl || a.nome.localeCompare(b.nome));
}

// ── Moeda de exibição ────────────────────────────────────────

/** Moeda para a qual Finanças converte, ou null se o usuário prefere cada moeda separada. */
export function useMoedaExibicao(): Moeda | null {
  const { moedaExibicao } = usePreferencias();
  const { moedas } = useDados();
  return moedaExibicao !== "separada" && moedas.includes(moedaExibicao) ? moedaExibicao : null;
}

/**
 * Converte itens datados para a moeda de exibição. Itens sem cotação ficam na moeda
 * original (e a moeda entra em `semCotacao`, para a tela avisar).
 */
export function converterItens<T extends { valor: Dinheiro; data: string }>(
  itens: T[],
  alvo: Moeda | null,
  cotacoes: readonly Cotacao[],
): { itens: T[]; semCotacao: Moeda[] } {
  if (!alvo) return { itens, semCotacao: [] };
  const faltando = new Set<Moeda>();
  const convertidos = itens.map((x) => {
    const v = converter(x.valor, alvo, x.data, cotacoes);
    if (!v) faltando.add(x.valor.moeda);
    return v ? { ...x, valor: v } : x;
  });
  return { itens: convertidos, semCotacao: [...faltando] };
}

/** Soma valores datados na moeda de exibição (ou por moeda, se separada). */
export function somarNaExibicao(itens: Array<{ valor: Dinheiro; data: string }>, alvo: Moeda | null, cotacoes: readonly Cotacao[]): Dinheiro[] {
  return somarPorMoeda(converterItens(itens, alvo, cotacoes).itens.map((x) => x.valor));
}

/** Movimentos com os valores já na moeda de exibição (para totais e gráficos). */
export function useMovimentosNaExibicao(): { movimentos: Movimento[]; alvo: Moeda | null; base: Moeda; semCotacao: Moeda[] } {
  const movimentos = useMovimentos();
  const alvo = useMoedaExibicao();
  const { cotacoes } = useDados();
  return useMemo(() => {
    const r = converterItens(movimentos, alvo, cotacoes);
    return { movimentos: r.itens, alvo, base: alvo ?? "BRL", semCotacao: r.semCotacao };
  }, [movimentos, alvo, cotacoes]);
}

export const rotuloOrigem = (o: keyof typeof ROTULO_ORIGEM | undefined) => (o ? ROTULO_ORIGEM[o] : "Outros");
