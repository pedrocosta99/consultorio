import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { abrirBanco } from "./db/conexao";
import { semearFicticio } from "./seed";
import { gerarProntuario } from "./prontuario";
import { criarNota } from "./servico";

const AGORA = new Date("2026-11-04T17:30:00Z");

describe("prontuário em PDF", () => {
  const { db } = abrirBanco(":memory:");
  semearFicticio(db, AGORA);
  criarNota(db, { pacienteId: "p07", texto: "Registro com acentuação: ação, mãe, “aspas” e emoji 🌿", natureza: "documental" });
  criarNota(db, { pacienteId: "p07", texto: "SEGREDO-PESSOAL", natureza: "pessoal" });

  it("gera um PDF válido, com título e páginas numeradas", async () => {
    const bytes = await gerarProntuario(db, "p07", { pessoais: false, agora: AGORA });
    expect(Buffer.from(bytes.subarray(0, 5)).toString()).toBe("%PDF-");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getTitle()).toBe("Prontuário — Lírio de Itu");
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it("anotações pessoais só entram quando pedidas", async () => {
    const semPessoais = await gerarProntuario(db, "p07", { pessoais: false, agora: AGORA });
    const comPessoais = await gerarProntuario(db, "p07", { pessoais: true, agora: AGORA });
    expect(comPessoais.length).toBeGreaterThan(semPessoais.length);
  });

  it("paciente inexistente dá erro", async () => {
    await expect(gerarProntuario(db, "nada", { pessoais: false, agora: AGORA })).rejects.toThrow(/não encontrado/);
  });
});
