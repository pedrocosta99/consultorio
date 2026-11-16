import { Hono, type Context } from "hono";
import { z, ZodError } from "zod";
import {
  compromissoAlteracaoSchema,
  compromissoEntradaSchema,
  compromissoExclusaoSchema,
  contratoEntradaSchema,
  horarioAtendimentoSchema,
  feriadoEntradaSchema,
  lancamentoEntradaSchema,
  lancamentoPatchSchema,
  mensagensSchema,
  MOEDA_PRINCIPAL,
  MOEDAS,
  notaEntradaSchema,
  notaPatchSchema,
  pacienteEntradaSchema,
  pagamentoEntradaSchema,
  reciboEntradaSchema,
  sessaoAvulsaSchema,
  sessaoPatchSchema,
  sessaoSeguintesSchema,
  TIPOS_CONTA,
  podeLerClinico,
  type Contexto,
} from "@consultorio/shared";
import type { Banco } from "./db/conexao";
import { bancoAtual, carregarFicticio, trocarBanco } from "./estado";
import { agora } from "./infra/relogio";
import * as srv from "./servico";
import * as backup from "./backup";
import { gerarProntuario } from "./prontuario";
import { SenhaOuArquivoInvalido } from "./infra/cofre";

type Env = { Variables: { banco: Banco; ctx: Contexto } };

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
  // Quem está usando e em qual consultório. Local: usuário fixo; com login (6.3), o token.
  c.set("ctx", srv.contextoLocal(c.get("banco").db));
  await next();
});

const db = (c: Context<Env>) => c.get("banco").db;
const ctx = (c: Context<Env>) => c.get("ctx");

/** Notas, prontuário e busca são só para quem atende (o suporte não lê). */
function exigirClinico(c: Context<Env>) {
  if (!podeLerClinico(ctx(c).papel)) throw new srv.ErroDominio(403, "Seu papel não dá acesso a dados clínicos.");
}
app.use("/notas/*", async (c, next) => {
  exigirClinico(c);
  await next();
});
app.use("/notas", async (c, next) => {
  exigirClinico(c);
  await next();
});
app.use("/busca", async (c, next) => {
  exigirClinico(c);
  await next();
});
app.use("/pacientes/:id/prontuario.pdf", async (c, next) => {
  exigirClinico(c);
  await next();
});

/** Quem está usando, em qual consultório e com que papel. */
app.get("/sessao", (c) => c.json(srv.sessaoDoUsuario(db(c), ctx(c))));

app.post("/dados-ficticios", (c) => {
  carregarFicticio();
  return ok(c);
});
const ok = (c: Context, extra: object = {}) => c.json({ ok: true, ...extra });

// ── Consultório ──────────────────────────────────────────────

app.get("/consultorio", (c) => {
  srv.garantirSessoes(db(c), agora());
  const pacote = srv.carregarConsultorio(db(c), agora(), ctx(c).consultorioId);
  // Sem papel clínico, o pacote vai sem notas e sem pontos fixos.
  if (!podeLerClinico(ctx(c).papel)) return c.json({ ...pacote, notas: [], pacientes: pacote.pacientes.map((p) => ({ ...p, pontosFixos: "" })) });
  return c.json(pacote);
});

app.patch("/sessoes/:id", async (c) => {
  srv.atualizarSessao(db(c), c.req.param("id"), sessaoPatchSchema.parse(await c.req.json()), agora(), ctx(c).usuarioId);
  return ok(c);
});
app.post("/sessoes/:id/seguintes", async (c) =>
  ok(c, srv.alterarDaquiEmDiante(db(c), c.req.param("id"), sessaoSeguintesSchema.parse(await c.req.json()), agora())),
);
app.post("/sessoes", async (c) => ok(c, { id: srv.criarSessaoAvulsa(db(c), sessaoAvulsaSchema.parse(await c.req.json()), ctx(c).usuarioId) }));

