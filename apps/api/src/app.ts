import { Hono, type Context } from "hono";
import { z, ZodError } from "zod";
import {
  contratoEntradaSchema,
  feriadoEntradaSchema,
  MOEDA_PRINCIPAL,
  MOEDAS,
  notaEntradaSchema,
  notaPatchSchema,
  pacienteEntradaSchema,
  pagamentoEntradaSchema,
  sessaoAvulsaSchema,
  sessaoPatchSchema,
  TIPOS_CONTA,
} from "@consultorio/shared";
import type { Banco } from "./db/conexao";
import { bancoAtual, carregarFicticio, trocarBanco } from "./estado";
import { agora } from "./infra/relogio";
import * as srv from "./servico";
import * as backup from "./backup";
import { gerarProntuario } from "./prontuario";
import { SenhaOuArquivoInvalido } from "./infra/cofre";

type Env = { Variables: { banco: Banco } };

export const app = new Hono<Env>().basePath("/api");

// ── Defesas de borda ─────────────────────────────────────────
// 1) Host: só loopback (protege contra DNS rebinding).
// 2) Cabeçalho próprio em toda chamada: outro site não consegue enviá-lo sem
//    preflight de CORS, que esta API nunca autoriza.
app.use("*", async (c, next) => {
  const host = (c.req.header("host") ?? "").replace(/:\d+$/, "");
  if (host !== "127.0.0.1" && host !== "localhost") return c.json({ erro: "Host não permitido" }, 403);
  if (c.req.path !== "/api/health" && c.req.header("x-consultorio") !== "1") return c.json({ erro: "Cabeçalho ausente" }, 403);
  c.header("Cache-Control", "no-store");
  await next();
});

app.onError((err, c) => {
  if (err instanceof ZodError) return c.json({ erro: err.issues[0]?.message ?? "Dados inválidos" }, 400);
  if (err instanceof srv.ErroDominio) return c.json({ erro: err.message }, err.status);
  if (err instanceof SenhaOuArquivoInvalido) return c.json({ erro: err.message }, 400);
  if (err instanceof SyntaxError) return c.json({ erro: "JSON inválido" }, 400);
  // SIGILO: não logar corpo de requisição nem dados de pacientes.
  console.error(`[api] erro em ${c.req.method} ${c.req.routePath}:`, err instanceof Error ? err.name : "desconhecido");
  return c.json({ erro: "Erro interno" }, 500);
});

app.get("/health", (c) => c.json({ ok: true, moedaPrincipal: MOEDA_PRINCIPAL }));

// Daqui para baixo, todas as rotas usam o banco (aberto na primeira chamada).
app.use("*", async (c, next) => {
  c.set("banco", bancoAtual());
  await next();
});

const db = (c: Context<Env>) => c.get("banco").db;

app.post("/dados-ficticios", (c) => {
  carregarFicticio();
  return ok(c);
});
const ok = (c: Context, extra: object = {}) => c.json({ ok: true, ...extra });

// ── Consultório ──────────────────────────────────────────────

app.get("/consultorio", (c) => {
  srv.garantirSessoes(db(c), agora());
  return c.json(srv.carregarConsultorio(db(c), agora()));
});

app.patch("/sessoes/:id", async (c) => {
  srv.atualizarSessao(db(c), c.req.param("id"), sessaoPatchSchema.parse(await c.req.json()), agora());
  return ok(c);
});
app.post("/sessoes", async (c) => ok(c, { id: srv.criarSessaoAvulsa(db(c), sessaoAvulsaSchema.parse(await c.req.json())) }));

app.post("/pacientes", async (c) => {
  const id = srv.criarPaciente(db(c), pacienteEntradaSchema.parse(await c.req.json()));
  return ok(c, { id });
});
app.patch("/pacientes/:id", async (c) => {
  srv.atualizarPaciente(db(c), c.req.param("id"), pacienteEntradaSchema.partial().parse(await c.req.json()), agora());
  return ok(c);
});
app.post("/pacientes/:id/arquivar", (c) => {
  srv.arquivarPaciente(db(c), c.req.param("id"), agora());
  return ok(c);
});
app.post("/pacientes/:id/desarquivar", (c) => {
  srv.desarquivarPaciente(db(c), c.req.param("id"));
  return ok(c);
});
app.delete("/pacientes/:id", (c) => {
  srv.excluirPaciente(db(c), c.req.param("id"));
  return ok(c);
});

