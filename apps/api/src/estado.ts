/**
 * Banco aberto pelo processo da API. Uso local, sem tela de acesso: o banco é
 * aberto na primeira chamada e fica aberto.
 */
import { randomBytes } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { abrirBanco, arquivoEmClaro, caminhoBanco, type Banco } from "./db/conexao";
import * as t from "./db/schema";
import { agora } from "./infra/relogio";
import { criarConta, ErroDominio, garantirSessoes } from "./servico";
import { semearFicticio } from "./seed";
import fs from "node:fs";

let banco: Banco | null = null;

function gravarMeta(b: Banco, chave: string, valor: string) {
  b.db.insert(t.metaSistema).values({ chave, valor }).onConflictDoUpdate({ target: t.metaSistema.chave, set: { valor } }).run();
}

export function bancoAtual(): Banco {
  if (banco) return banco;
  const caminho = caminhoBanco();
  const novo = !fs.existsSync(caminho);
  if (!novo && !arquivoEmClaro(caminho)) {
    throw new ErroDominio(409, "O arquivo do banco está cifrado (versão antiga com PIN) e não pode ser aberto sem ele.");
  }
  const b = abrirBanco(caminho);
  const temDispositivo = b.db.select().from(t.metaSistema).where(eq(t.metaSistema.chave, "dispositivo_id")).get();
  if (!temDispositivo) {
    gravarMeta(b, "dispositivo_id", randomBytes(8).toString("hex"));
    gravarMeta(b, "criado_em", new Date().toISOString());
  }
  if (!b.db.select().from(t.contas).get()) criarConta(b.db, { nome: "Conta corrente", instituicao: "Banco", pais: "BR", moeda: "BRL", tipo: "corrente" });
  garantirSessoes(b.db, agora());
  banco = b;
  return b;
}

/** Carrega os dados fictícios — só com o banco sem pacientes. */
export function carregarFicticio(): void {
  const b = bancoAtual();
  const n = b.db.select({ n: sql<number>`count(*)` }).from(t.pacientes).get()!.n;
  if (n > 0) throw new ErroDominio(409, "Já há pacientes cadastrados. Os dados fictícios só entram num banco vazio.");
  b.db.delete(t.contas).run(); // a conta padrão dá lugar às contas fictícias
  semearFicticio(b.db, agora());
  garantirSessoes(b.db, agora());
}

/** Importação: fecha o banco, troca o arquivo; a próxima chamada reabre. */
export function trocarBanco(fn: () => void) {
  fecharBanco();
  fn();
}

export function fecharBanco() {
  if (banco) {
    banco.sqlite.close();
    banco = null;
  }
}
