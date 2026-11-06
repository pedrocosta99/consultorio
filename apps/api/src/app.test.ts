import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const pasta = fs.mkdtempSync(path.join(os.tmpdir(), "consultorio-api-"));
process.env.CONSULTORIO_DB = path.join(pasta, "teste.db");
process.env.CONSULTORIO_AGORA = "2026-11-04T17:30:00.000Z";

const { app } = await import("./app");
const { fecharBanco } = await import("./estado");

async function req(metodo: string, rota: string, corpo?: unknown, extra: Record<string, string> = {}) {
  const r = await app.request(`/api${rota}`, {
    method: metodo,
    headers: { host: "127.0.0.1:8787", "x-consultorio": "1", "content-type": "application/json", ...extra },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  return { status: r.status, json: (await r.json()) as any };
}

beforeAll(() => fecharBanco());
afterAll(() => {
  fecharBanco();
  fs.rmSync(pasta, { recursive: true, force: true });
});

describe("API", () => {
  it("recusa Host externo e chamadas sem o cabeçalho próprio", async () => {
    expect((await req("GET", "/consultorio", undefined, { host: "evil.example" })).status).toBe(403);
    expect((await req("GET", "/consultorio", undefined, { "x-consultorio": "" })).status).toBe(403);
  });

  it("abre direto, sem PIN: banco novo vazio com uma conta em reais", async () => {
    const c = await req("GET", "/consultorio");
    expect(c.status).toBe(200);
    expect(c.json.pacientes).toEqual([]);
    expect(c.json.contas.map((x: any) => x.moeda)).toEqual(["BRL"]);
    expect(c.json.moedas).toEqual(["BRL"]);
    expect(c.json.agora).toBe("2026-11-04T17:30:00.000Z");
  });

  it("carrega os dados fictícios só com o banco vazio", async () => {
    expect((await req("POST", "/dados-ficticios")).status).toBe(200);
    const c = await req("GET", "/consultorio");
    expect(c.json.pacientes.length).toBeGreaterThan(3);
    expect((await req("POST", "/dados-ficticios")).status).toBe(409);
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

  it("backup: exporta cifrado e importa de volta", async () => {
    const pastaBackup = fs.mkdtempSync(path.join(os.tmpdir(), "consultorio-backup-"));
    expect((await req("POST", "/backup/exportar", { pasta: pastaBackup, senha: "curta" })).status).toBe(400);
    const ex = await req("POST", "/backup/exportar", { pasta: pastaBackup, senha: "frase longa de backup" });
    expect(ex.status).toBe(200);
    const bruto = fs.readFileSync(path.join(pastaBackup, ex.json.arquivo));
    expect(bruto.includes(Buffer.from("SQLite format 3"))).toBe(false);

    // Muda algo depois do backup…
    const antes = (await req("GET", "/consultorio")).json.pacientes.length;
    await req("POST", "/pacientes", { nome: "Depois do Backup", apelido: "D.B.", origem: "particular", modalidade: "online", status: "ativo", inicioEm: "2026-11-04", fuso: "America/Sao_Paulo" });
    expect((await req("GET", "/consultorio")).json.pacientes.length).toBe(antes + 1);

    const lista = await req("GET", `/backup?pasta=${encodeURIComponent(pastaBackup)}`);
    expect(lista.json.snapshots).toHaveLength(1);
    expect((await req("POST", "/backup/importar", { pasta: pastaBackup, arquivo: ex.json.arquivo, senha: "errada" })).status).toBe(400);
    expect((await req("POST", "/backup/importar", { pasta: pastaBackup, arquivo: ex.json.arquivo, senha: "frase longa de backup" })).status).toBe(200);

    // …e a importação volta ao estado do backup.
    expect((await req("GET", "/consultorio")).json.pacientes.length).toBe(antes);
    expect(fs.readdirSync(path.join(pasta, "backups")).length).toBe(1);
    fs.rmSync(pastaBackup, { recursive: true, force: true });
  });

  it("erros de validação voltam em português", async () => {
    const r = await req("POST", "/pacientes", { nome: "", apelido: "x" });
    expect(r.status).toBe(400);
    expect(r.json.erro).toMatch(/nome/i);
  });
});
