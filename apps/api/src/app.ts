import { Hono, type Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { z, ZodError } from "zod";
import {
  contratoEntradaSchema,
  feriadoEntradaSchema,
  MOEDA_PRINCIPAL,
  MOEDAS,
  pacienteEntradaSchema,
  pagamentoEntradaSchema,
  senhaSchema,
  sessaoAvulsaSchema,
  sessaoPatchSchema,
  TIPOS_CONTA,
} from "@consultorio/shared";
import type { Banco } from "./db/conexao";
import { bloquear, configurar, desbloquear, estadoAuth, exigirSessao, INATIVIDADE_MS, NaoAutorizado, sessaoValida } from "./estado";
import { agora } from "./infra/relogio";
import * as srv from "./servico";

const COOKIE = "consultorio_sessao";

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
  if (err instanceof NaoAutorizado) return c.json({ erro: err.message }, 401);
  if (err instanceof SyntaxError) return c.json({ erro: "JSON inválido" }, 400);
  // SIGILO: não logar corpo de requisição nem dados de pacientes.
  console.error(`[api] erro em ${c.req.method} ${c.req.routePath}:`, err instanceof Error ? err.name : "desconhecido");
  return c.json({ erro: "Erro interno" }, 500);
});

app.get("/health", (c) => c.json({ ok: true, moedaPrincipal: MOEDA_PRINCIPAL }));

// ── Autenticação ─────────────────────────────────────────────

function gravarCookie(c: Context, token: string) {
  setCookie(c, COOKIE, token, { httpOnly: true, sameSite: "Strict", path: "/api", maxAge: 60 * 60 * 12 });
}

app.get("/auth/estado", (c) =>
  c.json({ ...estadoAuth(), sessaoValida: sessaoValida(getCookie(c, COOKIE)), inatividadeMin: INATIVIDADE_MS / 60_000 }),
);

app.post("/auth/configurar", async (c) => {
  const { senha, ficticio } = z.object({ senha: senhaSchema, ficticio: z.boolean().default(false) }).parse(await c.req.json());
  gravarCookie(c, configurar(senha, ficticio));
  return c.json({ ok: true });
});

app.post("/auth/desbloquear", async (c) => {
  const { senha } = z.object({ senha: z.string().min(1, "Digite a senha") }).parse(await c.req.json());
  gravarCookie(c, await desbloquear(senha));
  return c.json({ ok: true });
});

app.post("/auth/bloquear", (c) => {
  bloquear(getCookie(c, COOKIE));
  deleteCookie(c, COOKIE, { path: "/api" });
  return c.json({ ok: true });
});

// Daqui para baixo, só com sessão válida.
app.use("*", async (c, next) => {
  c.set("banco", exigirSessao(getCookie(c, COOKIE)));
  await next();
});

const db = (c: Context<Env>) => c.get("banco").db;

/** Mantém a sessão viva enquanto há uso na interface (o middleware já renovou). */
app.post("/sessao/manter", (c) => c.json({ ok: true }));
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
