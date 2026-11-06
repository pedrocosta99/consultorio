import fs from "node:fs";
import path from "node:path";
// "better-sqlite3" aqui é um alias para better-sqlite3-multiple-ciphers (package.json):
// mesma API, com suporte a SQLCipher.
import Database from "better-sqlite3";
import type BetterSqlite3 from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";

export type Db = BetterSQLite3Database<typeof schema>;
export interface Banco {
  sqlite: BetterSqlite3.Database;
  db: Db;
  caminho: string;
}

const PASTA_MIGRACOES = path.resolve(import.meta.dirname, "../../drizzle");

/** Caminho do arquivo do banco (fora do git). */
export function caminhoBanco(): string {
  return path.resolve(process.env.CONSULTORIO_DB ?? path.resolve(import.meta.dirname, "../../../../data/consultorio.db"));
}

export class ChaveInvalida extends Error {}

const CABECALHO_CLARO = Buffer.from("SQLite format 3\0", "latin1");

/** O arquivo existe e está em claro (sem cifra)? */
export function arquivoEmClaro(caminho: string): boolean {
  if (caminho === ":memory:" || !fs.existsSync(caminho)) return false;
  const fd = fs.openSync(caminho, "r");
  try {
    const b = Buffer.alloc(16);
    return fs.readSync(fd, b, 0, 16, 0) === 16 && b.equals(CABECALHO_CLARO);
  } finally {
    fs.closeSync(fd);
  }
}

function aplicarChave(sqlite: BetterSqlite3.Database, pin: string, pragma: "key" | "rekey") {
  sqlite.pragma("cipher = 'sqlcipher'");
  sqlite.pragma("legacy = 4");
  sqlite.pragma(`${pragma} = '${pin.replace(/'/g, "''")}'`);
}

/**
 * Abre (ou cria) o banco e aplica as migrações pendentes.
 * Com `pin`, o arquivo é cifrado (SQLCipher v4, via SQLite3MultipleCiphers): sem o PIN,
 * o arquivo é ilegível. PIN errado → ChaveInvalida.
 */
export function abrirBanco(caminho: string, pin?: string): Banco {
  if (caminho !== ":memory:") fs.mkdirSync(path.dirname(caminho), { recursive: true });
  const sqlite: BetterSqlite3.Database = new Database(caminho);
  if (pin !== undefined) {
    aplicarChave(sqlite, pin, "key");
    try {
      sqlite.prepare("select count(*) from sqlite_master").get();
    } catch {
      sqlite.close();
      throw new ChaveInvalida("PIN incorreto.");
    }
  }
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 3000");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: PASTA_MIGRACOES });
  return { sqlite, db, caminho };
}

/** Cifra no lugar um banco que está em claro (migração para SQLCipher). */
export function cifrarArquivo(caminho: string, pin: string) {
  const sqlite: BetterSqlite3.Database = new Database(caminho);
  try {
    sqlite.pragma("journal_mode = DELETE"); // rekey não funciona em WAL
    aplicarChave(sqlite, pin, "rekey");
  } finally {
    sqlite.close();
  }
  for (const sufixo of ["-wal", "-shm"]) fs.rmSync(caminho + sufixo, { force: true });
  if (arquivoEmClaro(caminho)) throw new Error("A cifra do banco falhou.");
}