app.post("/pacientes/:id/contratos", async (c) => {
  const id = srv.salvarContrato(db(c), c.req.param("id"), contratoEntradaSchema.parse(await c.req.json()), agora());
  return ok(c, { id });
});
app.post("/contratos/:id/encerrar", async (c) => {
  const { ate } = z.object({ ate: z.iso.date() }).parse(await c.req.json());
  srv.encerrarContrato(db(c), c.req.param("id"), ate);
  return ok(c);
});

app.post("/pagamentos", async (c) => {
  const id = srv.registrarPagamento(db(c), pagamentoEntradaSchema.parse(await c.req.json()));
  return ok(c, { id });
});
app.delete("/pagamentos/:id", (c) => {
  srv.excluirPagamento(db(c), c.req.param("id"));
  return ok(c);
});

app.post("/feriados", async (c) => {
  srv.adicionarFeriado(db(c), feriadoEntradaSchema.parse(await c.req.json()));
  return ok(c);
});
app.delete("/feriados/:data", (c) => {
  srv.removerFeriado(db(c), c.req.param("data"), agora());
  return ok(c);
});

app.post("/notas", async (c) => ok(c, { id: srv.criarNota(db(c), notaEntradaSchema.parse(await c.req.json())) }));
app.patch("/notas/:id", async (c) => {
  srv.atualizarNota(db(c), c.req.param("id"), notaPatchSchema.parse(await c.req.json()));
  return ok(c);
});
app.delete("/notas/:id", (c) => {
  srv.excluirNota(db(c), c.req.param("id"));
  return ok(c);
});
app.get("/pacientes/:id/prontuario.pdf", async (c) => {
  const pdf = await gerarProntuario(db(c), c.req.param("id"), { pessoais: c.req.query("pessoais") === "1", agora: agora() });
  return c.body(pdf as Uint8Array<ArrayBuffer>, 200, {
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="prontuario-${c.req.param("id")}.pdf"`,
  });
});
app.get("/busca", (c) => c.json(srv.buscar(c.get("banco").sqlite, c.req.query("q") ?? "")));

app.put("/configuracoes/moedas", async (c) => {
  const { moedas } = z.object({ moedas: z.array(z.enum(MOEDAS)) }).parse(await c.req.json());
  srv.definirMoedas(db(c), moedas);
  return ok(c);
});

app.post("/contas", async (c) => {
  const e = z
    .object({
      nome: z.string().trim().min(1, "Dê um nome à conta"),
      instituicao: z.string().trim().min(1, "Informe a instituição"),
      pais: z.string().length(2),
      moeda: z.enum(MOEDAS),
      tipo: z.enum(TIPOS_CONTA),
    })
    .parse(await c.req.json());
  return ok(c, { id: srv.criarConta(db(c), e) });
});

// ── Backup cifrado ───────────────────────────────────────────

/** Senha do backup: separada do PIN, porque o arquivo sai da máquina (ex.: Drive). */
const senhaBackupSchema = z.string().min(10, "A senha do backup precisa de pelo menos 10 caracteres");

app.get("/backup", (c) => {
  const info = backup.infoBackup(c.get("banco"));
  const pasta = c.req.query("pasta") || info.pasta;
  return c.json({ ...info, pasta, snapshots: pasta ? backup.listar(pasta) : [] });
});

app.post("/backup/exportar", async (c) => {
  const e = z.object({ pasta: z.string().min(1, "Escolha a pasta"), senha: senhaBackupSchema }).parse(await c.req.json());
  return ok(c, backup.exportar(c.get("banco"), e.pasta, e.senha));
});

app.post("/backup/importar", async (c) => {
  const e = z
    .object({ pasta: z.string().min(1), arquivo: z.string().min(1), senha: z.string().min(1, "Digite a senha do backup") })
    .parse(await c.req.json());
  const novo = backup.prepararImportacao(e.pasta, e.arquivo, e.senha);
  const copia = backup.backupLocalAntes(c.get("banco"));
  trocarBanco(() => backup.substituirArquivo(novo));
  return ok(c, { copiaAnterior: copia });
});
