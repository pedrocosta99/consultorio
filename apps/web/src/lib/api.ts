/**
 * Cliente da API local. Toda chamada leva o cabeçalho x-consultorio (a API recusa
 * sem ele) e o cookie de sessão. 401 → o app volta para a tela de senha.
 */
export class ErroApi extends Error {
  constructor(
    public status: number,
    mensagem: string,
  ) {
    super(mensagem);
  }
}

export const EVENTO_BLOQUEIO = "consultorio:bloqueado";

export async function api<T = { ok: true }>(metodo: "GET" | "POST" | "PATCH" | "DELETE", rota: string, corpo?: unknown): Promise<T> {
  let r: Response;
  try {
    r = await fetch(`/api${rota}`, {
      method: metodo,
      credentials: "same-origin",
      headers: { "x-consultorio": "1", ...(corpo !== undefined ? { "content-type": "application/json" } : {}) },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
  } catch {
    throw new ErroApi(0, "Não consegui falar com a API local. Ela está rodando (pnpm dev)?");
  }
  const dados = (await r.json().catch(() => ({}))) as { erro?: string };
  if (!r.ok) {
    if (r.status === 401 && !rota.startsWith("/auth/")) window.dispatchEvent(new Event(EVENTO_BLOQUEIO));
    throw new ErroApi(r.status, dados.erro ?? `Erro ${r.status}`);
  }
  return dados as T;
}
