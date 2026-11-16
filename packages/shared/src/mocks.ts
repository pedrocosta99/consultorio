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
import type { Compromisso } from "./recorrencia";
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
  type Lancamento,
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
  lancamentos: Lancamento[];
  campanhas: Campanha[];
  compromissos: Compromisso[];
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
  {
    id: "p18", nome: "Flavio Bolsonaro", apelido: "S.R.", contato: "Só via assessor",
    origem: "indicacao", modalidade: "presencial", status: "ativo", inicioEm: "2026-04-09", fuso: FUSO_CONSULTORIO,
    pontosFixos: [
      "Parlamentar no terceiro mandato. Veio porque \"o advogado mandou fazer alguma coisa pela imagem\".",
      "Queixa: insônia desde que \"começaram a ler os extratos dele\".",
      "O caso: os assessores devolvem parte do salário todo mês \"por gratidão espontânea\". Uma assessora nunca pisou no gabinete; ele garante que ela \"trabalhava em espírito\".",
      "Comprou uma mansão pagando boa parte em dinheiro vivo. Diz que é \"fruto de muita economia da mesada\".",
      "Ato falho recorrente: diz \"minha verba\" querendo dizer \"minha vida\".",
      "Hipótese: o dinheiro circula como sintoma. Entra, se divide, e ninguém sabe de onde veio. Responde \"não fui eu\" antes de qualquer pergunta.",
      "Manejo: não aceitar pagamento em caixa de sapato. Emitir recibo SEMPRE.",
    ].join("\n"),
    contrato: { dias: [4], horario: "10:00", valor: 50000, cobranca: "sessao" },
  },
  {
    id: "p19", nome: "Narcisa T.", apelido: "L.P.", contato: "Falar com o mordomo",
    origem: "anuncio", modalidade: "presencial", status: "ativo", inicioEm: "2026-10-06", fuso: FUSO_CONSULTORIO,
    pontosFixos: [
      "Socialite carioca, herdeira, cinco ex-maridos. Chama a cobertura de frente para o mar de \"minha cabaninha\".",
      "Bordão: \"Que loucura!\". Serve para ressaca, enchente, divórcio e para a cor do sofá.",
      "O episódio: no meio de uma festa, subiu na mesa e anunciou ser a reencarnação de uma imperatriz bizantina (e, em outra vida, de um peixe-espada). Jogou os sapatos pela janela \"para o mar devolver\". O mar não devolveu.",
      "Delírio de grandeza com acabamento em lantejoula. Hipótese em aberto: é psicose ou é a temporada de verão? Observar até o carnaval.",
      "Chegou pelo anúncio do Instagram: achou o filtro \"chiquérrimo\".",
      "Paga por PIX de sete contas diferentes, todas no nome de ex-maridos.",
      "Contratransferência: o analista sai das sessões com vontade de comprar um iate.",
    ].join("\n"),
    contrato: { dias: [2], horario: "15:00", valor: 45000, cobranca: "sessao" },
  },
];

