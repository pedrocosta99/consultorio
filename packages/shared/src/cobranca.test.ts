import { describe, expect, it } from "vitest";
import { fechamentoDoMes, MENSAGENS_PADRAO, preencherModelo, sessoesSemRegistro, ultimaRealizada } from "./cobranca";
import { dinheiro } from "./money";
import type { Sessao } from "./types";

const FUSO = "America/Sao_Paulo";

function sessao(id: string, inicio: string, extra: Partial<Sessao> = {}): Sessao {
  return { id, pacienteId: "p1", inicio, duracaoMin: 50, estado: "realizada", valor: dinheiro(20000), pago: false, ...extra };
}

describe("preencherModelo", () => {
  it("troca variáveis conhecidas e mantém as desconhecidas", () => {
    expect(preencherModelo("Olá, {nome}! {x}", { nome: "Ana" })).toBe("Olá, Ana! {x}");
  });
  it("o modelo padrão de lembrete usa nome, dia e hora", () => {
    expect(preencherModelo(MENSAGENS_PADRAO.modeloLembrete, { nome: "Ana", dia: "amanhã", hora: "16:00" })).toContain("amanhã, às 16:00");
  });
});

describe("fechamentoDoMes", () => {
  it("soma só cobráveis do mês, separando pago e em aberto", () => {
    const ss = [
      sessao("a", "2026-10-07T19:00:00.000Z", { pago: true }),
      sessao("b", "2026-10-14T19:00:00.000Z"),
      sessao("c", "2026-10-21T19:00:00.000Z", { estado: "falta_nao_cobrada" }),
      sessao("d", "2026-10-28T19:00:00.000Z", { estado: "falta_cobrada" }),
      sessao("e", "2026-11-04T19:00:00.000Z"),
    ];
    const [f] = fechamentoDoMes(ss, "2026-10", FUSO);
    expect(f!.sessoes.map((s) => s.id)).toEqual(["a", "b", "d"]);
    expect(f!.total).toEqual([dinheiro(60000)]);
    expect(f!.pago).toEqual([dinheiro(20000)]);
    expect(f!.aberto).toEqual([dinheiro(40000)]);
  });

  it("usa o dia no fuso do consultório (01/11 00:30 UTC ainda é outubro em Brasília)", () => {
    const [f] = fechamentoDoMes([sessao("a", "2026-11-01T00:30:00.000Z")], "2026-10", FUSO);
    expect(f?.sessoes).toHaveLength(1);
  });

  it("não mistura moedas", () => {
    const [f] = fechamentoDoMes([sessao("a", "2026-10-07T19:00:00.000Z"), sessao("b", "2026-10-08T19:00:00.000Z", { valor: dinheiro(5000, "EUR") })], "2026-10", FUSO);
    expect(f!.total).toEqual([dinheiro(20000), dinheiro(5000, "EUR")]);
  });
});

describe("sessoesSemRegistro", () => {
  const agora = new Date("2026-11-04T17:30:00.000Z");
  it("pega agendadas que já terminaram, dentro da janela", () => {
    const ss = [
      sessao("velha", "2026-08-01T19:00:00.000Z", { estado: "agendada" }),
      sessao("ontem", "2026-11-03T19:00:00.000Z", { estado: "agendada" }),
      sessao("agora", "2026-11-04T17:00:00.000Z", { estado: "agendada" }),
      sessao("feita", "2026-11-03T12:00:00.000Z"),
      sessao("hoje-cedo", "2026-11-04T10:00:00.000Z", { estado: "agendada" }),
    ];
    expect(sessoesSemRegistro(ss, agora).map((s) => s.id)).toEqual(["ontem", "hoje-cedo"]);
  });
});

describe("ultimaRealizada", () => {
  it("ignora faltas e sessões futuras", () => {
    const agora = new Date("2026-11-04T12:00:00.000Z");
    const ss = [
      sessao("a", "2026-10-01T12:00:00.000Z"),
      sessao("b", "2026-10-20T12:00:00.000Z", { estado: "falta_cobrada" }),
      sessao("c", "2026-11-10T12:00:00.000Z"),
    ];
    expect(ultimaRealizada(ss, "p1", agora)).toBe("2026-10-01T12:00:00.000Z");
  });
});

describe("notaPatchSchema (regressão)", () => {
  it("PATCH parcial não inventa valores padrão para os outros campos", async () => {
    const { notaPatchSchema } = await import("./entradas");
    expect(notaPatchSchema.parse({ supervisaoEm: "2026-11-04" })).toEqual({ supervisaoEm: "2026-11-04" });
  });
});
