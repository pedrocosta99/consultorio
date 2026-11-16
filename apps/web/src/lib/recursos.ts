/**
 * Recursos da API que o web carrega (um por consulta) e o que cada gravação afeta.
 * Puro, sem React: testado em recursos.test.ts.
 */
import type { PacoteConsultorio } from "@consultorio/shared";

export type Listas = Omit<PacoteConsultorio, "agora" | "moedas" | "mensagens" | "horarioAtendimento">;
export type Recurso = keyof Listas;

export const RECURSOS: Recurso[] = ["pacientes", "contratos", "sessoes", "pagamentos", "contas", "feriados", "notas", "lancamentos", "compromissos", "cotacoes"];
const TODOS: Array<Recurso | "configuracoes"> = ["configuracoes", ...RECURSOS];

/** O que cada rota de gravação muda (o resto não é recarregado). */
const AFETA: Array<[RegExp, Array<Recurso | "configuracoes">]> = [
  [/^\/sessoes/, ["sessoes", "pagamentos", "contratos"]],
  [/^\/pagamentos/, ["pagamentos", "sessoes"]],
  [/^\/(pacientes\/[^/]+\/contratos|contratos)/, ["contratos", "sessoes"]],
  [/^\/pacientes/, ["pacientes", "contratos", "sessoes", "pagamentos", "notas"]],
  [/^\/notas/, ["notas"]],
  [/^\/feriados/, ["feriados", "sessoes"]],
  [/^\/contas/, ["contas"]],
  [/^\/configuracoes/, ["configuracoes"]],
  [/^\/lancamentos/, ["lancamentos"]],
  [/^\/compromissos/, ["compromissos"]],
  [/^\/cotacoes/, ["cotacoes"]],
];

export function recursosAfetados(rota: string): Array<Recurso | "configuracoes"> {
  return AFETA.find(([re]) => re.test(rota))?.[1] ?? TODOS; // desconhecida (backup, fictícios…): tudo
}

