import { useState } from "react";
import { Repeat } from "lucide-react";
import { fixosPendentes, type Lancamento } from "@consultorio/shared";
import { Button } from "@/components/ui/button";
import { useAvisos } from "@/app/avisos";
import { useDados } from "@/app/dados";
import { fmt } from "@/lib/datas";

/** Abre o diálogo de lançamento: `null` = novo; um lançamento = editar. */
export type AbrirLancamento = (l: Lancamento | null) => void;

/** "3 fixos de novembro ainda não lançados" + botão que lança todos. Some quando não há pendentes. */
export function AvisoFixos({ mes }: { mes: string }) {
  const { lancamentos, mutar } = useDados();
  const { avisar, avisarErro } = useAvisos();
  const [enviando, setEnviando] = useState(false);
  const pendentes = fixosPendentes(lancamentos, mes);
  if (pendentes.length === 0) return null;
  const nomeMes = fmt(new Date(mes + "-15T12:00:00"), "MMMM");

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-secondary/40 px-4 py-3 sm:flex-row sm:items-center">
      <Repeat className="hidden size-5 shrink-0 text-muted-foreground sm:block" aria-hidden />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium">
          {pendentes.length === 1 ? "1 fixo" : `${pendentes.length} fixos`} de {nomeMes} ainda não {pendentes.length === 1 ? "lançado" : "lançados"}
        </p>
        <p className="truncate text-muted-foreground">{pendentes.map((l) => l.descricao).join(" · ")}</p>
      </div>
      <Button
        variant="outline"
        className="bg-card"
        disabled={enviando}
        onClick={async () => {
          setEnviando(true);
          try {
            const r = await mutar<{ criados: number }>("POST", "/lancamentos/fixos", { mes });
            avisar(`${r.criados} ${r.criados === 1 ? "fixo lançado" : "fixos lançados"} em ${nomeMes}.`);
          } catch (e) {
            avisarErro(e);
          } finally {
            setEnviando(false);
          }
        }}
      >
        {pendentes.length === 1 ? "Lançar agora" : "Lançar todos"}
      </Button>
    </div>
  );
}
