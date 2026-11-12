import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { FUSO_CONSULTORIO } from "@consultorio/shared";
import { gravarPreferencia, lerPreferencia } from "@/lib/storage";
import { PALETA_PADRAO, PALETAS } from "@/lib/paletas";

export type Tema = "claro" | "escuro" | "sistema";
export type TamanhoTexto = "normal" | "grande" | "maior";

/** Tamanho base do rem: tudo (texto, espaçamentos) acompanha. */
export const ESCALA_TEXTO: Record<TamanhoTexto, string> = { normal: "100%", grande: "112.5%", maior: "125%" };

export interface Preferencias {
  tema: Tema;
  /** Fuso em que a agenda é exibida. */
  fusoPrincipal: string;
  /** Segundo fuso mostrado ao lado (null = desligado). */
  fusoSecundario: string | null;
  /** Mostra só iniciais/pseudônimo dos pacientes em toda a interface. */
  modoDiscreto: boolean;
  /** Id de uma paleta de `lib/paletas.ts`, ou "personalizada". */
  paleta: string;
  /** Usado quando `paleta` é "personalizada". */
  corPersonalizada: { matiz: number; croma: number };
  tamanhoTexto: TamanhoTexto;
}

const PADRAO: Preferencias = {
  tema: "sistema",
  fusoPrincipal: FUSO_CONSULTORIO,
  fusoSecundario: null,
  modoDiscreto: false,
  paleta: PALETA_PADRAO.id,
  corPersonalizada: { matiz: PALETA_PADRAO.matiz, croma: PALETA_PADRAO.croma },
  tamanhoTexto: "normal",
};

/** Matiz e intensidade efetivos da paleta escolhida. */
export function corDaPaleta(p: Pick<Preferencias, "paleta" | "corPersonalizada">): { matiz: number; croma: number } {
  if (p.paleta === "personalizada") return p.corPersonalizada;
  return PALETAS.find((x) => x.id === p.paleta) ?? PALETA_PADRAO;
}

const CHAVE = "consultorio:preferencias";

interface Ctx extends Preferencias {
  atualizar: (p: Partial<Preferencias>) => void;
  temaEfetivo: "claro" | "escuro";
}

const PreferenciasCtx = createContext<Ctx | null>(null);

function prefereEscuro(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function PreferenciasProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Preferencias>(() => ({ ...PADRAO, ...lerPreferencia(CHAVE, {}) }));
  const [sistemaEscuro, setSistemaEscuro] = useState(prefereEscuro);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const ouvir = () => setSistemaEscuro(mq.matches);
    mq.addEventListener("change", ouvir);
    return () => mq.removeEventListener("change", ouvir);
  }, []);

  const temaEfetivo = prefs.tema === "sistema" ? (sistemaEscuro ? "escuro" : "claro") : prefs.tema;

  useEffect(() => {
    document.documentElement.classList.toggle("dark", temaEfetivo === "escuro");
  }, [temaEfetivo]);

  const { matiz, croma } = corDaPaleta(prefs);
  useEffect(() => {
    const raiz = document.documentElement.style;
    raiz.setProperty("--matiz", String(matiz));
    raiz.setProperty("--croma", String(croma));
  }, [matiz, croma]);

  useEffect(() => {
    document.documentElement.style.fontSize = ESCALA_TEXTO[prefs.tamanhoTexto] ?? "100%";
  }, [prefs.tamanhoTexto]);

  const valor = useMemo<Ctx>(
    () => ({
      ...prefs,
      temaEfetivo,
      atualizar: (p) =>
        setPrefs((atual) => {
          const novo = { ...atual, ...p };
          gravarPreferencia(CHAVE, novo);
          return novo;
        }),
    }),
    [prefs, temaEfetivo],
  );

  return <PreferenciasCtx.Provider value={valor}>{children}</PreferenciasCtx.Provider>;
}

export function usePreferencias(): Ctx {
  const ctx = useContext(PreferenciasCtx);
  if (!ctx) throw new Error("usePreferencias fora do PreferenciasProvider");
  return ctx;
}
