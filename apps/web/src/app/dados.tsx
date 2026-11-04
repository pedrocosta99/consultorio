/**
 * Etapa 0: fonte de dados em memória a partir dos mocks fictícios.
 * Na Etapa 1 este provider passa a chamar a API local; as telas não mudam.
 *
 * Parâmetro de simulação na URL (útil para revisar estados e para os testes):
 *   ?mock=vazio       → sem dados
 *   ?mock=carregando  → fica carregando para sempre
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import {
  gerarMocks,
  sessaoCobravel,
  type Dinheiro,
  type Mocks,
  type Moeda,
  type Paciente,
  type Sessao,
} from "@consultorio/shared";
import { usePreferencias } from "./preferencias";

type ModoMock = "normal" | "vazio" | "carregando";

function lerModoMock(): ModoMock {
  const m = new URLSearchParams(window.location.search).get("mock");
  return m === "vazio" || m === "carregando" ? m : "normal";
}

function mocksVazios(referencia: Date): Mocks {
  return { referencia, pacientes: [], contratos: [], sessoes: [], pagamentos: [], notas: [], contas: [], transacoes: [] };
}

interface Ctx extends Mocks {
  carregando: boolean;
  atualizarSessao: (id: string, patch: Partial<Sessao>) => void;
  paciente: (id: string) => Paciente | undefined;
  nomeExibicao: (p: Paciente | undefined, forma?: "curto" | "completo") => string;
  /** Saldo devedor por moeda (sessões cobráveis não pagas). */
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
  const [modo] = useState(lerModoMock);
  const [base] = useState(() => {
    const agora = new Date();
    return modo === "normal" ? gerarMocks(agora) : mocksVazios(agora);
  });
  const [sessoes, setSessoes] = useState(base.sessoes);

  const atualizarSessao = useCallback((id: string, patch: Partial<Sessao>) => {
    setSessoes((lista) =>
      lista
        .map((s) => {
          if (s.id !== id) return s;
          const novo = { ...s, ...patch };
          // Sessão que deixou de ser cobrável não pode ficar "paga".
          if (!sessaoCobravel(novo.estado)) novo.pago = false;
          return novo;
        })
        .sort((a, b) => a.inicio.localeCompare(b.inicio)),
    );
  }, []);

  const valor = useMemo<Ctx>(() => {
    const porId = new Map(base.pacientes.map((p) => [p.id, p]));
    return {
      ...base,
      sessoes,
      carregando: modo === "carregando",
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
        somarPorMoeda(
          sessoes
            .filter((s) => s.pacienteId === pacienteId && sessaoCobravel(s.estado) && !s.pago)
            .map((s) => s.valor),
        ),
    };
  }, [base, sessoes, modo, atualizarSessao, modoDiscreto]);

  return <DadosCtx.Provider value={valor}>{children}</DadosCtx.Provider>;
}

export function useDados(): Ctx {
  const ctx = useContext(DadosCtx);
  if (!ctx) throw new Error("useDados fora do DadosProvider");
  return ctx;
}
