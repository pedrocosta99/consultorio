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

/** Abre (ou cria) o banco e aplica as migrações pendentes. */
export function abrirBanco(caminho: string): Banco {
  fs.mkdirSync(path.dirname(caminho), { recursive: true });
  const sqlite: BetterSqlite3.Database = new Database(caminho);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 3000");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: PASTA_MIGRACOES });
  return { sqlite, db, caminho };
}
