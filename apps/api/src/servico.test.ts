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
import { saldoPorMoeda } from "@consultorio/shared";

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

describe("moedas", () => {
  it("começa só com BRL; liga e desliga extras; não desliga com contrato vigente", async () => {
    const { definirMoedas, moedasAtivas } = await import("./servico");
    expect(moedasAtivas(db)).toEqual(["BRL"]);
    definirMoedas(db, ["EUR"]);
    expect(moedasAtivas(db)).toEqual(["BRL", "EUR"]);
    salvarContrato(db, pid, { ...contrato, diasSemana: [4], valor: dinheiro(6000, "EUR") }, AGORA);
    expect(() => definirMoedas(db, [])).toThrow(/EUR/);
  });
});

describe("notas e busca (FTS5)", () => {
  it("cria, edita, apaga e busca sem acento e por prefixo", async () => {
    const { criarNota, atualizarNota, excluirNota, buscar } = await import("./servico");
    const sqlite = (db as unknown as { $client: import("better-sqlite3").Database }).$client;
    const id = criarNota(db, { pacienteId: pid, texto: "Sonhou com o **Lírio** na praça de Itu." });
    expect(buscar(sqlite, "lirio")).toHaveLength(1); // sem acento acha com acento
    expect(buscar(sqlite, "son")).toHaveLength(1); // prefixo
    expect(buscar(sqlite, "praca itu")[0]!.trecho).toContain("[[praça]]");
    expect(buscar(sqlite, "inexistente")).toHaveLength(0);
    atualizarNota(db, id, { texto: "Outra coisa" });
    expect(buscar(sqlite, "lirio")).toHaveLength(0);
    expect(buscar(sqlite, "outra")).toHaveLength(1);
    excluirNota(db, id);
    expect(buscar(sqlite, "outra")).toHaveLength(0);
  });

  it("pontos fixos entram na busca; caracteres especiais não quebram a consulta", async () => {
    const { buscar } = await import("./servico");
    const sqlite = (db as unknown as { $client: import("better-sqlite3").Database }).$client;
    atualizarPaciente(db, pid, { pontosFixos: "Relação com a mãe; sonho recorrente." }, AGORA);
    expect(buscar(sqlite, "MAE")[0]).toMatchObject({ origem: "fixos", pacienteId: pid });
    expect(buscar(sqlite, '"mãe" * ( ^:')).toHaveLength(1);
    expect(buscar(sqlite, "mãe OR pai")).toHaveLength(0); // OR é palavra comum, não operador
  });

  it("excluir o paciente apaga as notas e o índice", async () => {
    const { criarNota, buscar } = await import("./servico");
    const sqlite = (db as unknown as { $client: import("better-sqlite3").Database }).$client;
    criarNota(db, { pacienteId: pid, texto: "nota que some" });
    atualizarPaciente(db, pid, { status: "interrompido" }, AGORA);
    excluirPaciente(db, pid);
    expect(buscar(sqlite, "some")).toHaveLength(0);
    expect(carregarConsultorio(db, AGORA).notas).toHaveLength(0);
  });
});

