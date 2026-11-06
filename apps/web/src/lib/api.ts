/**
 * Cliente da API local. Toda chamada leva o cabeçalho x-consultorio (a API recusa
 * sem ele — é o que impede outros sites de chamarem a API).
 */
export class ErroApi extends Error {
  constructor(
    public status: number,
    mensagem: string,
  ) {
    super(mensagem);
  }
}

export async function api<T = { ok: true }>(metodo: "GET" | "POST" | "PATCH" | "PUT" | "DELETE", rota: string, corpo?: unknown): Promise<T> {
  let r: Response;
  try {
    r = await fetch(`/api${rota}`, {
      method: metodo,
      headers: { "x-consultorio": "1", ...(corpo !== undefined ? { "content-type": "application/json" } : {}) },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
  } catch {
    throw new ErroApi(0, "Não consegui falar com a API local. Ela está rodando (pnpm dev)?");
  }
  const dados = (await r.json().catch(() => ({}))) as { erro?: string };
  if (!r.ok) {
    throw new ErroApi(r.status, dados.erro ?? `Erro ${r.status}`);
  }
  return dados as T;
}

/** Baixa um arquivo da API (ex.: PDF) e oferece para salvar. */
export async function baixar(rota: string, nomeArquivo: string): Promise<void> {
  const r = await fetch(`/api${rota}`, { headers: { "x-consultorio": "1" } });
  if (!r.ok) {
    const dados = (await r.json().catch(() => ({}))) as { erro?: string };
    throw new ErroApi(r.status, dados.erro ?? `Erro ${r.status}`);
  }
  const url = URL.createObjectURL(await r.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
