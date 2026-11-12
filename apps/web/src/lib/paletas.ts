/**
 * Paletas da cor principal. Cada uma é só um matiz (0–360, OKLCH) e uma
 * intensidade (multiplica o croma da Sálvia). A luminosidade de cada token,
 * no claro e no escuro, fica em `index.css`, então toda paleta já nasce com
 * modo escuro e o mesmo contraste da Sálvia.
 *
 * Para adicionar ou ajustar uma cor, edite a lista abaixo.
 */
export interface Paleta {
  id: string;
  nome: string;
  matiz: number;
  croma: number;
}

export const PALETAS: Paleta[] = [
  { id: "salvia", nome: "Sálvia", matiz: 152, croma: 1 },
  { id: "oliva", nome: "Oliva", matiz: 118, croma: 1.15 },
  { id: "petroleo", nome: "Petróleo", matiz: 200, croma: 1.15 },
  { id: "oceano", nome: "Oceano", matiz: 245, croma: 1.35 },
  { id: "lavanda", nome: "Lavanda", matiz: 295, croma: 1.25 },
  { id: "ameixa", nome: "Ameixa", matiz: 345, croma: 1.3 },
  { id: "terracota", nome: "Terracota", matiz: 40, croma: 1.6 },
  { id: "caramelo", nome: "Caramelo", matiz: 70, croma: 1.3 },
  { id: "grafite", nome: "Grafite", matiz: 250, croma: 0.2 },
];

export const PALETA_PADRAO = PALETAS[0]!;

export const LIMITES_CROMA = { min: 0, max: 2 } as const;

/** Cor principal resultante, para amostras (mesma fórmula de `--primary` no CSS). */
export function amostra(matiz: number, croma: number, tema: "claro" | "escuro"): string {
  return tema === "claro" ? `oklch(0.47 ${0.065 * croma} ${matiz})` : `oklch(0.74 ${0.075 * croma} ${matiz - 2})`;
}
