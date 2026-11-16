import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface OpcaoRecorrencia<T extends string> {
  valor: T;
  rotulo: string;
  descricao?: string;
}

/**
 * A pergunta do Google Agenda ao mexer em algo que se repete: "só este" ou "este e os
 * seguintes" (e, para compromissos, "todos"). A primeira opção vem marcada.
 */
export function DialogoRecorrencia<T extends string>({
  aberto,
  titulo,
  descricao,
  opcoes,
  aoEscolher,
  aoFechar,
}: {
  aberto: boolean;
  titulo: string;
  descricao?: string;
  opcoes: OpcaoRecorrencia<T>[];
  aoEscolher: (valor: T) => Promise<void> | void;
  aoFechar: () => void;
}) {
  const [escolha, setEscolha] = useState<T | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (aberto) setEscolha(opcoes[0]?.valor ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  const confirmar = async () => {
    if (!escolha) return;
    setEnviando(true);
    try {
      await aoEscolher(escolha);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && !enviando && aoFechar()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl font-medium">{titulo}</DialogTitle>
          {descricao && <DialogDescription>{descricao}</DialogDescription>}
        </DialogHeader>
        <div role="radiogroup" aria-label={titulo} className="flex flex-col gap-1.5">
          {opcoes.map((o) => {
            const marcada = escolha === o.valor;
            return (
              <button
                key={o.valor}
                type="button"
                role="radio"
                aria-checked={marcada}
                onClick={() => setEscolha(o.valor)}
                className={cn(
                  "flex items-start gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  marcada ? "border-primary bg-primary/5" : "hover:bg-muted/60",
                )}
              >
                <span
                  aria-hidden
                  className={cn("mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border", marcada && "border-primary")}
                >
                  {marcada && <span className="size-2 rounded-full bg-primary" />}
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="font-medium">{o.rotulo}</span>
                  {o.descricao && <span className="text-xs text-muted-foreground">{o.descricao}</span>}
                </span>
              </button>
            );
          })}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={aoFechar} disabled={enviando}>
            Cancelar
          </Button>
          <Button type="button" onClick={confirmar} disabled={!escolha || enviando}>
            {enviando ? "Salvando…" : "OK"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
