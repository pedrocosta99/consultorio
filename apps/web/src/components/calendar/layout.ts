/** Lógica pura do calendário (sem React), testada em layout.test.ts. */

export interface Intervalo {
  id: string;
  /** minutos desde 00:00 */
  inicio: number;
  fim: number;
}

export interface Posicao {
  /** coluna (0-based) dentro do grupo de sobrepostos */
  coluna: number;
  /** total de colunas do grupo */
  colunas: number;
}

/**
 * Distribui eventos sobrepostos em colunas lado a lado. Eventos que se tocam
 * só na borda (um termina 10:00, outro começa 10:00) não contam como sobreposição.
 */
export function posicionar(eventos: Intervalo[]): Map<string, Posicao> {
  const ordenados = [...eventos].sort((a, b) => a.inicio - b.inicio || b.fim - a.fim);
  const resultado = new Map<string, Posicao>();

  let grupo: Array<Intervalo & { coluna: number }> = [];
  let fimGrupo = -Infinity;

  const fecharGrupo = () => {
    const colunas = Math.max(1, ...grupo.map((e) => e.coluna + 1));
    for (const e of grupo) resultado.set(e.id, { coluna: e.coluna, colunas });
    grupo = [];
  };

  for (const ev of ordenados) {
    if (ev.inicio >= fimGrupo && grupo.length) {
      fecharGrupo();
      fimGrupo = -Infinity;
    }
    // primeira coluna livre
    const ocupadas = new Set(grupo.filter((g) => g.fim > ev.inicio).map((g) => g.coluna));
    let coluna = 0;
    while (ocupadas.has(coluna)) coluna++;
    grupo.push({ ...ev, coluna });
    fimGrupo = Math.max(fimGrupo, ev.fim);
  }
  if (grupo.length) fecharGrupo();
  return resultado;
}

export const PASSO_MIN = 15;

/** Converte um deslocamento vertical em pixels para minutos, encaixando no passo. */
export function pixelsParaMinutos(dy: number, pxPorMin: number, passo = PASSO_MIN): number {
  const m = Math.round(dy / pxPorMin / passo) * passo;
  return m === 0 ? 0 : m; // evita -0
}

/** Novo horário (minutos) após arrastar, preso ao dia. */
export function novoHorario(inicioMin: number, deltaMin: number, duracaoMin: number): number {
  return Math.min(Math.max(0, inicioMin + deltaMin), 24 * 60 - duracaoMin);
}
