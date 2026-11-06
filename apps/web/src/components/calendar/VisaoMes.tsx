import { useMemo } from "react";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, startOfMonth, startOfWeek } from "date-fns";
import { ROTULO_ESTADO, type Sessao } from "@consultorio/shared";
import { Skeleton } from "@/components/ui/skeleton";
import { useDados } from "@/app/dados";
import { ESTILO_ESTADO, grupoEstado } from "@/components/comuns";
import { chaveDia, fmt, hora, minutosDoDia, SEMANA } from "@/lib/datas";
import { cn } from "@/lib/utils";
import { podeArrastar } from "./BlocoSessao";

const NOMES_DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const MAX_VISIVEIS = 3;

function Chip({ s, fuso, aoAbrir }: { s: Sessao; fuso: string; aoAbrir: (s: Sessao) => void }) {
  const { paciente, nomeExibicao } = useDados();
  const p = paciente(s.pacienteId);
  const arrastavel = podeArrastar(s);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: s.id,
    disabled: !arrastavel,
    data: { inicioMin: minutosDoDia(s.inicio, fuso), duracaoMin: s.duracaoMin },
  });
  const grupo = grupoEstado(s.estado);
  return (
    <button
      ref={setNodeRef}
      type="button"
      {...(arrastavel ? { ...attributes, ...listeners } : {})}
      onClick={() => aoAbrir(s)}
      className={cn(
        "flex w-full items-center gap-1 truncate rounded border-l-2 px-1 py-px text-left text-[11px] leading-snug",
        ESTILO_ESTADO[grupo],
        grupo === "cancelada" && "line-through opacity-70",
        arrastavel ? "cursor-grab" : "cursor-pointer",
        isDragging && "relative z-30 shadow-lg ring-2 ring-ring/60",
      )}
      style={{
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        touchAction: arrastavel ? "none" : undefined,
      }}
    >
      <span className="tabular opacity-80">{hora(s.inicio, fuso)}</span>
      <span className="truncate font-medium">{nomeExibicao(p, "curto")}</span>
      <span className="sr-only">, {ROTULO_ESTADO[s.estado]}</span>
    </button>
  );
}

function Celula({
  dia,
  chave,
  noMes,
  hoje,
  sessoes,
  fuso,
  carregando,
  aoAbrir,
  aoAbrirDia,
}: {
  dia: Date;
  chave: string;
  noMes: boolean;
  hoje: boolean;
  sessoes: Sessao[];
  fuso: string;
  carregando: boolean;
  aoAbrir: (s: Sessao) => void;
  aoAbrirDia: (d: Date) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: chave });
  const extras = sessoes.length - MAX_VISIVEIS;
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-24 min-w-0 flex-col gap-0.5 border-t border-l p-1 sm:min-h-28",
        !noMes && "bg-muted/40",
        isOver && "bg-accent/50",
      )}
    >
      <button
        type="button"
        onClick={() => aoAbrirDia(dia)}
        aria-label={`Abrir ${fmt(dia, "d 'de' MMMM")}`}
        className={cn(
          "mb-0.5 flex size-6 items-center justify-center self-start rounded-full text-xs tabular hover:bg-muted",
          !noMes && "text-muted-foreground",
          hoje && "bg-primary font-semibold text-primary-foreground hover:bg-primary/90",
        )}
      >
        {fmt(dia, "d")}
      </button>
      {carregando ? (
        <Skeleton className="h-4 w-full rounded" />
      ) : (
        <>
          {/* No celular, só pontos; no desktop, chips */}
          <div className="flex flex-wrap gap-0.5 sm:hidden" aria-hidden>
            {sessoes.slice(0, 6).map((s) => (
              <span key={s.id} className={cn("size-1.5 rounded-full border", ESTILO_ESTADO[grupoEstado(s.estado)], "bg-current")} />
            ))}
          </div>
          <div className="hidden flex-col gap-0.5 sm:flex">
            {sessoes.slice(0, MAX_VISIVEIS).map((s) => (
              <Chip key={s.id} s={s} fuso={fuso} aoAbrir={aoAbrir} />
            ))}
            {extras > 0 && (
              <button type="button" onClick={() => aoAbrirDia(dia)} className="px-1 text-left text-[11px] font-medium text-muted-foreground hover:text-foreground">
                +{extras} mais
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function VisaoMes({
  referencia,
  sessoes,
  agora,
  fusoPrincipal,
  carregando,
  aoAbrir,
  aoAbrirDia,
  aoMover,
}: {
  referencia: Date;
  sessoes: Sessao[];
  agora: Date;
  fusoPrincipal: string;
  carregando: boolean;
  aoAbrir: (s: Sessao) => void;
  aoAbrirDia: (d: Date) => void;
  aoMover: (id: string, diaChave: string, minutos: number) => void;
}) {
  const dias = eachDayOfInterval({
    start: startOfWeek(startOfMonth(referencia), SEMANA),
    end: endOfWeek(endOfMonth(referencia), SEMANA),
  });
  const hojeChave = chaveDia(agora, fusoPrincipal);

  const porDia = useMemo(() => {
    const mapa = new Map<string, Sessao[]>();
    for (const s of sessoes) {
      const k = chaveDia(s.inicio, fusoPrincipal);
      mapa.set(k, [...(mapa.get(k) ?? []), s]);
    }
    return mapa;
  }, [sessoes, fusoPrincipal]);

  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );

  const aoSoltar = (e: DragEndEvent) => {
    const dados = e.active.data.current as { inicioMin: number } | undefined;
    if (!dados || !e.over) return;
    aoMover(String(e.active.id), String(e.over.id), dados.inicioMin); // mantém o horário
  };

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="grid grid-cols-7 text-center text-xs font-medium text-muted-foreground">
        {NOMES_DIAS.map((n) => (
          <div key={n} className="py-2">
            {n}
          </div>
        ))}
      </div>
      <DndContext sensors={sensores} collisionDetection={pointerWithin} onDragEnd={aoSoltar}>
        <div className="-ml-px grid grid-cols-7">
          {dias.map((d) => {
            const chave = format(d, "yyyy-MM-dd");
            return (
              <Celula
                key={chave}
                dia={d}
                chave={chave}
                noMes={isSameMonth(d, referencia)}
                hoje={chave === hojeChave}
                sessoes={porDia.get(chave) ?? []}
                fuso={fusoPrincipal}
                carregando={carregando}
                aoAbrir={aoAbrir}
                aoAbrirDia={aoAbrirDia}
              />
            );
          })}
        </div>
      </DndContext>
    </div>
  );
}
