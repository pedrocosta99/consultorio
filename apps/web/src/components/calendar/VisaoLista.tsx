import { Ban, CalendarClock, CircleDollarSign } from "lucide-react";
import type { Ocorrencia, Sessao } from "@consultorio/shared";
import { Skeleton } from "@/components/ui/skeleton";
import { useDados } from "@/app/dados";
import { EstadoBadge } from "@/components/comuns";
import { capitalizar, chaveDia, fmt, hora, noFuso } from "@/lib/datas";
import { cn } from "@/lib/utils";

type Item = { tipo: "s"; s: Sessao; inicio: string } | { tipo: "c"; o: Ocorrencia; inicio: string };

/** Próximos dias em lista, agrupados por dia (como a "Programação" do Google Agenda). */
export function VisaoLista({
  sessoes,
  ocorrencias,
  hojeChave,
  fusoPrincipal,
  carregando,
  aoAbrir,
  aoAbrirCompromisso,
}: {
  sessoes: Sessao[];
  ocorrencias: Ocorrencia[];
  hojeChave: string;
  fusoPrincipal: string;
  carregando: boolean;
  aoAbrir: (s: Sessao) => void;
  aoAbrirCompromisso: (o: Ocorrencia) => void;
}) {
  const { paciente, nomeExibicao } = useDados();
  if (carregando) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    );
  }
  const itens: Item[] = [
    ...sessoes.map((s) => ({ tipo: "s" as const, s, inicio: s.inicio })),
    ...ocorrencias.map((o) => ({ tipo: "c" as const, o, inicio: o.inicio })),
  ].sort((a, b) => a.inicio.localeCompare(b.inicio));
  const porDia = new Map<string, Item[]>();
  for (const x of itens) {
    const k = chaveDia(x.inicio, fusoPrincipal);
    porDia.set(k, [...(porDia.get(k) ?? []), x]);
  }
  if (porDia.size === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      {[...porDia.entries()].map(([dia, lista]) => (
        <section key={dia} aria-labelledby={`dia-${dia}`} className="overflow-hidden rounded-xl border bg-card">
          <h2 id={`dia-${dia}`} className={cn("border-b bg-muted/40 px-4 py-2 text-sm font-medium", dia === hojeChave && "text-primary")}>
            {capitalizar(fmt(noFuso(lista[0]!.inicio, fusoPrincipal), "EEEE, d 'de' MMMM"))}
            {dia === hojeChave && " · hoje"}
          </h2>
          <ul className="divide-y">
            {lista.map((x) => {
              const fim = new Date(Date.parse(x.inicio) + (x.tipo === "s" ? x.s.duracaoMin : x.o.duracaoMin) * 60_000).toISOString();
              const horario = `${hora(x.inicio, fusoPrincipal)}–${hora(fim, fusoPrincipal)}`;
              if (x.tipo === "s") {
                const p = paciente(x.s.pacienteId);
                return (
                  <li key={x.s.id}>
                    <button type="button" onClick={() => aoAbrir(x.s)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-muted/50">
                      <span className="w-24 shrink-0 text-muted-foreground tabular">{horario}</span>
                      <span className="min-w-0 flex-1 truncate font-medium">{nomeExibicao(p)}</span>
                      {x.s.pago && <CircleDollarSign className="size-4 text-muted-foreground" aria-label="pago" />}
                      <EstadoBadge estado={x.s.estado} />
                    </button>
                  </li>
                );
              }
              const bloqueio = x.o.tipo === "bloqueio";
              return (
                <li key={`${x.o.compromissoId}:${x.o.data}`}>
                  <button type="button" onClick={() => aoAbrirCompromisso(x.o)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-muted/50">
                    <span className="w-24 shrink-0 text-muted-foreground tabular">{horario}</span>
                    {bloqueio ? <Ban className="size-4 shrink-0 text-muted-foreground" aria-hidden /> : <CalendarClock className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
                    <span className="min-w-0 flex-1 truncate">{x.o.titulo}</span>
                    <span className="text-xs text-muted-foreground">{bloqueio ? "Bloqueio" : x.o.categoria || "Compromisso"}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
