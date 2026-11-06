import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const pasta = fs.mkdtempSync(path.join(os.tmpdir(), "consultorio-cifra-"));
process.env.CONSULTORIO_DB = path.join(pasta, "antigo.db");

const { abrirBanco, arquivoEmClaro } = await import("./db/conexao");
const { desbloquear, bloquear } = await import("./estado");
const { hashSenha } = await import("./infra/senha");
const { criarPaciente } = await import("./servico");
const t = await import("./db/schema");

afterAll(() => {
  bloquear();
  fs.rmSync(pasta, { recursive: true, force: true });
});

describe("migração de banco em claro para SQLCipher", () => {
  it("o primeiro desbloqueio cifra o arquivo sem perder dados", async () => {
    // Banco "da Etapa 1": em claro, com hash do PIN.
    const b = abrirBanco(process.env.CONSULTORIO_DB!);
    b.db.insert(t.metaSistema).values({ chave: "senha_hash", valor: hashSenha("246810") }).run();
    criarPaciente(b.db, { nome: "Paciente Antigo", apelido: "P.A.", origem: "particular", modalidade: "online", status: "ativo", inicioEm: "2026-01-01", fuso: "America/Sao_Paulo" });
    b.sqlite.close();
    expect(arquivoEmClaro(process.env.CONSULTORIO_DB!)).toBe(true);

    await expect(desbloquear("000000")).rejects.toThrow(/PIN incorreto/);
    expect(arquivoEmClaro(process.env.CONSULTORIO_DB!)).toBe(true); // PIN errado não mexe no arquivo

    await desbloquear("246810");
    bloquear();
    expect(arquivoEmClaro(process.env.CONSULTORIO_DB!)).toBe(false);
    expect(fs.readFileSync(process.env.CONSULTORIO_DB!).includes(Buffer.from("Paciente Antigo"))).toBe(false);

    // Abre de novo com o PIN e os dados estão lá.
    expect(() => abrirBanco(process.env.CONSULTORIO_DB!, "999999")).toThrow(/PIN incorreto/);
    const de = abrirBanco(process.env.CONSULTORIO_DB!, "246810");
    expect(de.db.select().from(t.pacientes).all().map((p) => p.nome)).toEqual(["Paciente Antigo"]);
    de.sqlite.close();
  }, 30_000);
});
