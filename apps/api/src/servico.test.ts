import { beforeEach, describe, expect, it } from "vitest";
import { dinheiro } from "@consultorio/shared";
import { abrirBanco, type Db } from "./db/conexao";
import {
  adicionarFeriado,
  arquivarPaciente,
  atualizarPaciente,
  atualizarSessao,
  carregarConsultorio,
  criarConta,
  criarPaciente,
  ErroDominio,
  excluirPaciente,
  garantirSessoes,
  registrarPagamento,
  removerFeriado,
  salvarContrato,
} from "./servico";
import { saldoPorMoeda } from "./dominio/saldo";

const AGORA = new Date("2026-11-04T17:30:00Z"); // quarta, 14:30 em Brasília
let db: Db;
let pid: string;

const paciente = {
  nome: "Paciente Teste",
  apelido: "P.T.",
  origem: "particular",
  modalidade: "online",
  status: "ativo",
  inicioEm: "2026-11-01",
  fuso: "America/Sao_Paulo",
} as const;

const contrato = {
  diasSemana: [1, 4],
  horario: "08:00",
  duracaoMin: 50,
  valor: dinheiro(25000),
  cobranca: "sessao",
  vigenteDe: "2026-11-01",
} as const;

beforeEach(() => {
  db = abrirBanco(":memory:").db;
  criarConta(db, { nome: "Conta", instituicao: "Banco", pais: "BR", moeda: "BRL", tipo: "corrente" });
  pid = criarPaciente(db, { ...paciente });
});

const sessoes = () => carregarConsultorio(db, AGORA).sessoes;

describe("grade → sessões", () => {
  it("gera 8 semanas a partir de hoje e não duplica ao rodar de novo", () => {
    salvarContrato(db, pid, { ...contrato, diasSemana: [...contrato.diasSemana] }, AGORA);
    const n = sessoes().length;
    expect(n).toBe(16); // 2x/semana × 8 semanas (qui 5/11 … seg 28/12)
    expect(garantirSessoes(db, AGORA)).toBe(0);
    expect(sessoes()).toHaveLength(n);
  });

  it("remarcada não é recriada na vaga original", () => {
    salvarContrato(db, pid, { ...contrato, diasSemana: [4] }, AGORA);
    const s = sessoes()[0]!;
    atualizarSessao(db, s.id, { inicio: "2026-11-06T15:00:00.000Z" }, AGORA);
    garantirSessoes(db, AGORA);
    expect(sessoes().filter((x) => x.inicio.startsWith("2026-11-05"))).toHaveLength(0);
  });

  it("reajuste: o contrato antigo termina na véspera e as futuras usam o valor novo", () => {
    salvarContrato(db, pid, { ...contrato, diasSemana: [4] }, AGORA);
    salvarContrato(db, pid, { ...contrato, diasSemana: [4], valor: dinheiro(30000), vigenteDe: "2026-11-19" }, AGORA);
    const pac = carregarConsultorio(db, AGORA);
    expect(pac.contratos.map((k) => [k.vigenteDe, k.vigenteAte])).toEqual([
      ["2026-11-01", "2026-11-18"],
      ["2026-11-19", null],
    ]);
    const valores = pac.sessoes.map((s) => `${s.inicio.slice(0, 10)} ${s.valor.centavos}`);
    expect(valores.slice(0, 4)).toEqual(["2026-11-05 25000", "2026-11-12 25000", "2026-11-19 30000", "2026-11-26 30000"]);
  });

  it("feriado remove a sessão gerada daquele dia; tirar o feriado traz de volta", () => {
    salvarContrato(db, pid, { ...contrato, diasSemana: [4] }, AGORA);
    adicionarFeriado(db, { data: "2026-11-12", descricao: "Folga" });
    expect(sessoes().some((s) => s.inicio.startsWith("2026-11-12"))).toBe(false);
    garantirSessoes(db, AGORA);
    expect(sessoes().some((s) => s.inicio.startsWith("2026-11-12"))).toBe(false);
    removerFeriado(db, "2026-11-12", AGORA);
    expect(sessoes().some((s) => s.inicio.startsWith("2026-11-12"))).toBe(true);
  });

  it("paciente que sai de ativo perde as sessões futuras agendadas", () => {
    salvarContrato(db, pid, { ...contrato, diasSemana: [4] }, AGORA);
    atualizarPaciente(db, pid, { status: "pausa" }, AGORA);
    expect(sessoes()).toHaveLength(0);
  });
});

describe("pagamentos e saldo", () => {
  it("marcar como paga cria pagamento; desmarcar apaga; falta não cobrada não fica paga", () => {
    salvarContrato(db, pid, { ...contrato, diasSemana: [4] }, AGORA);
    const s = sessoes()[0]!;
    atualizarSessao(db, s.id, { estado: "realizada", pago: true }, AGORA);
    expect(carregarConsultorio(db, AGORA).pagamentos).toHaveLength(1);
    atualizarSessao(db, s.id, { estado: "falta_nao_cobrada" }, AGORA);
    const pac = carregarConsultorio(db, AGORA);
    expect(pac.pagamentos).toHaveLength(0);
    expect(pac.sessoes[0]!.pago).toBe(false);
    expect(() => atualizarSessao(db, s.id, { pago: true }, AGORA)).toThrow(ErroDominio);
  });

  it("pagamento mensal quita várias sessões e o saldo fecha", () => {
    salvarContrato(db, pid, { ...contrato, diasSemana: [4] }, AGORA);
    const [a, b] = sessoes();
    atualizarSessao(db, a!.id, { estado: "realizada" }, AGORA);
    atualizarSessao(db, b!.id, { estado: "falta_cobrada" }, AGORA);
    const depois = new Date("2026-11-20T00:00:00Z");
    const contaId = carregarConsultorio(db, AGORA).contas[0]!.id;
    registrarPagamento(db, { pacienteId: pid, valor: dinheiro(50000), data: "2026-11-20", meio: "pix", contaId, sessaoIds: [a!.id, b!.id] });
    const pac = carregarConsultorio(db, depois);
    expect(pac.sessoes.filter((s) => s.pago)).toHaveLength(2);
    expect(saldoPorMoeda(pac.sessoes, pac.pagamentos, depois)).toEqual([]);
  });

  it("recusa conta de outra moeda", () => {
    const contaId = carregarConsultorio(db, AGORA).contas[0]!.id;
    expect(() =>
      registrarPagamento(db, { pacienteId: pid, valor: dinheiro(6000, "EUR"), data: "2026-11-04", meio: "transferencia", contaId, sessaoIds: [] }),
    ).toThrow(/em BRL/);
  });
});

describe("arquivar e excluir", () => {
  it("só permite para interrompido", () => {
    expect(() => arquivarPaciente(db, pid, AGORA)).toThrow(/interrompido/);
    expect(() => excluirPaciente(db, pid)).toThrow(/interrompido/);
  });

  it("arquivar guarda o prontuário; excluir apaga tudo", () => {
    salvarContrato(db, pid, { ...contrato, diasSemana: [4] }, AGORA);
    atualizarPaciente(db, pid, { status: "interrompido" }, AGORA);
    arquivarPaciente(db, pid, AGORA);
    expect(carregarConsultorio(db, AGORA).pacientes[0]!.arquivadoEm).toBe(AGORA.toISOString());
    excluirPaciente(db, pid);
    const pac = carregarConsultorio(db, AGORA);
    expect(pac.pacientes).toHaveLength(0);
    expect(pac.contratos).toHaveLength(0);
  });
});
