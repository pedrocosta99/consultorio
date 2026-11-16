/**
 * Fonte de dados do app.
 *
 * Tudo vem da API local, um recurso por vez (pacientes, sessões, notas…), com cache
 * do TanStack Query. Só a Divulgação (campanhas) ainda é FICTÍCIA.
 *
 * Parâmetro de simulação na URL (útil para revisar estados e para os testes):
 *   ?mock=vazio       → sem dados
 *   ?mock=carregando  → fica carregando para sempre
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { notifyManager, QueryClient, QueryClientProvider, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";

// O TanStack Query avisa as telas com setTimeout(0); com o relógio congelado dos testes
// visuais, isso nunca rodaria. Microtarefa dá o mesmo efeito sem depender de relógio.
notifyManager.setScheduler((cb) => queueMicrotask(cb));
import {
  gerarMocks,
  MENSAGENS_PADRAO,
  HORARIO_ATENDIMENTO_PADRAO,
  type HorarioAtendimento,
  saldoPorMoeda,
  sessaoCobravel,
  type Compromisso,
  type Cotacao,
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
import { RECURSOS, recursosAfetados, type Listas } from "@/lib/recursos";

export { recursosAfetados };
import { useAvisos } from "./avisos";
import { usePreferencias } from "./preferencias";

type ModoMock = "normal" | "vazio" | "carregando";

function lerModoMock(): ModoMock {
  const m = new URLSearchParams(window.location.search).get("mock");
  return m === "vazio" || m === "carregando" ? m : "normal";
}

const PACOTE_VAZIO: Omit<PacoteConsultorio, "agora"> = { pacientes: [], contratos: [], sessoes: [], pagamentos: [], contas: [], feriados: [], moedas: ["BRL"], notas: [], lancamentos: [], compromissos: [], mensagens: MENSAGENS_PADRAO, horarioAtendimento: HORARIO_ATENDIMENTO_PADRAO, cotacoes: [] };

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
  /** Compromissos e bloqueios da agenda (com recorrência e exceções). */
  compromissos: Compromisso[];
  horarioAtendimento: HorarioAtendimento;
  /** Cotações registradas, só para exibir valores convertidos. */
  cotacoes: Cotacao[];
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

// ── Recursos ─────────────────────────────────────────────────
// Cada recurso é uma consulta própria (TanStack Query). Uma gravação recarrega só os
// recursos que ela afeta, em vez do consultório inteiro.

interface Configuracoes {
  agora: string;
  moedas: Moeda[];
  mensagens: Mensagens;
  horarioAtendimento: HorarioAtendimento;
}

export function DadosProvider({ children }: { children: ReactNode }) {
  const [cliente] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          // Local e com um usuário só: os dados só mudam pelas gravações, que já recarregam o que afetam.
          queries: { staleTime: Infinity, refetchOnWindowFocus: false, retry: 1 },
        },
      }),
  );
  return (
    <QueryClientProvider client={cliente}>
      <DadosInterno>{children}</DadosInterno>
    </QueryClientProvider>
  );
}

function DadosInterno({ children }: { children: ReactNode }) {
  const { modoDiscreto } = usePreferencias();
  const { avisarErro } = useAvisos();
  const [modo] = useState(lerModoMock);
  const qc = useQueryClient();
  const ativo = modo !== "carregando";

  const config = useQuery({ queryKey: ["configuracoes"], queryFn: () => api<Configuracoes>("GET", "/configuracoes"), enabled: ativo });
  const listas = useQueries({
    queries: RECURSOS.map((r) => ({
      queryKey: [r],
      queryFn: () => (modo === "vazio" ? Promise.resolve([]) : api<unknown[]>("GET", `/${r}`)),
      enabled: ativo,
    })),
  });

  const erro = config.error ?? listas.find((q) => q.error)?.error ?? null;
  useEffect(() => {
    if (erro) avisarErro(erro);
  }, [erro, avisarErro]);

  const recarregar = useCallback(async () => {
    await qc.invalidateQueries();
  }, [qc]);

  const mutar = useCallback<Ctx["mutar"]>(
    async (metodo, rota, corpo) => {
      const r = await api<any>(metodo, rota, corpo);
      await Promise.all(recursosAfetados(rota).map((k) => qc.invalidateQueries({ queryKey: [k] })));
      return r;
    },
    [qc],
  );

  const atualizarSessao = useCallback<Ctx["atualizarSessao"]>(
    (id, patch) => {
      qc.setQueryData<Sessao[]>(["sessoes"], (lista) =>
        lista
          ?.map((s) => {
            if (s.id !== id) return s;
            const novo = { ...s, ...patch };
            if (!sessaoCobravel(novo.estado)) novo.pago = false;
            return novo;
          })
          .sort((a, b) => a.inicio.localeCompare(b.inicio)),
      );
      mutar("PATCH", `/sessoes/${id}`, patch).catch((e) => {
        avisarErro(e);
        recarregar().catch(() => {});
      });
    },
    [qc, mutar, recarregar, avisarErro],
  );

  const pronto = !!config.data && listas.every((q) => q.data);
  const dadosListas = Object.fromEntries(RECURSOS.map((r, i) => [r, listas[i]!.data ?? []])) as unknown as Listas;
  // As listas mudam de identidade só quando o recurso muda.
  const assinatura = listas.map((q) => q.dataUpdatedAt).join(",");

  // Divulgação: fictícia por enquanto, só com os dados fictícios carregados. Gerada a partir do relógio da API.
  const agoraApi = config.data?.agora;
  const temCartao = dadosListas.contas.some((c) => c.id === "c-cartao");
  const campanhas = useMemo(() => {
    if (!agoraApi || modo === "vazio" || !temCartao) return [];
    return gerarMocks(new Date(agoraApi)).campanhas;
  }, [agoraApi, modo, temCartao]);

  const valor = useMemo<Ctx>(() => {
    const padrao = { agora: config.data?.agora ?? new Date().toISOString(), moedas: ["BRL"] as Moeda[], mensagens: MENSAGENS_PADRAO, horarioAtendimento: HORARIO_ATENDIMENTO_PADRAO };
    // ?mock=vazio: só o relógio vem da API; o resto é o de um consultório novo.
    const cfg = config.data && modo !== "vazio" ? config.data : padrao;
    const base = { ...PACOTE_VAZIO, ...dadosListas, ...cfg };
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
      compromissos: base.compromissos ?? [],
      horarioAtendimento: base.horarioAtendimento ?? HORARIO_ATENDIMENTO_PADRAO,
      cotacoes: base.cotacoes ?? [],
      campanhas,
      carregando: !ativo || !pronto,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.data, assinatura, pronto, ativo, modo, campanhas, recarregar, mutar, atualizarSessao, modoDiscreto]);

  return <DadosCtx.Provider value={valor}>{children}</DadosCtx.Provider>;
}

export function useDados(): Ctx {
  const ctx = useContext(DadosCtx);
  if (!ctx) throw new Error("useDados fora do DadosProvider");
  return ctx;
}
