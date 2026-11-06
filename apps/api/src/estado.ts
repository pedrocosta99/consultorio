/**
 * Estado do processo: banco aberto (ou não) e sessões de login.
 *
 * A API começa BLOQUEADA: o banco só é aberto depois que a senha confere, e é
 * fechado de novo quando a última sessão expira (15 min sem uso) ou no "Bloquear".
 */
import fs from "node:fs";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import type { EstadoAuth } from "@consultorio/shared";
import { abrirBanco, caminhoBanco, type Banco } from "./db/conexao";
import * as t from "./db/schema";
import { conferirSenha, hashSenha } from "./infra/senha";
import { agora } from "./infra/relogio";
import { criarConta, ErroDominio, garantirSessoes } from "./servico";
import { semearFicticio } from "./seed";

export const INATIVIDADE_MS = 15 * 60 * 1000;

let banco: Banco | null = null;
/** token → último uso (relógio real, não o fixo dos testes). */
const sessoes = new Map<string, number>();
let falhasSeguidas = 0;

export class NaoAutorizado extends Error {}

export function estadoAuth(): Omit<EstadoAuth, "sessaoValida"> {
  return { configurado: fs.existsSync(caminhoBanco()), desbloqueado: banco !== null };
}

function novaSessao(): string {
  const token = randomBytes(32).toString("base64url");
  sessoes.set(token, Date.now());
  return token;
}

function lerMeta(b: Banco, chave: string): string | undefined {
  return b.db.select().from(t.metaSistema).where(eq(t.metaSistema.chave, chave)).get()?.valor;
}

function gravarMeta(b: Banco, chave: string, valor: string) {
  b.db.insert(t.metaSistema).values({ chave, valor }).onConflictDoUpdate({ target: t.metaSistema.chave, set: { valor } }).run();
}

/** Primeiro acesso: cria o banco, guarda o hash da senha e (opcional) os dados fictícios. */
export function configurar(senha: string, ficticio: boolean): string {
  if (estadoAuth().configurado) throw new ErroDominio(409, "O app já tem senha. Use a tela de desbloqueio.");
  const b = abrirBanco(caminhoBanco());
  gravarMeta(b, "senha_hash", hashSenha(senha));
  gravarMeta(b, "dispositivo_id", randomBytes(8).toString("hex"));
  gravarMeta(b, "criado_em", new Date().toISOString());
  if (ficticio) semearFicticio(b.db, agora());
  else criarConta(b.db, { nome: "Conta corrente", instituicao: "Banco", pais: "BR", moeda: "BRL", tipo: "corrente" });
  garantirSessoes(b.db, agora());
  banco = b;
  return novaSessao();
}

export async function desbloquear(senha: string): Promise<string> {
  if (!estadoAuth().configurado) throw new ErroDominio(409, "Defina uma senha primeiro.");
  // Atraso crescente contra tentativa e erro.
  if (falhasSeguidas > 0) await new Promise((r) => setTimeout(r, Math.min(falhasSeguidas, 10) * 500));
  const b = banco ?? abrirBanco(caminhoBanco());
  const hash = lerMeta(b, "senha_hash");
  if (!hash || !conferirSenha(senha, hash)) {
    falhasSeguidas++;
    if (!banco) b.sqlite.close();
    throw new NaoAutorizado("Senha incorreta.");
  }
  falhasSeguidas = 0;
  banco = b;
  garantirSessoes(b.db, agora());
  return novaSessao();
}

export function bloquear(token?: string) {
  if (token) sessoes.delete(token);
  else sessoes.clear();
  if (sessoes.size === 0) fecharBanco();
}

function fecharBanco() {
  if (banco) {
    banco.sqlite.close();
    banco = null;
  }
}

/** A sessão deste token ainda vale? (não lança, não renova) */
export function sessaoValida(token: string | undefined): boolean {
  const ultimo = token ? sessoes.get(token) : undefined;
  return !!banco && ultimo !== undefined && Date.now() - ultimo <= INATIVIDADE_MS;
}

/** Valida e renova a sessão. Lança NaoAutorizado se expirou. */
export function exigirSessao(token: string | undefined): Banco {
  const ultimo = token ? sessoes.get(token) : undefined;
  if (!token || ultimo === undefined || Date.now() - ultimo > INATIVIDADE_MS || !banco) {
    if (token) sessoes.delete(token);
    throw new NaoAutorizado("Sessão expirada. Digite a senha de novo.");
  }
  sessoes.set(token, Date.now());
  return banco;
}

/** Varredura periódica: expira sessões e fecha o banco quando ninguém está usando. */
export function iniciarVarredura() {
  const timer = setInterval(() => {
    const limite = Date.now() - INATIVIDADE_MS;
    for (const [token, ultimo] of sessoes) if (ultimo < limite) sessoes.delete(token);
    if (sessoes.size === 0) fecharBanco();
  }, 30_000);
  timer.unref();
}

/** Para backup/importação: substituir o arquivo exige o banco fechado. */
export function comBancoFechado<T>(fn: () => T): T {
  const estava = banco;
  fecharBanco();
  try {
    return fn();
  } finally {
    if (estava) banco = abrirBanco(caminhoBanco());
  }
}

export function bancoAtual(): Banco | null {
  return banco;
}