describe("lançamentos e fixos mensais", () => {
  const aluguel = { tipo: "saida", descricao: "Aluguel da sala", valor: dinheiro(90000), data: "2026-09-30", categoria: "Aluguel da sala", fixo: true } as const;

  it("cria, edita e exclui; o valor é sempre positivo", async () => {
    const { criarLancamento, atualizarLancamento, excluirLancamento } = await import("./servico");
    const id = criarLancamento(db, { ...aluguel, fixo: false });
    atualizarLancamento(db, id, { valor: dinheiro(95000), descricao: "Sala" });
    const [l] = carregarConsultorio(db, AGORA).lancamentos;
    expect(l).toMatchObject({ id, valor: dinheiro(95000), descricao: "Sala", fixo: false, serieId: null });
    excluirLancamento(db, id);
    expect(carregarConsultorio(db, AGORA).lancamentos).toEqual([]);
    expect(() => excluirLancamento(db, id)).toThrow(ErroDominio);
  });

  it("recusa moeda desligada", async () => {
    const { criarLancamento } = await import("./servico");
    expect(() => criarLancamento(db, { ...aluguel, valor: dinheiro(100, "EUR") })).toThrow(/EUR/);
  });

  it("lançar fixos repete o último da série, ajusta o dia e não duplica", async () => {
    const { criarLancamento, lancarFixos, atualizarLancamento } = await import("./servico");
    const id = criarLancamento(db, aluguel);
    criarLancamento(db, { ...aluguel, descricao: "Livros", fixo: false });
    expect(lancarFixos(db, "2026-10")).toBe(1);
    expect(lancarFixos(db, "2026-10")).toBe(0);
    expect(lancarFixos(db, "2026-11")).toBe(1);
    const serie = carregarConsultorio(db, AGORA).lancamentos.filter((l) => l.serieId === id).map((l) => l.data);
    expect(serie).toEqual(["2026-11-30", "2026-10-30", "2026-09-30"]);
    // Desmarcar o fixo no último encerra a série.
    const ultimo = carregarConsultorio(db, AGORA).lancamentos.find((l) => l.data === "2026-11-30")!;
    atualizarLancamento(db, ultimo.id, { fixo: false });
    expect(lancarFixos(db, "2026-12")).toBe(0);
  });
});

describe("recibos e mensagens", () => {
  it("marca e desmarca o recibo de um pagamento", async () => {
    const { marcarRecibo } = await import("./servico");
    const conta = carregarConsultorio(db, AGORA).contas[0]!;
    const id = registrarPagamento(db, { pacienteId: pid, valor: dinheiro(25000), data: "2026-11-03", meio: "pix", contaId: conta.id, sessaoIds: [] });
    const pg = () => carregarConsultorio(db, AGORA).pagamentos.find((p) => p.id === id)!;
    expect(pg().reciboEm).toBeNull();
    marcarRecibo(db, id, { em: "2026-11-04", numero: "RS-123" });
    expect(pg()).toMatchObject({ reciboEm: "2026-11-04", reciboNumero: "RS-123" });
    marcarRecibo(db, id, { em: null, numero: "ignorado" });
    expect(pg().reciboEm).toBeNull();
    expect(pg().reciboNumero).toBeUndefined();
    expect(() => marcarRecibo(db, "nao-existe", { em: null })).toThrow(ErroDominio);
  });

  it("mensagens começam no padrão e guardam o que foi salvo", async () => {
    const { definirMensagens } = await import("./servico");
    const { MENSAGENS_PADRAO } = await import("@consultorio/shared");
    expect(carregarConsultorio(db, AGORA).mensagens).toEqual(MENSAGENS_PADRAO);
    definirMensagens(db, { ...MENSAGENS_PADRAO, chavePix: "fulana@exemplo.com" });
    expect(carregarConsultorio(db, AGORA).mensagens.chavePix).toBe("fulana@exemplo.com");
  });
});

describe("supervisão: o que foi discutido", () => {
  it("guarda texto e data, e a busca acha o texto discutido", async () => {
    const { criarNota, atualizarNota, buscar } = await import("./servico");
    const { abrirBanco } = await import("./db/conexao");
    const banco = abrirBanco(":memory:");
    const p = criarPaciente(banco.db, { ...paciente });
    const id = criarNota(banco.db, { pacienteId: p, texto: "Sonho com escadas", levarSupervisao: true });
    let n = carregarConsultorio(banco.db, AGORA).notas.find((x) => x.id === id)!;
    expect(n.supervisaoEm).toBeNull();
    expect(n.supervisaoTexto).toBeUndefined();
    atualizarNota(banco.db, id, { supervisaoTexto: "Supervisora sugeriu pensar na transferência", supervisaoEm: "2026-11-04" });
    n = carregarConsultorio(banco.db, AGORA).notas.find((x) => x.id === id)!;
    expect(n).toMatchObject({ supervisaoEm: "2026-11-04", supervisaoTexto: "Supervisora sugeriu pensar na transferência", levarSupervisao: true });
    expect(buscar(banco.sqlite, "transferencia").map((r) => r.refId)).toEqual([id]);
    expect(buscar(banco.sqlite, "escadas").map((r) => r.refId)).toEqual([id]);
  });
});
