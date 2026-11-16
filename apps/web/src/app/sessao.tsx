/**
 * Sessão de quem está usando o app.
 *
 * Por enquanto o login é SIMULADO (Fase 6.1): a versão local abre direto, já logada
 * como o dono (regra do CLAUDE.md). As telas de acesso existem para serem revisadas e
 * testadas; na Fase 6.3 o `provedorSimulado` dá lugar ao Firebase Auth (Identity
 * Platform), sem mudar as telas.
 *
 *   ?mock=deslogado  → abre na tela de entrar
 *
 * Na simulação, qualquer e-mail e senha entram; e-mail com "mfa" pede o código do
 * autenticador; com "semacesso" cai na tela "sem acesso".
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { SessaoUsuario } from "@consultorio/shared";
import { api } from "@/lib/api";

export type ResultadoEntrada = { tipo: "entrou" } | { tipo: "codigo" } | { tipo: "sem_acesso"; email: string };

export interface ProvedorAcesso {
  /** Sessão atual, ou null se ninguém entrou. */
  atual(): Promise<SessaoUsuario | null>;
  entrarComGoogle(): Promise<ResultadoEntrada>;
  entrarComSenha(email: string, senha: string): Promise<ResultadoEntrada>;
  /** Segundo fator (app autenticador). */
  confirmarCodigo(codigo: string): Promise<ResultadoEntrada>;
  /** Manda o link de nova senha (a resposta não diz se a conta existe). */
  enviarRecuperacao(email: string): Promise<void>;
  aceitarConvite(token: string, dados: { nome: string; senha: string } | "google"): Promise<ResultadoEntrada>;
  sair(): Promise<void>;
}

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

function provedorSimulado(): ProvedorAcesso {
  let logado = new URLSearchParams(window.location.search).get("mock") !== "deslogado";
  const entrar = async (): Promise<ResultadoEntrada> => {
    logado = true;
    return { tipo: "entrou" };
  };
  return {
    atual: async () => (logado ? api<SessaoUsuario>("GET", "/sessao") : null),
    entrarComGoogle: async () => {
      await espera(300);
      return entrar();
    },
    entrarComSenha: async (email) => {
      await espera(300);
      if (email.includes("semacesso")) return { tipo: "sem_acesso", email };
      if (email.includes("mfa")) return { tipo: "codigo" };
      return entrar();
    },
    confirmarCodigo: async (codigo) => {
      await espera(200);
      if (!/^\d{6}$/.test(codigo)) throw new Error("O código tem 6 números.");
      return entrar();
    },
    enviarRecuperacao: async () => {
      await espera(300);
    },
    aceitarConvite: async () => {
      await espera(300);
      return entrar();
    },
    sair: async () => {
      logado = false;
    },
  };
}

type Estado = "carregando" | "entrou" | "saiu";

interface Ctx {
  estado: Estado;
  sessao: SessaoUsuario | null;
  provedor: ProvedorAcesso;
  /** Relê a sessão depois de entrar. */
  atualizar: () => Promise<void>;
  sair: () => Promise<void>;
  /** Login de verdade (Fase 6.3) ou simulado. */
  simulado: boolean;
}

const SessaoCtx = createContext<Ctx | null>(null);

export function SessaoProvider({ children }: { children: ReactNode }) {
  const [provedor] = useState(provedorSimulado);
  const [sessao, setSessao] = useState<SessaoUsuario | null>(null);
  const [estado, setEstado] = useState<Estado>("carregando");

  const atualizar = useCallback(async () => {
    try {
      const s = await provedor.atual();
      setSessao(s);
      setEstado(s ? "entrou" : "saiu");
    } catch {
      setEstado("saiu");
    }
  }, [provedor]);

  useEffect(() => {
    void atualizar();
  }, [atualizar]);

  const sair = useCallback(async () => {
    await provedor.sair();
    setSessao(null);
    setEstado("saiu");
  }, [provedor]);

  const valor = useMemo<Ctx>(() => ({ estado, sessao, provedor, atualizar, sair, simulado: true }), [estado, sessao, provedor, atualizar, sair]);
  return <SessaoCtx.Provider value={valor}>{children}</SessaoCtx.Provider>;
}

export function useSessao(): Ctx {
  const c = useContext(SessaoCtx);
  if (!c) throw new Error("useSessao fora do SessaoProvider");
  return c;
}
