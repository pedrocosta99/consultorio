import { describe, expect, it } from "vitest";
import { cifrar, decifrar, lerCabecalho, SenhaOuArquivoInvalido } from "./cofre";

const META = { versaoEsquema: "0000", dispositivoId: "abc", criadoEm: "2026-11-04T17:30:00.000Z" };
const BANCO = Buffer.from("SQLite format 3\0".padEnd(4096, "x"));

describe("cofre (snapshot cifrado)", () => {
  it("ida e volta com a senha certa", () => {
    const arq = cifrar(BANCO, "senha certa", META);
    const { banco, meta } = decifrar(arq, "senha certa");
    expect(banco.equals(BANCO)).toBe(true);
    expect(meta).toMatchObject({ ...META, bytes: BANCO.length });
  });

  it("não guarda o conteúdo em claro", () => {
    expect(cifrar(BANCO, "s", META).includes(Buffer.from("SQLite format 3"))).toBe(false);
  });

  it("cabeçalho é legível sem senha", () => {
    expect(lerCabecalho(cifrar(BANCO, "s", META)).dispositivoId).toBe("abc");
  });

  it("senha errada falha", () => {
    expect(() => decifrar(cifrar(BANCO, "certa", META), "errada")).toThrow(SenhaOuArquivoInvalido);
  });

  it("qualquer byte alterado (dados ou cabeçalho) falha", () => {
    const arq = cifrar(BANCO, "s", META);
    const dados = Buffer.from(arq);
    dados[dados.length - 40]! ^= 1;
    expect(() => decifrar(dados, "s")).toThrow(SenhaOuArquivoInvalido);
    const cab = Buffer.from(arq.toString("latin1").replace('"abc"', '"abd"'), "latin1");
    expect(() => decifrar(cab, "s")).toThrow(SenhaOuArquivoInvalido);
  });

  it("arquivo qualquer é recusado", () => {
    expect(() => lerCabecalho(Buffer.from("oi"))).toThrow(/não é um backup/);
  });
});