const CAMPANHAS: Campanha[] = [
  {
    id: "cp1", nome: "Perfil · psicanálise online", plataforma: "instagram", inicio: "2026-10-01", fim: "2026-10-31",
    orcamento: dinheiro(60000), gasto: dinheiro(58740), impressoes: 18400, cliques: 412, contatos: 9, pacientesIds: ["p19"],
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
  p18: [
    "Pagou com 37 notas de 50 dobradas em quatro. Perguntei. Disse que é \"organização\".",
    "Sonhou que o extrato bancário falava. Acordou suando e ligou para o advogado às 3h.",
    "Disse \"rachar\" seis vezes na sessão (a conta, o bolo, a pizza). Não percebeu.",
    "Veio com o advogado, que esperou na sala de espera e cobrou a hora dele.",
  ],
  p19: [
    "Chegou de óculos escuros e boá. Disse que o divã \"tem energia de iate\".",
    "Sonho: um baile no Copacabana Palace em que todos os convidados eram ela.",
    "Falou \"que loucura\" 41 vezes. Contei.",
    "Perguntou se podia trazer o cachorro e o mordomo. Só o cachorro.",
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

  // Lançamentos: fixos mensais (sala, supervisão, análise) + avulsos e o gasto com anúncios.
  const lancamentos: Lancamento[] = [];
  const FIXOS: Array<[serie: string, dia: number, descricao: string, centavos: number, categoria: string]> = [
    ["sr-sala", 5, "Aluguel da sala", 90000, "Aluguel da sala"],
    ["sr-sup", 8, "Supervisão quinzenal", 40000, "Supervisão"],
    ["sr-analise", 10, "Análise pessoal", 80000, "Análise pessoal"],
    ["sr-internet", 17, "Internet do consultório", 12990, "Outros"],
  ];
  for (let m = -3; m <= 0; m++) {
    const base = new Date(ref.getFullYear(), ref.getMonth() + m, 1, 12, 0);
    for (const [serie, dia, descricao, centavos, categoria] of FIXOS) {
      const d = new Date(base.getFullYear(), base.getMonth(), dia, 12, 0);
      if (d.getTime() > ref.getTime()) continue;
      lancamentos.push({ id: `l-${serie}-${m + 4}`, data: format(d, "yyyy-MM-dd"), valor: dinheiro(centavos), tipo: "saida", descricao, categoria, fixo: true, serieId: serie });
    }
  }
  const mesRef = (delta: number, dia: number) => format(new Date(ref.getFullYear(), ref.getMonth() + delta, dia, 12, 0), "yyyy-MM-dd");
  lancamentos.push(
    { id: "l-crp", data: mesRef(-2, 20), valor: dinheiro(56800), tipo: "saida", descricao: "Anuidade do conselho", categoria: "Conselho (CRP)", fixo: false, serieId: null },
    { id: "l-livros", data: mesRef(-1, 19), valor: dinheiro(15900), tipo: "saida", descricao: "Livros", categoria: "Formação", fixo: false, serieId: null },
    { id: "l-palestra", data: mesRef(-1, 23), valor: dinheiro(60000), tipo: "entrada", descricao: "Palestra na faculdade", categoria: "Aula/Palestra", fixo: false, serieId: null },
  );
  // Gasto com anúncios vira saída em "Divulgação".
  const hojeChave = chaveDiaNoFuso(refMs, FUSO_CONSULTORIO);
  for (const c of CAMPANHAS) {
    const data = c.fim && c.fim <= hojeChave ? c.fim : hojeChave;
    if (data < c.inicio) continue;
    lancamentos.push({ id: `l-${c.id}`, data, valor: c.gasto, tipo: "saida", descricao: `Anúncio · ${c.nome}`, categoria: "Divulgação", fixo: false, serieId: null });
  }
  lancamentos.sort((a, b) => b.data.localeCompare(a.data) || a.id.localeCompare(b.id));

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

  // Compromissos da agenda: análise pessoal toda terça e supervisão a cada 2 semanas (desde 3 semanas atrás).
  const parede = (dias: number, h: number, m = 0) => {
    const d = addDays(addWeeks(semanaAtual, -3), dias);
    return new Date(instanteDeParede(d.getFullYear(), d.getMonth(), d.getDate(), h, m, FUSO_CONSULTORIO)).toISOString();
  };
  const compromissos: Compromisso[] = [
    { id: "c-analise", tipo: "compromisso", titulo: "Análise pessoal", categoria: "Análise pessoal", inicio: parede(1, 8), duracaoMin: 50, fuso: FUSO_CONSULTORIO, recorrencia: "FREQ=WEEKLY;BYDAY=TU", excecoes: [] },
    { id: "c-supervisao", tipo: "compromisso", titulo: "Supervisão", categoria: "Supervisão", inicio: parede(4, 9), duracaoMin: 60, fuso: FUSO_CONSULTORIO, recorrencia: "FREQ=WEEKLY;INTERVAL=2;BYDAY=FR", excecoes: [] },
  ];

  return { referencia, pacientes, contratos, sessoes, pagamentos, notas, contas: CONTAS, lancamentos, campanhas: CAMPANHAS, compromissos };
}
