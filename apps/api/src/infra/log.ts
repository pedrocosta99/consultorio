/**
 * Logs estruturados: uma linha JSON por evento (o Cloud Logging lê assim).
 *
 * SIGILO: nunca registre corpo de requisição, query, nomes, notas ou ids de pacientes.
 * As rotas entram pelo padrão ("/pacientes/:id"), não pelo caminho com o id.
 */
type Nivel = "info" | "aviso" | "erro";
type Campo = string | number | boolean | null | undefined;

export function log(nivel: Nivel, msg: string, campos: Record<string, Campo> = {}) {
  const linha = JSON.stringify({ ts: new Date().toISOString(), nivel, msg, ...campos });
  if (nivel === "erro") console.error(linha);
  else if (!process.env.VITEST) console.log(linha);
}
