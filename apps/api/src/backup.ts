/**
 * Exportar/importar snapshot cifrado do banco para uma pasta (ex.: a do Google
 * Drive para Desktop). O banco ativo NUNCA fica na pasta sincronizada: só cópias
 * cifradas, geradas com VACUUM INTO (cópia consistente).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { caminhoBanco, type Banco } from "./db/conexao";
import * as t from "./db/schema";
import { cifrar, decifrar, lerCabecalho, type MetaSnapshot } from "./infra/cofre";
import { ErroDominio } from "./servico";

export const MANTER_SNAPSHOTS = 30;
const EXT = ".cofre";

export function resolverPasta(pasta: string): string {
  const p = path.resolve(pasta.trim().replace(/^~(?=$|\/)/, os.homedir()));
  if (!fs.existsSync(p) || !fs.statSync(p).isDirectory()) throw new ErroDominio(400, "Pasta não encontrada neste computador.");
  return p;
}

function meta(b: Banco, chave: string): string | undefined {
  return b.db.select().from(t.metaSistema).where(eq(t.metaSistema.chave, chave)).get()?.valor;
}
function gravar(b: Banco, chave: string, valor: string) {
  b.db.insert(t.metaSistema).values({ chave, valor }).onConflictDoUpdate({ target: t.metaSistema.chave, set: { valor } }).run();
}

export function versaoEsquema(sqlite: Database.Database): string {
  return String((sqlite.prepare("select count(*) as n from __drizzle_migrations").get() as { n: number }).n);
}

/** Cópia consistente do banco (VACUUM INTO) em arquivo temporário ao lado do banco. */
function copiaConsistente(b: Banco): Buffer {
  const tmp = path.join(path.dirname(b.caminho), `.copia-${process.pid}-${Date.now()}.db`);
  try {
    b.sqlite.prepare("VACUUM INTO ?").run(tmp);
    return fs.readFileSync(tmp);
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

export function infoBackup(b: Banco) {
  return { pasta: meta(b, "pasta_backup") ?? "", ultimo: meta(b, "ultimo_backup") ?? null };
}

export function exportar(b: Banco, pastaInformada: string, senhaBackup: string): { arquivo: string } {
  const pasta = resolverPasta(pastaInformada);
  const agora = new Date();
  const nome = `consultorio-${agora.toISOString().slice(0, 16).replace(/[:T]/g, "-")}${EXT}`;
  const conteudo = cifrar(copiaConsistente(b), senhaBackup, {
    versaoEsquema: versaoEsquema(b.sqlite),
    dispositivoId: meta(b, "dispositivo_id") ?? "?",
    criadoEm: agora.toISOString(),
  });
  // Grava em .tmp e renomeia: o Drive nunca vê um arquivo pela metade.
  const destino = path.join(pasta, nome);
  fs.writeFileSync(destino + ".tmp", conteudo, { mode: 0o600 });
  fs.renameSync(destino + ".tmp", destino);
  gravar(b, "pasta_backup", pasta);
  gravar(b, "ultimo_backup", agora.toISOString());
  // Retenção: mantém os últimos N.
  const todos = listar(pasta);
  for (const velho of todos.slice(MANTER_SNAPSHOTS)) fs.rmSync(path.join(pasta, velho.arquivo), { force: true });
  return { arquivo: nome };
}

type ItemSnapshot = { arquivo: string; tamanho: number; erro?: string } & Partial<MetaSnapshot>;

export function listar(pastaInformada: string): ItemSnapshot[] {
  const pasta = resolverPasta(pastaInformada);
  return fs
    .readdirSync(pasta)
    .filter((f) => f.endsWith(EXT))
    .map((arquivo): ItemSnapshot => {
      const caminho = path.join(pasta, arquivo);
      const tamanho = fs.statSync(caminho).size;
      try {
        return { arquivo, tamanho, ...lerCabecalho(fs.readFileSync(caminho)) };
      } catch (e) {
        return { arquivo, tamanho, erro: e instanceof Error ? e.message : "inválido" };
      }
    })
    .sort((a, b) => (b.criadoEm ?? b.arquivo).localeCompare(a.criadoEm ?? a.arquivo));
}

/**
 * Decifra o snapshot, confere que é um banco do app e devolve o caminho do arquivo
 * pronto para substituir o atual (quem chama troca com o banco fechado).
 */
export function prepararImportacao(pastaInformada: string, arquivo: string, senhaBackup: string): string {
  const pasta = resolverPasta(pastaInformada);
  if (path.basename(arquivo) !== arquivo || !arquivo.endsWith(EXT)) throw new ErroDominio(400, "Arquivo inválido.");
  const { banco } = decifrar(fs.readFileSync(path.join(pasta, arquivo)), senhaBackup);
  const tmp = path.join(path.dirname(caminhoBanco()), `.importando-${Date.now()}.db`);
  fs.writeFileSync(tmp, banco, { mode: 0o600 });
  try {
    const teste = new Database(tmp, { readonly: true });
    const ok = (teste.prepare("pragma integrity_check").get() as { integrity_check: string }).integrity_check;
    const temSenha = teste.prepare("select 1 from meta_sistema where chave = 'senha_hash'").get();
    teste.close();
    if (ok !== "ok" || !temSenha) throw new ErroDominio(400, "O backup não passou na verificação de integridade.");
  } catch (e) {
    fs.rmSync(tmp, { force: true });
    throw e instanceof ErroDominio ? e : new ErroDominio(400, "O backup não é um banco válido do app.");
  }
  return tmp;
}

/** Guarda uma cópia do banco atual antes de qualquer substituição. */
export function backupLocalAntes(b: Banco): string {
  const pasta = path.join(path.dirname(b.caminho), "backups");
  fs.mkdirSync(pasta, { recursive: true });
  const destino = path.join(pasta, `antes-de-importar-${new Date().toISOString().replace(/[:.]/g, "-")}.db`);
  b.sqlite.prepare("VACUUM INTO ?").run(destino);
  return destino;
}

/** Troca o arquivo do banco (com ele fechado). */
export function substituirArquivo(novo: string) {
  const atual = caminhoBanco();
  for (const sufixo of ["-wal", "-shm"]) fs.rmSync(atual + sufixo, { force: true });
  fs.renameSync(novo, atual);
}
