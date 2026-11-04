import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { CalendarOff, ChevronLeft, ChevronRight, CircleDollarSign, Globe2, Undo2, X } from "lucide-react";
import type { Sessao } from "@consultorio/shared";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useDados } from "@/app/dados";
import { usePreferencias } from "@/app/preferencias";
import { ESTILO_ESTADO } from "@/components/comuns";
import { GradeHorario } from "@/components/calendar/GradeHorario";
import { PainelSessao } from "@/components/calendar/PainelSessao";
import { VisaoMes } from "@/components/calendar/VisaoMes";
import { capitalizar, chaveDia, FUSOS_DISPONIVEIS, fmt, hora, instanteEm, nomeFuso, noFuso, offsetFuso, SEMANA } from "@/lib/datas";
import { cn } from "@/lib/utils";

type Visao = "dia" | "semana" | "mes";
const VISOES: Visao[] = ["dia", "semana", "mes"];

function visaoPadrao(): Visao {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches ? "dia" : "semana";
}

function titulo(visao: Visao, ref: Date): string {
  if (visao === "dia") return capitalizar(fmt(ref, "EEEE, d 'de' MMMM 'de' yyyy"));
  if (visao === "mes") return capitalizar(fmt(ref, "MMMM 'de' yyyy"));
  const ini = startOfWeek(ref, SEMANA);
  const fim = endOfWeek(ref, SEMANA);
  if (isSameMonth(ini, fim)) return `${fmt(ini, "d")} – ${fmt(fim, "d 'de' MMMM 'de' yyyy")}`;
  return `${fmt(ini, "d 'de' MMM")} – ${fmt(fim, "d 'de' MMM 'de' yyyy")}`;
}

const LEGENDA = [
  ["agendada", "Agendada"],
  ["realizada", "Realizada"],
  ["falta", "Falta"],
  ["cancelada", "Cancelada"],
  ["remarcada", "Remarcada"],
] as const;

interface Aviso {
  texto: string;
  desfazer: () => void;
}

