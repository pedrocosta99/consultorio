import fs from "node:fs";
import path from "node:path";
// "better-sqlite3" aqui é um alias para better-sqlite3-multiple-ciphers (package.json):
// mesma API (o suporte a cifra não é usado desde que o app deixou de ter PIN).
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

/** Abre (ou cria) o banco e aplica as migrações pendentes. */
export function abrirBanco(caminho: string): Banco {
  if (caminho !== ":memory:") fs.mkdirSync(path.dirname(caminho), { recursive: true });
  const sqlite: BetterSqlite3.Database = new Database(caminho);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 3000");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: PASTA_MIGRACOES });
  return { sqlite, db, caminho };
}
