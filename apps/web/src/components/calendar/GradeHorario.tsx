import { useMemo } from "react";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type Modifier,
} from "@dnd-kit/core";
import { format } from "date-fns";
import type { Sessao } from "@consultorio/shared";
import { Skeleton } from "@/components/ui/skeleton";
import { capitalizar, chaveDia, fmt, hora, instanteEm, minutosDoDia, nomeFuso } from "@/lib/datas";
import { cn } from "@/lib/utils";
import { BlocoSessao } from "./BlocoSessao";
import { PASSO_MIN, novoHorario, pixelsParaMinutos, posicionar } from "./layout";

function ColunaDia({
  chave,
  hoje,
  altura,
  children,
}: {
  chave: string;
  hoje: boolean;
  altura: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: chave });
  return (
    <div
      ref={setNodeRef}
      className={cn("relative border-l", hoje && "bg-primary/[0.035]", isOver && "bg-accent/40")}
      style={{ height: altura }}
    >
      {children}
    </div>
  );
}

export function GradeHorario({
  dias,
  sessoes,
  agora,
  pxPorHora,
  fusoPrincipal,
  fusoSecundario,
  carregando,
  aoAbrir,
  aoAbrirDia,
  aoMover,
}: {
  dias: Date[];
  sessoes: Sessao[];
  agora: Date;
  pxPorHora: number;
  fusoPrincipal: string;
  fusoSecundario: string | null;
  carregando: boolean;
  aoAbrir: (s: Sessao) => void;
  aoAbrirDia: (d: Date) => void;
  aoMover: (id: string, diaChave: string, minutos: number) => void;
}) {
  const pxPorMin = pxPorHora / 60;
  const chaves = dias.map((d) => format(d, "yyyy-MM-dd"));
  const hojeChave = chaveDia(agora, fusoPrincipal);

  const porDia = useMemo(() => {
    const mapa = new Map<string, Sessao[]>();
    for (const s of sessoes) {
      const k = chaveDia(s.inicio, fusoPrincipal);
      mapa.set(k, [...(mapa.get(k) ?? []), s]);
    }
    return mapa;
  }, [sessoes, fusoPrincipal]);

  // Faixa de horas: 07–22, ampliada se houver sessão fora dela.
  const [horaIni, horaFim] = useMemo(() => {
    let ini = 7;
    let fim = 22;
    for (const k of chaves) {
      for (const s of porDia.get(k) ?? []) {
        const m = minutosDoDia(s.inicio, fusoPrincipal);
        ini = Math.min(ini, Math.floor(m / 60));
        fim = Math.max(fim, Math.ceil((m + s.duracaoMin) / 60));
      }
    }
    return [ini, Math.min(24, fim)];
  }, [chaves, porDia, fusoPrincipal]);

  const horas = Array.from({ length: horaFim - horaIni }, (_, i) => horaIni + i);
  const alturaTotal = horas.length * pxPorHora;
  const gutter = fusoSecundario ? 96 : 52;
  const colunas = `${gutter}px repeat(${dias.length}, minmax(0, 1fr))`;
  const minAgora = minutosDoDia(agora, fusoPrincipal);

  const snap: Modifier = ({ transform }) => ({
    ...transform,
    y: Math.round(transform.y / (pxPorMin * PASSO_MIN)) * pxPorMin * PASSO_MIN,
  });

  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );

  const aoSoltar = (e: DragEndEvent) => {
    const dados = e.active.data.current as { inicioMin: number; duracaoMin: number } | undefined;
    if (!dados || !e.over) return;
    const minutos = novoHorario(dados.inicioMin, pixelsParaMinutos(e.delta.y, pxPorMin), dados.duracaoMin);
    aoMover(String(e.active.id), String(e.over.id), minutos);
  };

  return (
    <div className="overflow-x-auto rounded-xl border bg-card" tabIndex={0} role="region" aria-label="Grade de horários">
      <div style={{ minWidth: dias.length > 1 ? 720 : undefined }}>
        {/* Cabeçalho dos dias */}
        <div className="grid border-b bg-card" style={{ gridTemplateColumns: colunas }}>
          <div className="flex items-end justify-end gap-2 pr-1.5 pb-1.5 text-[10px] leading-tight text-muted-foreground">
            {fusoSecundario && <span className="max-w-10 truncate opacity-70" title={nomeFuso(fusoSecundario)}>{nomeFuso(fusoSecundario)}</span>}
            <span className="max-w-10 truncate" title={nomeFuso(fusoPrincipal)}>{nomeFuso(fusoPrincipal)}</span>
          </div>
          {dias.map((d, i) => {
            const hoje = chaves[i] === hojeChave;
            return (
              <button
                key={chaves[i]}
                type="button"
                onClick={() => aoAbrirDia(d)}
                className="flex flex-col items-center gap-0.5 border-l py-2 text-xs hover:bg-muted/60"
                title={`Abrir ${fmt(d, "EEEE, d 'de' MMMM")}`}
              >
                <span className={cn("text-muted-foreground uppercase", hoje && "font-semibold text-primary")}>
                  {capitalizar(fmt(d, "EEE")).replace(".", "")}
                </span>
                <span
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full text-sm font-medium tabular",
                    hoje && "bg-primary text-primary-foreground",
                  )}
                >
                  {fmt(d, "d")}
                </span>
              </button>
            );
          })}
        </div>

        {/* Corpo */}
        <DndContext sensors={sensores} collisionDetection={pointerWithin} modifiers={[snap]} onDragEnd={aoSoltar}>
          <div
            className="relative grid"
            style={{
              gridTemplateColumns: colunas,
              backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${pxPorHora - 1}px, var(--border) ${pxPorHora - 1}px, var(--border) ${pxPorHora}px)`,
              backgroundPosition: `0 0`,
            }}
          >
            {/* Horas */}
            <div className="relative bg-card" style={{ height: alturaTotal }} aria-hidden>
              {horas.map((h, i) => {
                const sec = fusoSecundario ? hora(instanteEm(dias[0]!, h * 60, fusoPrincipal), fusoSecundario) : null;
                return (
                  <div key={h} className="absolute right-1.5 left-0 flex justify-end gap-2 text-[10px] text-muted-foreground tabular" style={{ top: i * pxPorHora + 2 }}>
                    {sec && <span className="opacity-70">{sec}</span>}
                    <span>{String(h).padStart(2, "0")}:00</span>
                  </div>
                );
              })}
            </div>

            {dias.map((_, i) => {
              const chave = chaves[i]!;
              const lista = porDia.get(chave) ?? [];
              const pos = posicionar(
                lista.map((s) => {
                  const ini = minutosDoDia(s.inicio, fusoPrincipal);
                  return { id: s.id, inicio: ini, fim: ini + s.duracaoMin };
                }),
              );
              const hoje = chave === hojeChave;
              return (
                <ColunaDia key={chave} chave={chave} hoje={hoje} altura={alturaTotal}>
                  {carregando
                    ? [2, 5, 9].map((h, j) => (
                        <Skeleton
                          key={h}
                          className="absolute right-1 left-1 rounded-md"
                          style={{ top: ((h + ((i + j) % 3)) - (horaIni - 7)) * pxPorHora, height: pxPorHora * 0.8 }}
                        />
                      ))
                    : lista.map((s) => {
                        const ini = minutosDoDia(s.inicio, fusoPrincipal);
                        const { coluna, colunas: n } = pos.get(s.id) ?? { coluna: 0, colunas: 1 };
                        return (
                          <BlocoSessao
                            key={s.id}
                            sessao={s}
                            inicioMin={ini}
                            topo={(ini - horaIni * 60) * pxPorMin}
                            altura={s.duracaoMin * pxPorMin - 2}
                            esquerda={(coluna / n) * 100}
                            largura={100 / n}
                            pxPorMin={pxPorMin}
                            fusoPrincipal={fusoPrincipal}
                            fusoSecundario={fusoSecundario}
                            aoAbrir={aoAbrir}
                          />
                        );
                      })}

                  {hoje && minAgora >= horaIni * 60 && minAgora <= horaFim * 60 && (
                    <div
                      className="pointer-events-none absolute right-0 left-0 z-20 h-0.5 bg-agora"
                      style={{ top: (minAgora - horaIni * 60) * pxPorMin }}
                      role="presentation"
                    >
                      <span className="absolute -top-[5px] -left-[5px] size-3 rounded-full bg-agora" />
                    </div>
                  )}
                </ColunaDia>
              );
            })}

            {/* Rótulo do "agora" na coluna de horas */}
            {chaves.includes(hojeChave) && minAgora >= horaIni * 60 && minAgora <= horaFim * 60 && (
              <span
                className="pointer-events-none absolute z-20 rounded bg-agora px-1 text-[10px] font-semibold text-agora-fg tabular"
                style={{ top: (minAgora - horaIni * 60) * pxPorMin - 8, right: `calc(100% - ${gutter - 2}px)` }}
              >
                {hora(agora, fusoPrincipal)}
              </span>
            )}
          </div>
        </DndContext>
      </div>
    </div>
  );
}