export function PaginaAgenda() {
  const { sessoes, carregando, atualizarSessao, paciente } = useDados();
  const { fusoPrincipal, fusoSecundario, atualizar } = usePreferencias();
  const [params, setParams] = useSearchParams();
  const [agora, setAgora] = useState(() => new Date());
  const [aberta, setAberta] = useState<string | null>(null);
  const [aviso, setAviso] = useState<Aviso | null>(null);

  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 6000);
    return () => clearTimeout(t);
  }, [aviso]);

  const visao: Visao = VISOES.includes(params.get("visao") as Visao) ? (params.get("visao") as Visao) : visaoPadrao();
  const hojeParede = noFuso(agora, fusoPrincipal);
  const dataParam = params.get("data");
  const ref = dataParam && /^\d{4}-\d{2}-\d{2}$/.test(dataParam) ? new Date(dataParam + "T00:00:00") : hojeParede;

  const ir = useCallback(
    (v: Visao, d: Date) =>
      setParams(
        (p) => {
          p.set("visao", v);
          p.set("data", format(d, "yyyy-MM-dd"));
          return p;
        },
        { replace: true },
      ),
    [setParams],
  );

  const passo = useCallback(
    (n: number) => ir(visao, visao === "dia" ? addDays(ref, n) : visao === "semana" ? addWeeks(ref, n) : addMonths(ref, n)),
    [ir, visao, ref],
  );

  // Atalhos: ← → navegam, T = hoje, D/S/M trocam a visão.
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || alvo.closest("input, textarea, select, [role=dialog], [contenteditable]")) return;
      const k = e.key.toLowerCase();
      if (e.key === "ArrowLeft") passo(-1);
      else if (e.key === "ArrowRight") passo(1);
      else if (k === "t") ir(visao, hojeParede);
      else if (k === "d") ir("dia", ref);
      else if (k === "s") ir("semana", ref);
      else if (k === "m") ir("mes", ref);
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [passo, ir, visao, ref, hojeParede]);

  const dias = useMemo(() => {
    if (visao === "dia") return [ref];
    if (visao === "semana") return eachDayOfInterval({ start: startOfWeek(ref, SEMANA), end: endOfWeek(ref, SEMANA) });
    return eachDayOfInterval({ start: startOfWeek(startOfMonth(ref), SEMANA), end: endOfWeek(endOfMonth(ref), SEMANA) });
  }, [visao, ref]);

  const chavesVisiveis = useMemo(() => new Set(dias.map((d) => format(d, "yyyy-MM-dd"))), [dias]);
  const visiveis = useMemo(
    () => sessoes.filter((s) => chavesVisiveis.has(chaveDia(s.inicio, fusoPrincipal))),
    [sessoes, chavesVisiveis, fusoPrincipal],
  );

  const mover = useCallback(
    (id: string, diaChave: string, minutos: number) => {
      const s = sessoes.find((x) => x.id === id);
      if (!s) return;
      const novo = instanteEm(new Date(diaChave + "T00:00:00"), minutos, fusoPrincipal).toISOString();
      if (novo === s.inicio) return;
      const anterior = s.inicio;
      atualizarSessao(id, { inicio: novo });
      const p = paciente(s.pacienteId);
      setAviso({
        texto: `${p?.apelido ?? "Sessão"} movida para ${fmt(noFuso(novo, fusoPrincipal), "EEE, d MMM")} às ${hora(novo, fusoPrincipal)}`,
        desfazer: () => atualizarSessao(id, { inicio: anterior }),
      });
    },
    [sessoes, atualizarSessao, paciente, fusoPrincipal],
  );

  const abrir = useCallback((s: Sessao) => setAberta(s.id), []);
  const abrirDia = useCallback((d: Date) => ir("dia", d), [ir]);
  const vazioTexto = visao === "dia" ? "neste dia" : visao === "semana" ? "nesta semana" : "neste mês";

  return (
    <>
      {/* Barra de ferramentas */}
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex min-w-0 items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => ir(visao, hojeParede)}>
            Hoje
          </Button>
          <div className="flex">
            <Button variant="ghost" size="icon-sm" aria-label="Anterior" onClick={() => passo(-1)}>
              <ChevronLeft aria-hidden />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Próximo" onClick={() => passo(1)}>
              <ChevronRight aria-hidden />
            </Button>
          </div>
          <h1 className="truncate text-xl font-medium sm:text-2xl" aria-live="polite">
            {titulo(visao, ref)}
          </h1>
        </div>

        <div className="flex items-center gap-2 lg:ml-auto">
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={visao}
            onValueChange={(v) => v && ir(v as Visao, ref)}
            aria-label="Visão do calendário"
          >
            <ToggleGroupItem value="dia" className="px-3">Dia</ToggleGroupItem>
            <ToggleGroupItem value="semana" className="px-3">Semana</ToggleGroupItem>
            <ToggleGroupItem value="mes" className="px-3">Mês</ToggleGroupItem>
          </ToggleGroup>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Globe2 aria-hidden />
                <span>{nomeFuso(fusoPrincipal)}</span>
                {fusoSecundario && <span className="text-muted-foreground">+ {nomeFuso(fusoSecundario)}</span>}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                Agenda em {nomeFuso(fusoPrincipal)} ({offsetFuso(fusoPrincipal)}). Mostrar também:
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup
                value={fusoSecundario ?? "nenhum"}
                onValueChange={(v) => atualizar({ fusoSecundario: v === "nenhum" ? null : v })}
              >
                <DropdownMenuRadioItem value="nenhum">Nenhum outro fuso</DropdownMenuRadioItem>
                {FUSOS_DISPONIVEIS.filter((f) => f !== fusoPrincipal).map((f) => (
                  <DropdownMenuRadioItem key={f} value={f}>
                    {nomeFuso(f)} <span className="ml-auto text-xs text-muted-foreground">{offsetFuso(f)}</span>
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Legenda */}
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
        {LEGENDA.map(([g, rotulo]) => (
          <span key={g} className="flex items-center gap-1.5">
            <span className={cn("size-2.5 rounded-[3px] border border-l-[3px]", ESTILO_ESTADO[g])} aria-hidden />
            {rotulo}
          </span>
        ))}
        <span className="flex items-center gap-1">
          <CircleDollarSign className="size-3.5" aria-hidden /> pago
        </span>
        <span className="ml-auto hidden lg:inline">Arraste para remarcar · ← → navegam · T hoje</span>
      </div>

      {!carregando && visiveis.length === 0 && (
        <div className="mb-3 flex items-center gap-3 rounded-xl border border-dashed bg-card px-4 py-3 text-sm">
          <CalendarOff className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          <span>
            <span className="font-medium">Nenhuma sessão {vazioTexto}.</span>{" "}
            <span className="text-muted-foreground">As sessões são geradas pela grade fixa de cada paciente.</span>
          </span>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => ir(visao, hojeParede)}>
            Ir para hoje
          </Button>
        </div>
      )}

      <div aria-busy={carregando}>
        {visao === "mes" ? (
          <VisaoMes
            referencia={ref}
            sessoes={visiveis}
            agora={agora}
            fusoPrincipal={fusoPrincipal}
            carregando={carregando}
            aoAbrir={abrir}
            aoAbrirDia={abrirDia}
            aoMover={mover}
          />
        ) : (
          <GradeHorario
            dias={dias}
            sessoes={visiveis}
            agora={agora}
            pxPorHora={visao === "dia" ? 64 : 48}
            fusoPrincipal={fusoPrincipal}
            fusoSecundario={fusoSecundario}
            carregando={carregando}
            aoAbrir={abrir}
            aoAbrirDia={abrirDia}
            aoMover={mover}
          />
        )}
      </div>

      <PainelSessao
        sessaoId={aberta}
        fusoPrincipal={fusoPrincipal}
        fusoSecundario={fusoSecundario}
        aoFechar={() => setAberta(null)}
        aoRemarcar={mover}
      />

      {aviso && (
        <div
          role="status"
          className="fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] z-50 mx-auto flex max-w-md items-center gap-3 rounded-xl border bg-popover px-4 py-3 text-sm shadow-lg"
        >
          <span className="min-w-0 flex-1">{aviso.texto}</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              aviso.desfazer();
              setAviso(null);
            }}
          >
            <Undo2 aria-hidden /> Desfazer
          </Button>
          <Button size="icon-sm" variant="ghost" aria-label="Fechar aviso" onClick={() => setAviso(null)}>
            <X aria-hidden />
          </Button>
        </div>
      )}
    </>
  );
}
