import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const pasta = fs.mkdtempSync(path.join(os.tmpdir(), "consultorio-api-"));
process.env.CONSULTORIO_DB = path.join(pasta, "teste.db");
process.env.CONSULTORIO_AGORA = "2026-11-04T17:30:00.000Z";

const { app } = await import("./app");
const { bloquear } = await import("./estado");

let cookie = "";
async function req(metodo: string, rota: string, corpo?: unknown, extra: Record<string, string> = {}) {
  const r = await app.request(`/api${rota}`, {
    method: metodo,
    headers: { host: "127.0.0.1:8787", "x-consultorio": "1", "content-type": "application/json", cookie, ...extra },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const sc = r.headers.get("set-cookie");
  if (sc) cookie = sc.split(";")[0]!;
  return { status: r.status, json: (await r.json()) as any };
}

beforeAll(() => bloquear());
afterAll(() => {
  bloquear();
  fs.rmSync(pasta, { recursive: true, force: true });
});

describe("API", () => {
  it("recusa Host externo e chamadas sem o cabeçalho próprio", async () => {
    expect((await req("GET", "/auth/estado", undefined, { host: "evil.example" })).status).toBe(403);
    expect((await req("GET", "/auth/estado", undefined, { "x-consultorio": "" })).status).toBe(403);
  });

  it("começa sem configuração e bloqueada", async () => {
    const r = await req("GET", "/auth/estado");
    expect(r.json).toMatchObject({ configurado: false, desbloqueado: false });
    expect((await req("GET", "/consultorio")).status).toBe(401);
  });

  it("senha curta é recusada; configurar com dados fictícios desbloqueia", async () => {
    expect((await req("POST", "/auth/configurar", { senha: "123" })).status).toBe(400);
    const r = await req("POST", "/auth/configurar", { senha: "senha-de-teste", ficticio: true });
    expect(r.status).toBe(200);
    const c = await req("GET", "/consultorio");
    expect(c.status).toBe(200);
    expect(c.json.pacientes.length).toBeGreaterThan(3);
    expect(c.json.agora).toBe("2026-11-04T17:30:00.000Z");
  });

  it("bloquear fecha; senha errada dá 401; certa reabre", async () => {
    await req("POST", "/auth/bloquear");
    expect((await req("GET", "/consultorio")).status).toBe(401);
    expect((await req("POST", "/auth/desbloquear", { senha: "errada" })).status).toBe(401);
    expect((await req("POST", "/auth/desbloquear", { senha: "senha-de-teste" })).status).toBe(200);
    expect((await req("GET", "/consultorio")).status).toBe(200);
  });

  it("cria paciente e contrato e as sessões aparecem", async () => {
    const p = await req("POST", "/pacientes", {
      nome: "Novo Paciente",
      apelido: "N.P.",
      origem: "particular",
      modalidade: "online",
      status: "ativo",
      inicioEm: "2026-11-04",
      fuso: "America/Sao_Paulo",
    });
    expect(p.status).toBe(200);
    const k = await req("POST", `/pacientes/${p.json.id}/contratos`, {
      diasSemana: [5],
      horario: "13:00",
      duracaoMin: 50,
      valor: { centavos: 20000, moeda: "BRL" },
      cobranca: "sessao",
      vigenteDe: "2026-11-04",
    });
    expect(k.status).toBe(200);
    const c = await req("GET", "/consultorio");
    const minhas = c.json.sessoes.filter((s: any) => s.pacienteId === p.json.id);
    expect(minhas).toHaveLength(8);
    expect(minhas[0].inicio).toBe("2026-11-06T16:00:00.000Z");
  });

  it("erros de validação voltam em português", async () => {
    const r = await req("POST", "/pacientes", { nome: "", apelido: "x" });
    expect(r.status).toBe(400);
    expect(r.json.erro).toMatch(/nome/i);
  });
});
