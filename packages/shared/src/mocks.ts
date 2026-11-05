/**
 * Dados FICTÍCIOS para a Etapa 0 (sem banco). Nenhum nome aqui corresponde a
 * pacientes reais: são personagens de ficção (cinema, romance) ou casos clássicos
 * publicados da psicanálise, pelo pseudônimo do caso.
 * Tudo é gerado de forma determinística a partir de uma data de referência, para
 * que as screenshots dos testes visuais sejam estáveis.
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
  contrato?: { dias: number[]; horario: string; valor: number; moeda?: Moeda; cobranca: Contrato["cobranca"]; duracao?: number };
};

const PACIENTES: PacienteBase[] = [
  {
    id: "p05", nome: "Elena Greco", apelido: "Lenu", origem: "indicacao",
    modalidade: "online", status: "ativo", inicioEm: "2025-06-23", fuso: "Europe/Rome",
    pontosFixos: [
      "Escritora, nascida num bairro pobre de Nápoles (o \"rione\"). Sessões em euro, de Turim ou de onde estiver morando no momento.",
      "Fala da amiga Lila em quase todas as sessões. Pergunta recorrente: \"eu escrevo ou sou escrita por ela?\"",
      "Amizade e rivalidade desde a infância: Lila largou a escola e era a genial; Lenu estudou e foi embora. Cada uma acha que a vida boa ficou com a outra.",
      "Nino Sarratore: volta sempre ao mesmo erro, com a mesma convicção.",
      "Desde que Lila sumiu, decidiu escrever tudo o que aconteceu. Hipótese: tentativa de fixar a amiga no papel para que ela não se dissolva.",
      "Sigilo: Lila também já foi paciente aqui (ver ficha). Nunca citar uma para a outra.",
    ].join("\n"),
    contrato: { dias: [3], horario: "07:00", valor: 6000, moeda: "EUR", cobranca: "sessao" },
  },
  {
    id: "p07", nome: "Lírio de Itu", apelido: "L.I.", contato: "Recado no orelhão da praça",
    origem: "indicacao", modalidade: "presencial", status: "ativo", inicioEm: "2025-01-15",
    fuso: FUSO_CONSULTORIO,
    pontosFixos: [
      "\"O Homem de Itu\" (O Bem Dotado, pornochanchada de 1978). Rapaz caipira, ingênuo, de Itu, a cidade onde tudo é grande.",
      "Indicação de Nair e Zilá, duas milionárias que o contrataram como guia turístico e depois o levaram para a cidade grande. Elas pagaram as primeiras sessões.",
      "O caso: as patroas logo descobriram que ele tem um \"dote\" fora do comum. A notícia correu, e desde então é disputado por todas as mulheres da casa (e da vizinhança). As primeiras experiências amorosas foram uma sequência de situações embaraçosas: portas que se abrem, maridos que chegam mais cedo, gente escondida no armário.",
      "Queixa: \"Doutor, o povo só me olha da cintura pra baixo.\" Sente que ninguém pergunta o nome dele.",
      "Hipótese: o atributo tomou o lugar do sujeito. Ele virou um tamanho. Trabalhar o desejo dele, não o das patroas.",
      "Contratransferência: cuidado com o riso. Ele percebe.",
      "Paga em dinheiro vivo, embrulhado num lenço.",
    ].join("\n"),
    contrato: { dias: [3], horario: "16:00", valor: 24000, cobranca: "sessao" },
  },
  {
    id: "p12", nome: "Raffaella Cerullo", apelido: "Lila", origem: "indicacao",
    modalidade: "online", status: "interrompido", inicioEm: "2025-09-01", fuso: "Europe/Rome",
    pontosFixos: [
      "A \"amiga genial\". Largou a escola no fundamental e mesmo assim lê mais que todo mundo. Desenhou sapatos, montou uma empresa de computação no rione e casou cedo demais (Stefano).",
      "Descreve episódios de \"desmarginação\": as bordas das coisas e das pessoas se dissolvem, e tudo vira uma massa sem contorno. Medo de que aconteça com ela mesma.",
      "Rejeita qualquer interpretação que soe a Lenu.",
      "Interrompeu sem aviso. Aos 66 anos sumiu de Nápoles sem deixar rastro: levou as roupas e recortou-se de todas as fotografias. Não deixou endereço nem dívida.",
      "Candidata a arquivamento (ver regra de exclusão de pacientes interrompidos no plano).",
    ].join("\n"),
  },
  {
    id: "p15", nome: "Wolfsmann", apelido: "H.L.", origem: "indicacao",
    modalidade: "online", status: "ativo", inicioEm: "2026-03-02", fuso: "Europe/Vienna",
    pontosFixos: [
      "O \"Homem dos Lobos\" (der Wolfsmann), da Bergasse 19. Aristocrata russo, chegou depois de passar por Kraepelin e por vários sanatórios. Aparece acompanhado do criado e do médico particular.",
      "O sonho (aos 4 anos): é noite, a janela se abre sozinha e na nogueira em frente estão seis ou sete lobos brancos, com cauda de raposa, imóveis, olhando fixo para ele. Acorda gritando.",
      "Hipótese do analista: cena primária vista com 1 ano e meio, reconstruída a partir do sonho. Ele mesmo nunca se lembrou dela, e diz isso a cada entrevista que dá.",
      "Prisão de ventre crônica, fobia de lobos e de borboletas, devoção religiosa obsessiva na infância (irmã mais velha, a babá Nânia).",
      "Para vencer a inércia, o analista marcou uma data de término. Funcionou… por um tempo.",
      "Perdeu a fortuna na Revolução de 1917. Desde então, os analistas fazem uma vaquinha para pagar o tratamento (cobrança mensal, quando há).",
      "Pinta lobos e nogueiras e assina as cartas com o apelido. Provável paciente para a vida toda.",
    ].join("\n"),
    contrato: { dias: [1, 3, 5], horario: "12:00", valor: 4000, moeda: "EUR", cobranca: "mensal" },
  },
  {
    id: "p16", nome: "Dora", apelido: "Dora", origem: "indicacao",
    modalidade: "presencial", status: "interrompido", inicioEm: "2025-10-14", fuso: "Europe/Vienna",
    pontosFixos: [
      "Caso \"Dora\" (Fragmento da análise de um caso de histeria). 18 anos. Trazida pelo pai, que já tinha sido paciente do analista.",
      "Queixas: tosse nervosa, afonia, enxaqueca, \"taedium vitae\" e uma carta de despedida deixada onde os pais pudessem achar.",
      "A trama: o pai tem um caso com a Sra. K.; o Sr. K. a assediou no lago (e antes, aos 14 anos, na loja). Ela sente que foi \"oferecida\" ao Sr. K. em troca da tolerância dele com o caso do pai. Ninguém acredita nela.",
      "Sonho 1: a casa pegando fogo; o pai não quer que a mãe se demore salvando a caixinha de joias.",
      "Sonho 2: vaga por uma cidade estranha, recebe carta dizendo que o pai morreu, não consegue chegar à estação.",
      "Interrompeu na 11ª semana. Avisou com 15 dias de antecedência, \"como uma governanta\". Detalhe: a governanta foi demitida pelo Sr. K.",
      "Revisão (a posteriori): o analista não viu a transferência a tempo. Também subestimou o amor dela pela Sra. K.; insistiu demais no Sr. K.",
      "Voltou uma vez, 15 meses depois, só para contar que tinha confrontado os K. e que eles admitiram tudo. Sem retorno.",
    ].join("\n"),
  },
  {
    id: "p17", nome: "Aimée", apelido: "A.", origem: "indicacao",
    modalidade: "online", status: "ativo", inicioEm: "2026-06-02", fuso: "Europe/Paris",
    pontosFixos: [
      "Caso \"Aimée\" (tese de doutorado, 1932: Da psicose paranoica em suas relações com a personalidade). Funcionária dos correios, escreve romances que ninguém publica.",
      "Em abril de 1931 esperou uma atriz famosa na porta do teatro e a atacou com uma faca. A atriz segurou a lâmina com a mão. Ninguém morreu.",
      "Delírio: as atrizes e escritoras famosas querem fazer mal ao filho dela. Escreveu cartas ao Príncipe de Gales pedindo proteção.",
      "Hipótese: \"paranoia de autopunição\". Ao atacar a atriz, golpeou o próprio ideal, a mulher que ela gostaria de ser. Depois de presa, o delírio cedeu em ~20 dias: a punição bastou.",
      "Sessões de tempo variável (tempo lógico). Às vezes 10 minutos. O analista corta quando acha que \"é aí\". Ela reclama do preço por minuto.",
      "Sigilo: o filho dela, anos depois, fez análise com o mesmo analista, sem saber que a mãe era o caso da tese. Não comentar.",
    ].join("\n"),
    contrato: { dias: [2, 4], horario: "12:00", valor: 5000, moeda: "EUR", cobranca: "sessao", duracao: 10 },
  },
];

const CAMPANHAS: Campanha[] = [
  {
    id: "cp1", nome: "Perfil · psicanálise online", plataforma: "instagram", inicio: "2026-10-01", fim: "2026-10-31",
    orcamento: dinheiro(60000), gasto: dinheiro(58740), impressoes: 18400, cliques: 412, contatos: 9, pacientesIds: [],
  },
  {
    id: "cp2", nome: "Stories · primeira conversa", plataforma: "instagram", inicio: "2026-11-01", fim: null,
    orcamento: dinheiro(40000), gasto: dinheiro(11870), impressoes: 6200, cliques: 140, contatos: 3, pacientesIds: [],
  },
  {
    id: "cp3", nome: "Busca · psicanalista SP", plataforma: "google", inicio: "2026-09-01", fim: "2026-09-30",
    orcamento: dinheiro(50000), gasto: dinheiro(48900), impressoes: 9100, cliques: 260, contatos: 6, pacientesIds: [],
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

/** Notas de sessão de cada paciente com contrato. */
const NOTAS_PROPRIAS: Record<string, string[]> = {
  p07: [
    "Chegou de chapéu de palha. Disse que em Itu ninguém reparava nele; aqui, todo mundo.",
    "Sonhou com o orelhão gigante da praça de Itu tocando sem parar. \"Até o sonho é exagerado, doutor.\"",
    "Contou que dona Nair \"derrubou a toalha sem querer\" de novo. Riu de nervoso. Primeira vez que falou da mãe.",
    "Disse que quer ser lembrado por outra coisa. Não soube dizer qual. Ficamos com a pergunta.",
  ],
  p05: [
    "Trouxe um caderno da Lila que guarda há décadas. Não abriu na sessão.",
    "Falou do Nino de novo. Percebeu que fala dele com a voz da mãe.",
    "Releu o que escreveu sobre a infância e achou que estava bom demais. \"A Lila diria que eu enfeitei.\"",
    "Sonho: as duas descem ao porão do Dom Achille para buscar as bonecas. Só uma volta, e ela não sabe qual.",
  ],
  p17: [
    "Sessão de 7 minutos. Disse \"eu queria ser ela\" e o analista se levantou. Saiu furiosa e pagou.",
    "Trouxe um capítulo novo do romance. A heroína ataca uma atriz. Achou coincidência.",
    "Falou da irmã mais velha, que criou o filho dela. \"Ela tomou o meu lugar.\" Corte.",
    "Pediu sessão de 50 minutos \"como os freudianos\". Recusado. Sessão de 12.",
  ],
  p15: [
    "Retomou o sonho: os lobos imóveis. \"Por que eles não se mexem?\" A imobilidade é o que assusta.",
    "Trouxe o envelope da vaquinha deste mês. Culpa e alívio na mesma frase.",
    "Trouxe uma tela nova: a nogueira, a janela aberta, cinco lobos. Perguntei pelos outros dois.",
    "Lembrou da babá Nânia e da irmã. Depois, longo silêncio. Disse que sente o \"véu\" de novo.",
  ],
};

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
      duracaoMin: c.duracao ?? 50,
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
  const contagemPorPaciente = new Map<string, number>();
  sessoes
    .filter((s) => s.estado === "realizada" && NOTAS_PROPRIAS[s.pacienteId])
    .slice(-30)
    .forEach((s, i) => {
      const k = contagemPorPaciente.get(s.pacienteId) ?? 0;
      contagemPorPaciente.set(s.pacienteId, k + 1);
      const proprios = NOTAS_PROPRIAS[s.pacienteId];
      notas.push({
        id: `n${String(i + 1).padStart(3, "0")}`,
        pacienteId: s.pacienteId,
        sessaoId: s.id,
        tipo: "sessao",
        texto: proprios![k % proprios!.length]!,
        tags: i % 3 === 0 ? ["sonho"] : i % 4 === 0 ? ["dinheiro", "lapso"] : [],
        levarSupervisao: i % 6 === 0,
        natureza: i % 2 === 0 ? "documental" : "pessoal",
        criadoEm: new Date(new Date(s.inicio).getTime() + 55 * 60_000).toISOString(),
      });
    });

  return { referencia, pacientes, contratos, sessoes, pagamentos, notas, contas: CONTAS, transacoes, campanhas: CAMPANHAS };
}
