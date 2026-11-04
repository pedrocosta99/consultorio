/**
 * Dados FICTÍCIOS para a Etapa 0 (sem banco). Nenhum nome aqui corresponde a
 * pacientes reais. Tudo é gerado de forma determinística a partir de uma data
 * de referência, para que as screenshots dos testes visuais sejam estáveis.
 */
import { addDays, addWeeks, format, startOfWeek } from "date-fns";
import { chaveDiaNoFuso, instanteDeParede, paraParede } from "./fuso";
import { dinheiro, type Moeda } from "./money";
import {
  sessaoCobravel,
  type Campanha,
  type Conta,
  type Contrato,
  type EstadoSessao,
  type Nota,
  type Paciente,
  type Pagamento,
  type Sessao,
  type Transacao,
} from "./types";

export const FUSO_CONSULTORIO = "America/Sao_Paulo";

export interface Mocks {
  referencia: Date;
  pacientes: Paciente[];
  contratos: Contrato[];
  sessoes: Sessao[];
  pagamentos: Pagamento[];
  notas: Nota[];
  contas: Conta[];
  transacoes: Transacao[];
  campanhas: Campanha[];
}

// PRNG determinístico (mulberry32) semeado por string.
function semente(texto: string): () => number {
  let h = 1779033703 ^ texto.length;
  for (let i = 0; i < texto.length; i++) {
    h = Math.imul(h ^ texto.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type PacienteBase = Omit<Paciente, "pontosFixos"> & {
  pontosFixos?: string;
  contrato?: { dias: number[]; horario: string; valor: number; moeda?: Moeda; cobranca: Contrato["cobranca"] };
};

const PACIENTES: PacienteBase[] = [
  {
    id: "p01", nome: "Helena Moraes Vidal", apelido: "H.M.", contato: "(11) 90000-0101",
    origem: "particular", modalidade: "presencial", status: "ativo", inicioEm: "2025-03-10",
    fuso: FUSO_CONSULTORIO,
    pontosFixos: "Relação com a mãe atravessa quase todas as sessões.\nSonho recorrente com a casa da infância.",
    contrato: { dias: [1, 4], horario: "08:00", valor: 25000, cobranca: "mensal" },
  },
  {
    id: "p02", nome: "Rafael Antunes Brito", apelido: "R.A.", contato: "rafael.ficticio@example.com",
    origem: "indicacao", modalidade: "online", status: "ativo", inicioEm: "2025-08-04",
    fuso: FUSO_CONSULTORIO,
    contrato: { dias: [1], horario: "10:00", valor: 22000, cobranca: "sessao" },
  },
  {
    id: "p03", nome: "Lívia Cardoso Pena", apelido: "L.C.", origem: "clinica_escola",
    modalidade: "presencial", status: "ativo", inicioEm: "2026-02-02", fuso: FUSO_CONSULTORIO,
    contrato: { dias: [2], horario: "09:00", valor: 6000, cobranca: "sessao" },
  },
  {
    id: "p04", nome: "Marcos Teixeira Lago", apelido: "M.T.", contato: "(21) 90000-0404",
    origem: "particular", modalidade: "online", status: "ativo", inicioEm: "2024-11-18",
    fuso: FUSO_CONSULTORIO,
    pontosFixos: "Hipótese: inibição ligada ao lugar do pai.",
    contrato: { dias: [2, 5], horario: "14:00", valor: 28000, cobranca: "mensal" },
  },
  {
    id: "p05", nome: "Beatriz Nogueira Sá", apelido: "B.N.", origem: "particular",
    modalidade: "online", status: "ativo", inicioEm: "2025-06-23", fuso: "Europe/Lisbon",
    pontosFixos: "Mora em Lisboa desde 2024. Sessões em euro.",
    contrato: { dias: [3], horario: "07:00", valor: 6000, moeda: "EUR", cobranca: "sessao" },
  },
  {
    id: "p06", nome: "Diego Fontes Arruda", apelido: "D.F.", origem: "clinica_escola",
    modalidade: "presencial", status: "ativo", inicioEm: "2026-05-11", fuso: FUSO_CONSULTORIO,
    contrato: { dias: [3], horario: "11:00", valor: 6000, cobranca: "sessao" },
  },
  {
    id: "p07", nome: "Camila Rezende Prado", apelido: "C.R.", contato: "(11) 90000-0707",
    origem: "indicacao", modalidade: "presencial", status: "ativo", inicioEm: "2025-01-15",
    fuso: FUSO_CONSULTORIO,
    contrato: { dias: [3], horario: "16:00", valor: 24000, cobranca: "sessao" },
  },
  {
    id: "p08", nome: "Thomas Albuquerque Reis", apelido: "T.A.", origem: "particular",
    modalidade: "online", status: "ativo", inicioEm: "2026-01-12", fuso: "America/New_York",
    contrato: { dias: [4], horario: "18:00", valor: 9000, moeda: "USD", cobranca: "sessao" },
  },
  {
    id: "p09", nome: "Júlia Matos Ferraz", apelido: "J.M.", origem: "particular",
    modalidade: "presencial", status: "ativo", inicioEm: "2025-10-06", fuso: FUSO_CONSULTORIO,
    contrato: { dias: [5], horario: "09:30", valor: 23000, cobranca: "sessao" },
  },
  {
    id: "p10", nome: "Otávio Lins Barreto", apelido: "O.L.", origem: "indicacao",
    modalidade: "online", status: "pausa", inicioEm: "2025-04-01", fuso: FUSO_CONSULTORIO,
  },
  {
    id: "p11", nome: "Sofia Campos Leal", apelido: "S.C.", origem: "clinica_escola",
    modalidade: "presencial", status: "alta", inicioEm: "2025-02-17", fuso: FUSO_CONSULTORIO,
  },
  {
    id: "p12", nome: "André Pacheco Luz", apelido: "A.P.", origem: "particular",
    modalidade: "online", status: "interrompido", inicioEm: "2025-09-01", fuso: FUSO_CONSULTORIO,
  },
  {
    id: "p13", nome: "Paula Siqueira Dantas", apelido: "P.S.", origem: "anuncio",
    modalidade: "online", status: "ativo", inicioEm: "2026-10-13", fuso: FUSO_CONSULTORIO,
    contrato: { dias: [2], horario: "17:00", valor: 20000, cobranca: "sessao" },
  },
  {
    id: "p14", nome: "Igor Menezes Tavares", apelido: "I.M.", origem: "anuncio",
    modalidade: "presencial", status: "ativo", inicioEm: "2026-09-21", fuso: FUSO_CONSULTORIO,
    contrato: { dias: [1], horario: "18:00", valor: 21000, cobranca: "sessao" },
  },
];

const CAMPANHAS: Campanha[] = [
  {
    id: "cp1", nome: "Perfil · psicanálise online", plataforma: "instagram", inicio: "2026-10-01", fim: "2026-10-31",
    orcamento: dinheiro(60000), gasto: dinheiro(58740), impressoes: 18400, cliques: 412, contatos: 9, pacientesIds: ["p13"],
  },
  {
    id: "cp2", nome: "Stories · primeira conversa", plataforma: "instagram", inicio: "2026-11-01", fim: null,
    orcamento: dinheiro(40000), gasto: dinheiro(11870), impressoes: 6200, cliques: 140, contatos: 3, pacientesIds: [],
  },
  {
    id: "cp3", nome: "Busca · psicanalista SP", plataforma: "google", inicio: "2026-09-01", fim: "2026-09-30",
    orcamento: dinheiro(50000), gasto: dinheiro(48900), impressoes: 9100, cliques: 260, contatos: 6, pacientesIds: ["p14"],
  },
  {
    id: "cp4", nome: "Teste · público 30–45", plataforma: "facebook", inicio: "2026-08-10", fim: "2026-08-31",
    orcamento: dinheiro(20000), gasto: dinheiro(20000), impressoes: 7800, cliques: 95, contatos: 1, pacientesIds: [],
  },
];

const CONTAS: Conta[] = [
  { id: "c-nubank", nome: "Conta corrente", instituicao: "Nubank", pais: "BR", moeda: "BRL", tipo: "corrente", ativa: true },
  { id: "c-itau", nome: "Poupança", instituicao: "Itaú", pais: "BR", moeda: "BRL", tipo: "poupanca", ativa: true },
  { id: "c-cartao", nome: "Cartão de crédito", instituicao: "Nubank", pais: "BR", moeda: "BRL", tipo: "cartao", ativa: true },
  { id: "c-wise-usd", nome: "Wise USD", instituicao: "Wise", pais: "US", moeda: "USD", tipo: "corrente", ativa: true },
  { id: "c-wise-eur", nome: "Wise EUR", instituicao: "Wise", pais: "BE", moeda: "EUR", tipo: "corrente", ativa: true },
  { id: "c-corretora", nome: "Investimentos", instituicao: "XP", pais: "BR", moeda: "BRL", tipo: "investimento", ativa: true },
];

const CONTA_POR_MOEDA: Record<Moeda, string> = { BRL: "c-nubank", USD: "c-wise-usd", EUR: "c-wise-eur" };

function sortearEstadoPassado(r: number): EstadoSessao {
  if (r < 0.84) return "realizada";
  if (r < 0.91) return "falta_cobrada";
  if (r < 0.95) return "falta_nao_cobrada";
  if (r < 0.98) return "cancelada";
  return "remarcada";
}

export function gerarMocks(referencia: Date = new Date()): Mocks {
  const refMs = referencia.getTime();
  // "ref" é a hora de parede em Brasília (Date comum) — só para aritmética de calendário.
  const ref = paraParede(refMs, FUSO_CONSULTORIO);
  const semanaAtual = startOfWeek(ref, { weekStartsOn: 1 });
  const rnd = semente(format(semanaAtual, "yyyy-MM-dd"));

  const pacientes: Paciente[] = PACIENTES.map(({ contrato: _c, ...p }) => ({
    ...p,
    pontosFixos: p.pontosFixos ?? "",
  }));

  const contratos: Contrato[] = PACIENTES.filter((p) => p.contrato).map((p, i) => {
    const c = p.contrato!;
    return {
      id: `k${String(i + 1).padStart(2, "0")}`,
      pacienteId: p.id,
      frequencia: c.dias.length,
      diasSemana: c.dias,
      horario: c.horario,
      duracaoMin: 50,
      valor: dinheiro(c.valor, c.moeda ?? "BRL"),
      cobranca: c.cobranca,
      vigenteDe: p.inicioEm,
      vigenteAte: null,
    };
  });

  // Sessões: 14 semanas para trás e 4 para frente.
  const sessoes: Sessao[] = [];
  for (let w = -14; w <= 4; w++) {
    const inicioSemana = addWeeks(semanaAtual, w);
    for (const c of contratos) {
      const [hh, mm] = c.horario.split(":").map(Number) as [number, number];
      for (const dia of c.diasSemana) {
        const d = addDays(inicioSemana, dia - 1);
        const inicioMs = instanteDeParede(d.getFullYear(), d.getMonth(), d.getDate(), hh, mm, FUSO_CONSULTORIO);
        const diaChave = chaveDiaNoFuso(inicioMs, FUSO_CONSULTORIO);
        if (diaChave < c.vigenteDe) continue;
        const fim = inicioMs + c.duracaoMin * 60_000;
        const passada = fim <= refMs;
        const r = rnd();
        const estado: EstadoSessao = passada ? sortearEstadoPassado(r) : "agendada";
        const diasAtras = (refMs - inicioMs) / 86_400_000;
        const pago = sessaoCobravel(estado) && (diasAtras > 10 ? rnd() < 0.95 : rnd() < 0.6);
        sessoes.push({
          id: `s-${c.pacienteId}-${diaChave.replace(/-/g, "")}`,
          pacienteId: c.pacienteId,
          inicio: new Date(inicioMs).toISOString(),
          duracaoMin: c.duracaoMin,
          estado,
          valor: c.valor,
          pago,
        });
      }
    }
  }
  sessoes.sort((a, b) => a.inicio.localeCompare(b.inicio));

  // Um pagamento por sessão paga (simplificação da Etapa 0).
  const pagamentos: Pagamento[] = sessoes
    .filter((s) => s.pago)
    .map((s, i) => {
      // Pago no dia seguinte, mas nunca no futuro.
      const data = chaveDiaNoFuso(Math.min(Date.parse(s.inicio) + 86_400_000, refMs), FUSO_CONSULTORIO);
      return {
        id: `pg${String(i + 1).padStart(3, "0")}`,
        pacienteId: s.pacienteId,
        sessaoIds: [s.id],
        valor: s.valor,
        data,
        meio: s.valor.moeda === "BRL" ? (i % 5 === 0 ? "transferencia" : "pix") : "transferencia",
        contaId: CONTA_POR_MOEDA[s.valor.moeda],
      };
    });

  const nomePorId = new Map(pacientes.map((p) => [p.id, p]));

  // Transações: receitas da clínica (dos pagamentos) + gastos mensais fictícios.
  const transacoes: Transacao[] = [];
  const inicioPeriodo = addWeeks(semanaAtual, -15);
  transacoes.push(
    { id: "t-si-1", data: format(inicioPeriodo, "yyyy-MM-dd"), valor: dinheiro(1_284_550), tipo: "receita", descricao: "Saldo inicial", contaId: "c-nubank", categoria: "Ajuste" },
    { id: "t-si-2", data: format(inicioPeriodo, "yyyy-MM-dd"), valor: dinheiro(3_150_000), tipo: "receita", descricao: "Saldo inicial", contaId: "c-itau", categoria: "Ajuste" },
    { id: "t-si-3", data: format(inicioPeriodo, "yyyy-MM-dd"), valor: dinheiro(184_000, "USD"), tipo: "receita", descricao: "Saldo inicial", contaId: "c-wise-usd", categoria: "Ajuste" },
    { id: "t-si-4", data: format(inicioPeriodo, "yyyy-MM-dd"), valor: dinheiro(96_000, "EUR"), tipo: "receita", descricao: "Saldo inicial", contaId: "c-wise-eur", categoria: "Ajuste" },
    { id: "t-si-5", data: format(inicioPeriodo, "yyyy-MM-dd"), valor: dinheiro(8_640_000), tipo: "receita", descricao: "Saldo inicial", contaId: "c-corretora", categoria: "Ajuste" },
  );
  for (const pg of pagamentos) {
    const p = nomePorId.get(pg.pacienteId)!;
    transacoes.push({
      id: `t-${pg.id}`, data: pg.data, valor: pg.valor, tipo: "receita",
      descricao: `Sessão · ${p.apelido}`, contaId: pg.contaId, categoria: "Clínica",
      subcategoria: p.origem === "clinica_escola" ? "Clínica-escola" : "Particular", pacienteId: p.id,
    });
  }

  const GASTOS: Array<[dia: number, descricao: string, centavos: number, conta: string, cat: string, sub: string]> = [
    [5, "Aluguel do apartamento", -240000, "c-nubank", "Moradia", "Aluguel"],
    [5, "Sublocação da sala", -90000, "c-nubank", "Consultório", "Sala"],
    [8, "Supervisão", -40000, "c-nubank", "Formação", "Supervisão"],
    [10, "Análise pessoal", -80000, "c-nubank", "Formação", "Análise"],
    [12, "Parcela do carro", -110000, "c-nubank", "Transporte", "Parcela do carro"],
    [14, "Supermercado", -75000, "c-cartao", "Alimentação", "Mercado"],
    [17, "Internet + celular", -21990, "c-cartao", "Moradia", "Contas"],
    [19, "Livraria", -15900, "c-cartao", "Formação", "Livros"],
    [21, "Restaurantes", -38000, "c-cartao", "Alimentação", "Restaurantes"],
    [24, "Combustível e apps", -28000, "c-cartao", "Transporte", "Combustível"],
    [26, "Aporte mensal", -100000, "c-nubank", "Investimentos", "Aporte"],
    [26, "Aporte mensal", 100000, "c-corretora", "Investimentos", "Aporte"],
  ];
  for (let m = -3; m <= 0; m++) {
    const base = new Date(ref.getFullYear(), ref.getMonth() + m, 1, 12, 0);
    GASTOS.forEach(([dia, descricao, centavos, conta, cat, sub], i) => {
      const d = new Date(base.getFullYear(), base.getMonth(), dia, 12, 0);
      if (d.getTime() > ref.getTime()) return;
      const variacao = cat === "Alimentação" || cat === "Transporte" ? Math.round((rnd() - 0.5) * 20000) : 0;
      transacoes.push({
        id: `t-g${m + 4}-${i}`, data: format(d, "yyyy-MM-dd"),
        valor: dinheiro(centavos + Math.sign(centavos) * variacao),
        tipo: cat === "Investimentos" ? "transferencia" : "despesa",
        descricao, contaId: conta, categoria: cat, subcategoria: sub,
      });
    });
  }
  // Gasto com anúncios vira despesa em "Divulgação" (no cartão).
  const hojeChave = chaveDiaNoFuso(refMs, FUSO_CONSULTORIO);
  for (const c of CAMPANHAS) {
    const data = c.fim && c.fim <= hojeChave ? c.fim : hojeChave;
    if (data < c.inicio) continue;
    transacoes.push({
      id: `t-${c.id}`, data, valor: dinheiro(-c.gasto.centavos, c.gasto.moeda), tipo: "despesa",
      descricao: `Anúncio · ${c.nome}`, contaId: "c-cartao", categoria: "Divulgação",
      subcategoria: c.plataforma === "instagram" ? "Instagram" : c.plataforma === "google" ? "Google" : "Outros",
    });
  }
  transacoes.sort((a, b) => b.data.localeCompare(a.data) || a.id.localeCompare(b.id));

  // Notas: algumas notas de sessão recentes + pontos fixos.
  const notas: Nota[] = [];
  const TEXTOS = [
    "Chegou atrasado e falou disso por boa parte da sessão. Associou com a pressa no trabalho.",
    "Retomou o sonho da casa. Desta vez a porta estava aberta.",
    "Silêncio longo no início. Depois, lembrança da escola.",
    "Trouxe a questão do dinheiro: 'nunca sobra'. Lapso: disse 'sobra' por 'obra'.",
    "Sessão leve. Comentou planos para as férias.",
  ];
  sessoes
    .filter((s) => s.estado === "realizada")
    .slice(-24)
    .forEach((s, i) => {
      notas.push({
        id: `n${String(i + 1).padStart(3, "0")}`,
        pacienteId: s.pacienteId,
        sessaoId: s.id,
        tipo: "sessao",
        texto: TEXTOS[i % TEXTOS.length]!,
        tags: i % 3 === 0 ? ["sonho"] : i % 4 === 0 ? ["dinheiro", "lapso"] : [],
        levarSupervisao: i % 6 === 0,
        natureza: i % 2 === 0 ? "documental" : "pessoal",
        criadoEm: new Date(new Date(s.inicio).getTime() + 55 * 60_000).toISOString(),
      });
    });

  return { referencia, pacientes, contratos, sessoes, pagamentos, notas, contas: CONTAS, transacoes, campanhas: CAMPANHAS };
}