app.post("/pacientes", async (c) => {
  const id = srv.criarPaciente(db(c), pacienteEntradaSchema.parse(await c.req.json()), ctx(c).usuarioId);
  return ok(c, { id });
});
app.patch("/pacientes/:id", async (c) => {
  srv.atualizarPaciente(db(c), c.req.param("id"), pacienteEntradaSchema.partial().parse(await c.req.json()), agora(), ctx(c).usuarioId);
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
  const id = srv.registrarPagamento(db(c), pagamentoEntradaSchema.parse(await c.req.json()), ctx(c).usuarioId);
  return ok(c, { id });
});
app.put("/pagamentos/:id/recibo", async (c) => {
  srv.marcarRecibo(db(c), c.req.param("id"), reciboEntradaSchema.parse(await c.req.json()), ctx(c).usuarioId);
  return ok(c);
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

app.post("/notas", async (c) => {
  const id = srv.criarNota(db(c), notaEntradaSchema.parse(await c.req.json()), ctx(c).usuarioId);
  return ok(c, { id, atualizadoEm: srv.versaoDaNota(db(c), id) });
});
app.patch("/notas/:id", async (c) => {
  return ok(c, { atualizadoEm: srv.atualizarNota(db(c), c.req.param("id"), notaPatchSchema.parse(await c.req.json()), ctx(c).usuarioId) });
});
app.delete("/notas/:id", (c) => {
  srv.excluirNota(db(c), c.req.param("id"));
  return ok(c);
});
app.get("/pacientes/:id/prontuario.pdf", async (c) => {
  srv.registrarAcesso(db(c), ctx(c), "exportou_prontuario", c.req.param("id"), agora());
  const pdf = await gerarProntuario(db(c), c.req.param("id"), { pessoais: c.req.query("pessoais") === "1", agora: agora() });
  return c.body(pdf as Uint8Array<ArrayBuffer>, 200, {
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="prontuario-${c.req.param("id")}.pdf"`,
  });
});
app.get("/busca", (c) => {
  const q = c.req.query("q") ?? "";
  // O termo buscado NÃO é registrado: só que houve uma busca.
  if (q.trim().length >= 2) srv.registrarAcesso(db(c), ctx(c), "buscou", null, agora());
  return c.json(srv.buscar(c.get("banco").sqlite, q));
});

// ── Registro de acesso ───────────────────────────────────────

/** A tela avisa que abriu a ficha (enquanto os dados vêm num pacote só; ver 6.1). */
app.post("/acessos", async (c) => {
  exigirClinico(c);
  const { pacienteId } = z.object({ acao: z.literal("abriu_ficha"), pacienteId: z.string().min(1) }).parse(await c.req.json());
  srv.registrarAcesso(db(c), ctx(c), "abriu_ficha", pacienteId, agora());
  return ok(c);
});
app.get("/acessos", (c) => {
  if (ctx(c).papel !== "dono") throw new srv.ErroDominio(403, "Só o dono vê o registro de acesso.");
  return c.json(srv.listarAcessos(db(c), ctx(c).consultorioId));
});

app.put("/configuracoes/moedas", async (c) => {
  const { moedas } = z.object({ moedas: z.array(z.enum(MOEDAS)) }).parse(await c.req.json());
  srv.definirMoedas(db(c), moedas, ctx(c).consultorioId);
  return ok(c);
});

// ── Cotações ────────────────────────────────────────────────

app.post("/cotacoes", async (c) => {
  const e = z
    .object({ data: z.iso.date(), moeda: z.enum(["USD", "EUR"]), taxa: z.number().int().positive("Cotação inválida") })
    .parse(await c.req.json());
  srv.definirCotacao(db(c), e);
  return ok(c);
});
app.delete("/cotacoes/:moeda/:data", (c) => {
  const moeda = z.enum(["USD", "EUR"]).parse(c.req.param("moeda"));
  srv.excluirCotacao(db(c), moeda, z.iso.date().parse(c.req.param("data")));
  return ok(c);
});
/** Atualiza do Banco Central as moedas ligadas, desde o primeiro movimento (ou 1 ano). */
app.post("/cotacoes/atualizar", async (c) => {
  const banco = db(c);
  const hoje = srv.hojeCivil(agora());
  let novas = 0;
  for (const moeda of srv.moedasAtivas(banco, ctx(c).consultorioId).filter((m): m is "USD" | "EUR" => m !== "BRL")) {
    const umAno = `${Number(hoje.slice(0, 4)) - 1}${hoje.slice(4)}`;
    const desde = srv.primeiraDataNaMoeda(banco, moeda) ?? umAno;
    novas += srv.gravarCotacoesBcb(banco, await srv.buscarPtax(moeda, desde < umAno ? desde : umAno, hoje));
  }
  return ok(c, { novas });
});

app.put("/configuracoes/horario-atendimento", async (c) => {
  srv.definirHorarioAtendimento(db(c), horarioAtendimentoSchema.parse(await c.req.json()), ctx(c).consultorioId);
  return ok(c);
});

app.put("/configuracoes/mensagens", async (c) => {
  srv.definirMensagens(db(c), mensagensSchema.parse(await c.req.json()), ctx(c).consultorioId);
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

// ── Finanças (lançamentos) ───────────────────────────────────

app.post("/lancamentos", async (c) => ok(c, { id: srv.criarLancamento(db(c), lancamentoEntradaSchema.parse(await c.req.json())) }));
app.patch("/lancamentos/:id", async (c) => {
  srv.atualizarLancamento(db(c), c.req.param("id"), lancamentoPatchSchema.parse(await c.req.json()));
  return ok(c);
});
app.delete("/lancamentos/:id", (c) => {
  srv.excluirLancamento(db(c), c.req.param("id"));
  return ok(c);
});
app.post("/lancamentos/fixos", async (c) => {
  const { mes } = z.object({ mes: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Mês inválido") }).parse(await c.req.json());
  return ok(c, { criados: srv.lancarFixos(db(c), mes) });
});

// ── Compromissos (agenda) ────────────────────────────────────

app.post("/compromissos", async (c) => ok(c, { id: srv.criarCompromisso(db(c), compromissoEntradaSchema.parse(await c.req.json())) }));
app.patch("/compromissos/:id", async (c) =>
  ok(c, { id: srv.alterarCompromisso(db(c), c.req.param("id"), compromissoAlteracaoSchema.parse(await c.req.json())) }),
);
app.post("/compromissos/:id/excluir", async (c) => {
  srv.excluirCompromisso(db(c), c.req.param("id"), compromissoExclusaoSchema.parse(await c.req.json()));
  return ok(c);
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
