import { Ban, CalendarClock, Pencil, Repeat, Trash2 } from "lucide-react";
import { descreverRecorrencia, type Compromisso, type Ocorrencia } from "@consultorio/shared";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { capitalizar, fmt, hora, noFuso } from "@/lib/datas";

/** Painel lateral de um compromisso ou bloqueio: o que é, quando, se repete; editar e excluir. */
export function PainelCompromisso({
  ocorrencia: o,
  compromisso: c,
  fusoPrincipal,
  aoFechar,
  aoEditar,
  aoExcluir,
}: {
  ocorrencia: Ocorrencia | null;
  compromisso: Compromisso | undefined;
  fusoPrincipal: string;
  aoFechar: () => void;
  aoEditar: () => void;
  aoExcluir: () => void;
}) {
  const fim = o ? new Date(Date.parse(o.inicio) + o.duracaoMin * 60_000).toISOString() : null;
  const bloqueio = o?.tipo === "bloqueio";
  return (
    <Sheet open={!!o && !!c} onOpenChange={(v) => !v && aoFechar()}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
        {o && c && fim && (
          <>
            <SheetHeader className="border-b pb-4">
              <div className="flex items-center gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  {bloqueio ? <Ban className="size-5" aria-hidden /> : <CalendarClock className="size-5" aria-hidden />}
                </span>
                <div className="min-w-0">
                  <SheetTitle className="truncate font-serif text-xl font-medium">{o.titulo}</SheetTitle>
                  <SheetDescription>
                    {capitalizar(fmt(noFuso(o.inicio, fusoPrincipal), "EEEE, d 'de' MMMM"))} · {hora(o.inicio, fusoPrincipal)}–{hora(fim, fusoPrincipal)}
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>
            <div className="flex flex-col gap-4 p-4 text-sm">
              <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2">
                <dt className="text-muted-foreground">Tipo</dt>
                <dd>{bloqueio ? "Bloqueio (aparece como ocupado)" : "Compromisso"}</dd>
                {!bloqueio && c.categoria && (
                  <>
                    <dt className="text-muted-foreground">Categoria</dt>
                    <dd>{c.categoria}</dd>
                  </>
                )}
                <dt className="text-muted-foreground">Duração</dt>
                <dd>{o.duracaoMin} min</dd>
                <dt className="text-muted-foreground">Repetição</dt>
                <dd className="flex items-center gap-1.5">
                  {o.recorrente && <Repeat className="size-3.5 text-muted-foreground" aria-hidden />}
                  {descreverRecorrencia(c.recorrencia, c.inicio, c.fuso)}
                </dd>
              </dl>
              {o.alterada && <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">Esta ocorrência foi alterada só neste dia.</p>}
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={aoEditar}>
                  <Pencil aria-hidden /> Editar
                </Button>
                <Button variant="outline" size="sm" onClick={aoExcluir}>
                  <Trash2 aria-hidden /> Excluir
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
