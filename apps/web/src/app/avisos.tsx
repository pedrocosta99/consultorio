/** Avisos curtos no canto da tela (sucesso, erro, com ação opcional como "Desfazer"). */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { CircleAlert, CircleCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Aviso {
  id: number;
  mensagem: string;
  tipo: "ok" | "erro";
  acao?: { rotulo: string; fazer: () => void };
}

interface Ctx {
  avisar: (mensagem: string, opcoes?: { tipo?: Aviso["tipo"]; acao?: Aviso["acao"]; duracaoMs?: number }) => void;
  /** Atalho: mostra a mensagem de um erro qualquer. */
  avisarErro: (e: unknown) => void;
}

const AvisosCtx = createContext<Ctx | null>(null);
let proximo = 1;

export function AvisosProvider({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const fechar = useCallback((id: number) => setAvisos((l) => l.filter((a) => a.id !== id)), []);

  const avisar = useCallback<Ctx["avisar"]>(
    (mensagem, { tipo = "ok", acao, duracaoMs = tipo === "erro" ? 7000 : 4500 } = {}) => {
      const id = proximo++;
      setAvisos((l) => [...l.slice(-2), { id, mensagem, tipo, acao }]);
      window.setTimeout(() => fechar(id), duracaoMs);
    },
    [fechar],
  );

  const valor = useMemo<Ctx>(
    () => ({
      avisar,
      avisarErro: (e) => avisar(e instanceof Error ? e.message : "Algo deu errado.", { tipo: "erro" }),
    }),
    [avisar],
  );

  return (
    <AvisosCtx.Provider value={valor}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:items-end">
        {avisos.map((a) => (
          <div
            key={a.id}
            role={a.tipo === "erro" ? "alert" : "status"}
            className={cn(
              "pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-lg border bg-popover px-3 py-2.5 text-sm text-popover-foreground shadow-lg",
              a.tipo === "erro" && "border-destructive/40",
            )}
          >
            {a.tipo === "erro" ? (
              <CircleAlert className="size-4 shrink-0 text-destructive" aria-hidden />
            ) : (
              <CircleCheck className="size-4 shrink-0 text-positivo" aria-hidden />
            )}
            <span className="min-w-0 flex-1">{a.mensagem}</span>
            {a.acao && (
              <Button
                size="sm"
                variant="outline"
                className="h-7"
                onClick={() => {
                  a.acao!.fazer();
                  fechar(a.id);
                }}
              >
                {a.acao.rotulo}
              </Button>
            )}
            <button type="button" onClick={() => fechar(a.id)} className="text-muted-foreground hover:text-foreground" aria-label="Fechar aviso">
              <X className="size-4" aria-hidden />
            </button>
          </div>
        ))}
      </div>
    </AvisosCtx.Provider>
  );
}

export function useAvisos(): Ctx {
  const ctx = useContext(AvisosCtx);
  if (!ctx) throw new Error("useAvisos fora do AvisosProvider");
  return ctx;
}
