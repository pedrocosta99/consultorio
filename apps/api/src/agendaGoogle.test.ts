import { beforeEach, describe, expect, it } from "vitest";
import { dinheiro, type EventoGoogle } from "@consultorio/shared";
import { abrirBanco, type Db } from "./db/conexao";
import { contextoLocal, criarConta, criarPaciente, criarCompromisso, excluirCompromisso, salvarContrato, atualizarSessao, atualizarPaciente, carregarConsultorio } from "./servico";
import { conectar, configurar, desconectar, estadoIntegracao, processarFila, type AdaptadorGoogle } from "./agendaGoogle";

const AGORA = new Date("2026-11-04T17:30:00Z");
let db: Db;
let pid: string;

/** Adaptador que guarda os eventos em memória, como se fosse o Google. */
function googleFalso() {
  const eventos = new Map<string, EventoGoogle>();
  let n = 0;
  const a: AdaptadorGoogle = {
    criar: async (_cal, e) => {
      const id = `ev${++n}`;
      eventos.set(id, e);
      return { id, etag: "1" };
    },
    atualizar: async (_cal, id, e) => {
      eventos.set(id, e);
      return { etag: "2" };
    },
    apagar: async (_cal, id) => {
      eventos.delete(id);
    },
  };
  return { a, eventos };
}

beforeEach(() => {
  db = abrirBanco(":memory:").db;
  criarConta(db, { nome: "Conta", instituicao: "Banco", pais: "BR", moeda: "BRL", tipo: "corrente" });
  pid = criarPaciente(db, { nome: "Paciente Teste", apelido: "P.T.", origem: "particular", modalidade: "online", status: "ativo", inicioEm: "2026-11-01", fuso: "America/Sao_Paulo" });
  salvarContrato(db, pid, { diasSemana: [4], horario: "08:00", duracaoMin: 50, valor: dinheiro(25000), cobranca: "sessao", vigenteDe: "2026-11-01" }, AGORA);
});

describe("Google Agenda (simulado)", () => {
  it("sem agenda conectada, nada entra na fila", async () => {
    const ctx = contextoLocal(db);
    expect(estadoIntegracao(db, ctx)).toEqual({ conectada: false });
    expect(await processarFila(db, ctx, googleFalso().a, AGORA)).toEqual({ enviados: 0, falhas: 0 });
  });

  it("conectar envia tudo; mudanças entram pela fila (triggers) e chegam ao Google", async () => {
    const ctx = contextoLocal(db);
    const g = googleFalso();
    conectar(db, ctx, AGORA);
    criarCompromisso(db, { tipo: "compromisso", titulo: "Supervisão", inicio: "2026-11-06T12:00:00.000Z", duracaoMin: 60, recorrencia: "FREQ=WEEKLY;BYDAY=FR" });
    await processarFila(db, ctx, g.a, AGORA);
    const sessoes = carregarConsultorio(db, AGORA).sessoes;
    expect(g.eventos.size).toBe(sessoes.length + 1);
    expect([...g.eventos.values()].filter((e) => e.summary === "Sessão · P.T.")).toHaveLength(sessoes.length);
    expect(estadoIntegracao(db, ctx)).toMatchObject({ conectada: true, pendentes: 0, sincronizados: sessoes.length + 1 });

    // Cancelar uma sessão apaga o evento; mudar o apelido retitula as futuras.
    atualizarSessao(db, sessoes[0]!.id, { estado: "cancelada" }, AGORA);
    atualizarPaciente(db, pid, { apelido: "X.Y." }, AGORA);
    await processarFila(db, ctx, g.a, AGORA);
    expect(g.eventos.size).toBe(sessoes.length);
    expect([...g.eventos.values()].some((e) => e.summary === "Sessão · X.Y.")).toBe(true);

    // Só "Sessão", sem iniciais.
    configurar(db, ctx, { tituloSessao: "so_sessao" }, AGORA);
    await processarFila(db, ctx, g.a, AGORA);
    expect([...g.eventos.values()].filter((e) => e.summary.startsWith("Sessão")).every((e) => e.summary === "Sessão")).toBe(true);
  });

  it("excluir compromisso apaga o evento; desconectar pode apagar o resto", async () => {
    const ctx = contextoLocal(db);
    const g = googleFalso();
    conectar(db, ctx, AGORA);
    const c = criarCompromisso(db, { tipo: "bloqueio", titulo: "Dentista", inicio: "2026-11-05T13:00:00.000Z", duracaoMin: 60, recorrencia: null });
    await processarFila(db, ctx, g.a, AGORA);
    const antes = g.eventos.size;
    excluirCompromisso(db, c, { alcance: "todos", data: "2026-11-05" });
    await processarFila(db, ctx, g.a, AGORA);
    expect(g.eventos.size).toBe(antes - 1);
    expect(await desconectar(db, ctx, g.a, true)).toEqual({ apagados: antes - 1 });
    expect(g.eventos.size).toBe(0);
    expect(estadoIntegracao(db, ctx)).toEqual({ conectada: false });
  });

  it("falha no Google deixa o item na fila com o erro anotado", async () => {
    const ctx = contextoLocal(db);
    conectar(db, ctx, AGORA);
    const quebrado: AdaptadorGoogle = { ...googleFalso().a, criar: async () => Promise.reject(new Error("Google fora do ar")) };
    const r = await processarFila(db, ctx, quebrado, AGORA);
    expect(r.enviados).toBe(0);
    expect(estadoIntegracao(db, ctx)).toMatchObject({ erro: "Google fora do ar" });
    expect(estadoIntegracao(db, ctx).pendentes).toBeGreaterThan(0);
  });
});
