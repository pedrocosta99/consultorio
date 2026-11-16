import { useMemo, useRef, useState, type PointerEvent as PE } from "react";
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
import { faixaDoDia, minutosDeHhmm, type HorarioAtendimento, type Ocorrencia, type Sessao } from "@consultorio/shared";
import { Skeleton } from "@/components/ui/skeleton";
import { capitalizar, chaveDia, fmt, hora, instanteEm, minutosDoDia, nomeFuso } from "@/lib/datas";
import { cn } from "@/lib/utils";
import { BlocoCompromisso, idOcorrencia } from "./BlocoCompromisso";
import { BlocoSessao } from "./BlocoSessao";
import { PASSO_MIN, intervaloSelecionado, novoHorario, pixelsParaMinutos, posicionar } from "./layout";

/** Intervalo "fantasma" na grade: a seleção em curso ou o horário de um evento sendo criado. */
export interface Fantasma {
  chave: string;
  inicio: number;
  duracao: number;
}

const DURACAO_PADRAO = 50;

function hhmm(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

function ColunaDia({
  chave,
  hoje,
  altura,
  minutoNoPonto,
  aoSelecionar,
  aoCriar,
  children,
}: {
  chave: string;
  hoje: boolean;
  altura: number;
  /** Minuto do dia sob o ponteiro (já contando o início da faixa). */
  minutoNoPonto: (e: PE<HTMLDivElement>) => number;
  aoSelecionar: (f: Fantasma | null) => void;
  aoCriar?: (f: Fantasma) => void;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: chave });
  const origem = useRef<number | null>(null);
  const moveu = useRef(false);

  // Mouse/caneta: apertar e arrastar seleciona o intervalo; soltar cria.
  // Toque: só o toque simples cria (arrastar continua rolando a página).
  const descer = (e: PE<HTMLDivElement>) => {
    if (!aoCriar || e.target !== e.currentTarget || e.button !== 0) return;
    const m = minutoNoPonto(e);
    if (e.pointerType === "touch") {
      origem.current = m;
      moveu.current = false;
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    origem.current = m;
    moveu.current = false;
    const { inicio } = intervaloSelecionado(m, m);
    aoSelecionar({ chave, inicio, duracao: DURACAO_PADRAO });
  };
  const mover = (e: PE<HTMLDivElement>) => {
    if (origem.current === null) return;
    if (e.pointerType === "touch") {
      moveu.current = true;
      return;
    }
    const m = minutoNoPonto(e);
    if (Math.abs(m - origem.current) < PASSO_MIN && !moveu.current) return;
    moveu.current = true;
    const { inicio, duracao } = intervaloSelecionado(origem.current, m);
    aoSelecionar({ chave, inicio, duracao });
  };
  const subir = (e: PE<HTMLDivElement>) => {
    if (origem.current === null || !aoCriar) return;
    const m = minutoNoPonto(e);
    const o = origem.current;
    origem.current = null;
    if (e.pointerType === "touch" && moveu.current) return aoSelecionar(null);
    const sel = moveu.current ? intervaloSelecionado(o, m) : { inicio: intervaloSelecionado(o, o).inicio, duracao: DURACAO_PADRAO };
    aoCriar({ chave, inicio: sel.inicio, duracao: Math.min(sel.duracao, 24 * 60 - sel.inicio) });
  };

  return (
    <div
      ref={setNodeRef}
      data-dia={chave}
      className={cn("relative border-l", aoCriar && "cursor-cell", hoje && "bg-primary/[0.035]", isOver && "bg-accent/40")}
      style={{ height: altura }}
      onPointerDown={descer}
      onPointerMove={mover}
      onPointerUp={subir}
      onPointerCancel={() => {
        origem.current = null;
        aoSelecionar(null);
      }}
    >
      {children}
    </div>
  );
}

export function GradeHorario({
  dias,
  sessoes,
  ocorrencias = [],
  agora,
  pxPorHora,
  fusoPrincipal,
  fusoSecundario,
  carregando,
  aoAbrir,
  aoAbrirDia,
  aoMover,
  aoRedimensionar,
  aoCriar,
  fantasma,
  aoAbrirCompromisso,
  horarioAtendimento,
}: {
  dias: Date[];
  /** Fora dele, a coluna fica sombreada. */
  horarioAtendimento?: HorarioAtendimento;
  sessoes: Sessao[];
  /** Compromissos e bloqueios já expandidos no intervalo visível. */
  ocorrencias?: Ocorrencia[];
  aoAbrirCompromisso?: (o: Ocorrencia) => void;
  agora: Date;
  pxPorHora: number;
  fusoPrincipal: string;
  fusoSecundario: string | null;
  carregando: boolean;
  aoAbrir: (s: Sessao) => void;
  aoAbrirDia: (d: Date) => void;
  aoMover: (id: string, diaChave: string, minutos: number) => void;
  aoRedimensionar?: (id: string, duracaoMin: number) => void;
  /** Clicar ou arrastar num horário vazio. */
  aoCriar?: (f: Fantasma) => void;
  /** Horário do evento que está sendo criado (fica marcado enquanto o diálogo está aberto). */
  fantasma?: Fantasma | null;
}) {
  const pxPorMin = pxPorHora / 60;
  const [selecao, setSelecao] = useState<Fantasma | null>(null);
  const marcado = selecao ?? fantasma ?? null;
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
  const ocorrenciasPorDia = useMemo(() => {
    const mapa = new Map<string, Ocorrencia[]>();
    for (const o of ocorrencias) {
      const k = chaveDia(o.inicio, fusoPrincipal);
      mapa.set(k, [...(mapa.get(k) ?? []), o]);
    }
    return mapa;
  }, [ocorrencias, fusoPrincipal]);

  // Faixa de horas: 07–22, ampliada se houver sessão fora dela.
  const [horaIni, horaFim] = useMemo(() => {
    let ini = 7;
    let fim = 22;
    for (const k of chaves) {
      for (const s of [...(porDia.get(k) ?? []), ...(ocorrenciasPorDia.get(k) ?? [])]) {
        const m = minutosDoDia(s.inicio, fusoPrincipal);
        ini = Math.min(ini, Math.floor(m / 60));
        fim = Math.max(fim, Math.ceil((m + s.duracaoMin) / 60));
      }
    }
    return [ini, Math.min(24, fim)];
  }, [chaves, porDia, ocorrenciasPorDia, fusoPrincipal]);

  const horas = Array.from({ length: horaFim - horaIni }, (_, i) => horaIni + i);
  const alturaTotal = horas.length * pxPorHora;
  const gutter = fusoSecundario ? 96 : 52;
  const colunas = `${gutter}px repeat(${dias.length}, minmax(0, 1fr))`;
  const minAgora = minutosDoDia(agora, fusoPrincipal);
  const minutoNoPonto = (e: PE<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return Math.max(0, Math.min(24 * 60 - 1, horaIni * 60 + (e.clientY - r.top) / pxPorMin));
  };

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
                  <div key={h} data-hora={h} className="absolute right-1.5 left-0 flex justify-end gap-2 text-[10px] text-muted-foreground tabular" style={{ top: i * pxPorHora + 2 }}>
                    {sec && <span className="opacity-70">{sec}</span>}
                    <span>{String(h).padStart(2, "0")}:00</span>
                  </div>
                );
              })}
            </div>

            {dias.map((_, i) => {
              const chave = chaves[i]!;
              const lista = porDia.get(chave) ?? [];
              const doDia = ocorrenciasPorDia.get(chave) ?? [];
              const pos = posicionar([
                ...lista.map((s) => {
                  const ini = minutosDoDia(s.inicio, fusoPrincipal);
                  return { id: s.id, inicio: ini, fim: ini + s.duracaoMin };
                }),
                ...doDia.map((o) => {
                  const ini = minutosDoDia(o.inicio, fusoPrincipal);
                  return { id: idOcorrencia(o), inicio: ini, fim: ini + o.duracaoMin };
                }),
              ]);
              const hoje = chave === hojeChave;
              return (
                <ColunaDia
                  key={chave}
                  chave={chave}
                  hoje={hoje}
                  altura={alturaTotal}
                  minutoNoPonto={minutoNoPonto}
                  aoSelecionar={setSelecao}
                  aoCriar={
                    aoCriar && !carregando
                      ? (f) => {
                          setSelecao(null);
                          aoCriar(f);
                        }
                      : undefined
                  }
                >
                  {horarioAtendimento &&
                    (() => {
                      const f = faixaDoDia(horarioAtendimento, dias[i]!.getDay() || 7);
                      const faixas: Array<[number, number]> = f
                        ? [
                            [horaIni * 60, minutosDeHhmm(f.inicio)],
                            [minutosDeHhmm(f.fim), horaFim * 60],
                          ]
                        : [[horaIni * 60, horaFim * 60]];
                      return faixas
                        .filter(([a, b]) => b > a)
                        .map(([a, b]) => (
                          <div
                            key={a}
                            aria-hidden
                            data-fora-do-horario
                            className="pointer-events-none absolute inset-x-0 bg-muted/60"
                            style={{ top: (Math.max(a, horaIni * 60) - horaIni * 60) * pxPorMin, height: (Math.min(b, horaFim * 60) - Math.max(a, horaIni * 60)) * pxPorMin }}
                          />
                        ));
                    })()}
                  {marcado?.chave === chave && (
                    <div
                      aria-hidden
                      className="pointer-events-none absolute right-1 left-1 z-10 rounded-md border-2 border-dashed border-primary/70 bg-primary/10 px-1.5 py-1 text-[11px] font-semibold text-primary tabular"
                      style={{ top: (marcado.inicio - horaIni * 60) * pxPorMin, height: Math.max(marcado.duracao * pxPorMin - 2, 18) }}
                    >
                      {hhmm(marcado.inicio)} – {hhmm(marcado.inicio + marcado.duracao)}
                    </div>
                  )}
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
                            aoRedimensionar={aoRedimensionar}
                          />
                        );
                      })}
                  {!carregando &&
                    doDia.map((o) => {
                      const ini = minutosDoDia(o.inicio, fusoPrincipal);
                      const id = idOcorrencia(o);
                      const { coluna, colunas: n } = pos.get(id) ?? { coluna: 0, colunas: 1 };
                      return (
                        <BlocoCompromisso
                          key={id}
                          ocorrencia={o}
                          inicioMin={ini}
                          topo={(ini - horaIni * 60) * pxPorMin}
                          altura={o.duracaoMin * pxPorMin - 2}
                          esquerda={(coluna / n) * 100}
                          largura={100 / n}
                          pxPorMin={pxPorMin}
                          fusoPrincipal={fusoPrincipal}
                          aoAbrir={(x) => aoAbrirCompromisso?.(x)}
                          aoRedimensionar={aoRedimensionar}
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
