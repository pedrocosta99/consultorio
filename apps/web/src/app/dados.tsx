/**
 * Fonte de dados do app.
 *
 * Consultório (pacientes, contratos, sessões, pagamentos, contas, feriados), notas e
 * lançamentos de Finanças: vêm da API local (banco SQLite). Só a Divulgação
 * (campanhas) ainda é FICTÍCIA.
 *
 * Parâmetro de simulação na URL (útil para revisar estados e para os testes):
 *   ?mock=vazio       → sem dados
 *   ?mock=carregando  → fica carregando para sempre
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  gerarMocks,
  MENSAGENS_PADRAO,
  saldoPorMoeda,
  sessaoCobravel,
  type Dinheiro,
  type Feriado,
  type Mensagens,
  type Mocks,
  type Moeda,
  type PacoteConsultorio,
  type Paciente,
  type Sessao,
} from "@consultorio/shared";
import { api } from "@/lib/api";
import { useAvisos } from "./avisos";
import { usePreferencias } from "./preferencias";

type ModoMock = "normal" | "vazio" | "carregando";

function lerModoMock(): ModoMock {
  const m = new URLSearchParams(window.location.search).get("mock");
  return m === "vazio" || m === "carregando" ? m : "normal";
}

const PACOTE_VAZIO: Omit<PacoteConsultorio, "agora"> = { pacientes: [], contratos: [], sessoes: [], pagamentos: [], contas: [], feriados: [], moedas: ["BRL"], notas: [], lancamentos: [], mensagens: MENSAGENS_PADRAO };

type Metodo = "POST" | "PATCH" | "PUT" | "DELETE";

interface Ctx extends Mocks {
  carregando: boolean;
  /** Pacientes arquivados (fora das listas, prontuário guardado). */
  arquivados: Paciente[];
  feriados: Feriado[];
  /** Moedas ligadas (BRL sempre). Contas e lançamentos de outras moedas ficam ocultos. */
  moedas: Moeda[];
  /** Chave Pix e modelos de mensagem/nota. */
  mensagens: Mensagens;
  recarregar: () => Promise<void>;
  /** Chama a API e recarrega os dados. Erros sobem para quem chamou. */
  mutar: <T = { ok: true; id?: string }>(metodo: Metodo, rota: string, corpo?: unknown) => Promise<T>;
  /** Atualização otimista de sessão (estado, horário, pago). Erros viram aviso. */
  atualizarSessao: (id: string, patch: Partial<Pick<Sessao, "estado" | "inicio" | "duracaoMin" | "pago">>) => void;
  paciente: (id: string) => Paciente | undefined;
  nomeExibicao: (p: Paciente | undefined, forma?: "curto" | "completo") => string;
  /** Saldo por moeda: cobráveis − pagamentos. Positivo = deve; negativo = crédito. */
  saldoPaciente: (pacienteId: string) => Dinheiro[];
}

const DadosCtx = createContext<Ctx | null>(null);

export function somarPorMoeda(valores: Dinheiro[]): Dinheiro[] {
  const mapa = new Map<Moeda, number>();
  for (const v of valores) mapa.set(v.moeda, (mapa.get(v.moeda) ?? 0) + v.centavos);
  const ordem: Moeda[] = ["BRL", "USD", "EUR"];
  return ordem.filter((m) => mapa.has(m)).map((m) => ({ moeda: m, centavos: mapa.get(m)! }));
}

export function DadosProvider({ children }: { children: ReactNode }) {
  const { modoDiscreto } = usePreferencias();
  const { avisarErro } = useAvisos();
  const [modo] = useState(lerModoMock);
  const [pacote, setPacote] = useState<PacoteConsultorio | null>(null);
  const versao = useRef(0);

  const recarregar = useCallback(async () => {
    if (modo === "carregando") return;
    const v = ++versao.current;
    const p = await api<PacoteConsultorio>("GET", "/consultorio");
    // Ignora respostas antigas que chegaram depois de uma mais nova.
    if (v === versao.current) setPacote(modo === "vazio" ? { ...PACOTE_VAZIO, agora: p.agora } : p);
  }, [modo]);

  useEffect(() => {
    recarregar().catch(avisarErro);
  }, [recarregar, avisarErro]);

  const mutar = useCallback<Ctx["mutar"]>(
    async (metodo, rota, corpo) => {
      const r = await api<any>(metodo, rota, corpo);
      await recarregar();
      return r;
    },
    [recarregar],
  );

  const atualizarSessao = useCallback<Ctx["atualizarSessao"]>(
    (id, patch) => {
      setPacote((p) => {
        if (!p) return p;
        const sessoes = p.sessoes
          .map((s) => {
            if (s.id !== id) return s;
            const novo = { ...s, ...patch };
            if (!sessaoCobravel(novo.estado)) novo.pago = false;
            return novo;
          })
          .sort((a, b) => a.inicio.localeCompare(b.inicio));
        return { ...p, sessoes };
      });
      mutar("PATCH", `/sessoes/${id}`, patch).catch((e) => {
        avisarErro(e);
        recarregar().catch(() => {});
      });
    },
    [mutar, recarregar, avisarErro],
  );

  // Divulgação: fictícia por enquanto, só com os dados fictícios carregados. Gerada a partir do relógio da API.
  const campanhas = useMemo(() => {
    if (!pacote || modo === "vazio" || !pacote.contas.some((c) => c.id === "c-cartao")) return [];
    return gerarMocks(new Date(pacote.agora)).campanhas;
  }, [pacote, modo]);

  const valor = useMemo<Ctx>(() => {
    const base = pacote ?? { ...PACOTE_VAZIO, agora: new Date().toISOString() };
    const porId = new Map(base.pacientes.map((p) => [p.id, p]));
    return {
      referencia: new Date(base.agora),
      pacientes: base.pacientes.filter((p) => !p.arquivadoEm),
      arquivados: base.pacientes.filter((p) => !!p.arquivadoEm),
      contratos: base.contratos,
      sessoes: base.sessoes,
      pagamentos: base.pagamentos,
      contas: base.contas.filter((c) => base.moedas.includes(c.moeda)),
      feriados: base.feriados,
      moedas: base.moedas,
      mensagens: base.mensagens ?? MENSAGENS_PADRAO,
      notas: base.notas,
      lancamentos: base.lancamentos.filter((l) => base.moedas.includes(l.valor.moeda)),
      campanhas,
      carregando: modo === "carregando" || pacote === null,
      recarregar,
      mutar,
      atualizarSessao,
      paciente: (id) => porId.get(id),
      nomeExibicao: (p, forma = "completo") => {
        if (!p) return "—";
        if (modoDiscreto) return p.apelido;
        if (forma === "completo") return p.nome;
        const [primeiro, ...resto] = p.nome.split(" ");
        return resto.length ? `${primeiro} ${resto[resto.length - 1]!.charAt(0)}.` : primeiro!;
      },
      saldoPaciente: (pacienteId) =>
        saldoPorMoeda(
          base.sessoes.filter((s) => s.pacienteId === pacienteId),
          base.pagamentos.filter((p) => p.pacienteId === pacienteId),
          new Date(),
        ),
    };
  }, [pacote, campanhas, modo, recarregar, mutar, atualizarSessao, modoDiscreto]);

  return <DadosCtx.Provider value={valor}>{children}</DadosCtx.Provider>;
}

export function useDados(): Ctx {
  const ctx = useContext(DadosCtx);
  if (!ctx) throw new Error("useDados fora do DadosProvider");
  return ctx;
}
