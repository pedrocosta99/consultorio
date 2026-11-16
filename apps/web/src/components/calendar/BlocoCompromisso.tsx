import { useDraggable } from "@dnd-kit/core";
import { Ban, Repeat } from "lucide-react";
import type { Ocorrencia } from "@consultorio/shared";
import { hora } from "@/lib/datas";
import { cn } from "@/lib/utils";
import { novoHorario, pixelsParaMinutos } from "./layout";
import { usePuxarBorda } from "./usePuxarBorda";

/** Id de arrastar de uma ocorrência: "c:<compromisso>:<data original>". */
export function idOcorrencia(o: Pick<Ocorrencia, "compromissoId" | "data">): string {
  return `c:${o.compromissoId}:${o.data}`;
}

export function lerIdOcorrencia(id: string): { compromissoId: string; data: string } | null {
  const m = /^c:(.+):(\d{4}-\d{2}-\d{2})$/.exec(id);
  return m ? { compromissoId: m[1]!, data: m[2]! } : null;
}

/** Estilo neutro: cor forte fica reservada ao estado das sessões. */
export const ESTILO_COMPROMISSO = "bg-muted text-foreground border-border border-l-muted-foreground/60";
export const ESTILO_BLOQUEIO = "bg-card text-muted-foreground border-dashed border-border border-l-muted-foreground/40";
export const LISTRAS_BLOQUEIO = "repeating-linear-gradient(135deg, transparent 0 6px, color-mix(in oklab, var(--border) 70%, transparent) 6px 7px)";

function minutosParaHora(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** Compromisso ou bloqueio na grade de horários (Dia/Semana). */
export function BlocoCompromisso({
  ocorrencia: o,
  inicioMin,
  topo,
  altura,
  esquerda,
  largura,
  pxPorMin,
  fusoPrincipal,
  aoAbrir,
  aoRedimensionar,
}: {
  ocorrencia: Ocorrencia;
  inicioMin: number;
  topo: number;
  altura: number;
  esquerda: number;
  largura: number;
  pxPorMin: number;
  fusoPrincipal: string;
  aoAbrir: (o: Ocorrencia) => void;
  aoRedimensionar?: (id: string, duracaoMin: number) => void;
}) {
  const id = idOcorrencia(o);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    data: { inicioMin, duracaoMin: o.duracaoMin },
  });
  const borda = usePuxarBorda({
    inicioMin,
    duracaoMin: o.duracaoMin,
    pxPorMin,
    ativo: !!aoRedimensionar,
    aoMudar: (d) => aoRedimensionar?.(id, d),
  });
  const alturaVista = borda.previa !== null ? borda.previa * pxPorMin - 2 : altura;
  const previa = isDragging && transform ? novoHorario(inicioMin, pixelsParaMinutos(transform.y, pxPorMin), o.duracaoMin) : null;
  const bloqueio = o.tipo === "bloqueio";

  return (
    <button
      ref={setNodeRef}
      type="button"
      {...attributes}
      {...listeners}
      onClick={() => {
        if (!borda.engolirClique()) aoAbrir(o);
      }}
      onKeyDown={(e) => {
        borda.teclado(e);
        listeners?.onKeyDown?.(e);
      }}
      aria-roledescription={bloqueio ? "bloqueio arrastável" : "compromisso arrastável"}
      className={cn(
        "absolute cursor-grab overflow-hidden rounded-md border border-l-[3px] px-1.5 py-1 text-left text-[11px] leading-tight shadow-xs active:cursor-grabbing",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        bloqueio ? ESTILO_BLOQUEIO : ESTILO_COMPROMISSO,
        (isDragging || borda.previa !== null) && "z-30 shadow-lg ring-2 ring-ring/60",
      )}
      style={{
        top: topo,
        height: Math.max(alturaVista, 20),
        left: `calc(${esquerda}% + 2px)`,
        width: `calc(${largura}% - 4px)`,
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        touchAction: "none",
        backgroundImage: bloqueio ? LISTRAS_BLOQUEIO : undefined,
      }}
    >
      <span className="flex items-center gap-1 font-semibold">
        {bloqueio && <Ban className="size-3 shrink-0" aria-hidden />}
        <span className="tabular">{previa !== null ? minutosParaHora(previa) : hora(o.inicio, fusoPrincipal)}</span>
        <span className="truncate">{o.titulo}</span>
        {o.recorrente && <Repeat className="ml-auto size-3 shrink-0 opacity-60" aria-hidden />}
      </span>
      {alturaVista >= 44 && o.categoria && <span className="mt-0.5 block truncate opacity-75">{o.categoria}</span>}
      <span className="sr-only">
        {bloqueio ? ", bloqueio" : ", compromisso"}
        {o.recorrente ? ", repete" : ""}. Shift + setas mudam a duração
      </span>
      {borda.previa !== null && (
        <span className="absolute right-1 bottom-1 rounded bg-background/80 px-1 text-[10px] font-medium tabular">{borda.previa} min</span>
      )}
      {aoRedimensionar && (
        <span
          aria-hidden
          {...borda.alca}
          className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize touch-none after:absolute after:inset-x-1/3 after:bottom-0.5 after:h-0.5 after:rounded-full after:bg-current after:opacity-0 hover:after:opacity-40"
        />
      )}
    </button>
  );
}
