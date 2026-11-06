/**
 * Formato do snapshot cifrado (".cofre"):
 *
 *   "CONSULTORIO-COFRE\n" | u32 tamanho do cabeçalho | cabeçalho JSON | dados cifrados | tag GCM (16 bytes)
 *
 * Os dados são o banco SQLite compactado (gzip) e cifrado com AES-256-GCM. A chave
 * vem da senha via scrypt (sal aleatório por arquivo). O cabeçalho é público
 * (versão, dispositivo, data, tamanho), mas entra como "additional data" do GCM:
 * qualquer alteração nele invalida o arquivo.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from "node:crypto";
import { gunzipSync, gzipSync } from "node:zlib";

const MAGICO = Buffer.from("CONSULTORIO-COFRE\n", "utf8");
const KDF = { N: 1 << 15, r: 8, p: 1 } as const;

export interface MetaSnapshot {
  versaoEsquema: string;
  dispositivoId: string;
  criadoEm: string;
  /** sha256 do banco (antes de compactar), para conferir na importação. */
  sha256: string;
  bytes: number;
}

interface Cabecalho extends MetaSnapshot {
  formato: 1;
  kdf: { alg: "scrypt"; N: number; r: number; p: number; sal: string };
  iv: string;
}

export class SenhaOuArquivoInvalido extends Error {}

function chave(senha: string, sal: Buffer, k: { N: number; r: number; p: number }) {
  return scryptSync(senha.normalize("NFC"), sal, 32, { ...k, maxmem: 64 * 1024 * 1024 });
}

export function cifrar(banco: Buffer, senha: string, meta: Omit<MetaSnapshot, "sha256" | "bytes">): Buffer {
  const sal = randomBytes(16);
  const iv = randomBytes(12);
  const cab: Cabecalho = {
    ...meta,
    sha256: createHash("sha256").update(banco).digest("hex"),
    bytes: banco.length,
    formato: 1,
    kdf: { alg: "scrypt", ...KDF, sal: sal.toString("base64") },
    iv: iv.toString("base64"),
  };
  const cabBytes = Buffer.from(JSON.stringify(cab), "utf8");
  const tam = Buffer.alloc(4);
  tam.writeUInt32BE(cabBytes.length);
  const c = createCipheriv("aes-256-gcm", chave(senha, sal, KDF), iv);
  c.setAAD(cabBytes);
  const dados = Buffer.concat([c.update(gzipSync(banco)), c.final()]);
  return Buffer.concat([MAGICO, tam, cabBytes, dados, c.getAuthTag()]);
}

function separar(arquivo: Buffer) {
  if (arquivo.length < MAGICO.length + 4 + 16 || !arquivo.subarray(0, MAGICO.length).equals(MAGICO)) {
    throw new SenhaOuArquivoInvalido("Este arquivo não é um backup do Consultório.");
  }
  const tam = arquivo.readUInt32BE(MAGICO.length);
  const ini = MAGICO.length + 4;
  const cabBytes = arquivo.subarray(ini, ini + tam);
  let cab: Cabecalho;
  try {
    cab = JSON.parse(cabBytes.toString("utf8")) as Cabecalho;
  } catch {
    throw new SenhaOuArquivoInvalido("Cabeçalho do backup corrompido.");
  }
  return { cab, cabBytes, dados: arquivo.subarray(ini + tam, arquivo.length - 16), tag: arquivo.subarray(arquivo.length - 16) };
}

/** Lê só os metadados públicos (sem senha). */
export function lerCabecalho(arquivo: Buffer): MetaSnapshot {
  const { cab } = separar(arquivo);
  return { versaoEsquema: cab.versaoEsquema, dispositivoId: cab.dispositivoId, criadoEm: cab.criadoEm, sha256: cab.sha256, bytes: cab.bytes };
}

export function decifrar(arquivo: Buffer, senha: string): { banco: Buffer; meta: MetaSnapshot } {
  const { cab, cabBytes, dados, tag } = separar(arquivo);
  let banco: Buffer;
  try {
    const d = createDecipheriv("aes-256-gcm", chave(senha, Buffer.from(cab.kdf.sal, "base64"), cab.kdf), Buffer.from(cab.iv, "base64"));
    d.setAAD(cabBytes);
    d.setAuthTag(tag);
    banco = gunzipSync(Buffer.concat([d.update(dados), d.final()]));
  } catch {
    throw new SenhaOuArquivoInvalido("Senha errada ou arquivo alterado/corrompido.");
  }
  if (createHash("sha256").update(banco).digest("hex") !== cab.sha256) {
    throw new SenhaOuArquivoInvalido("O conteúdo não confere com o hash do backup.");
  }
  return { banco, meta: lerCabecalho(arquivo) };
}
