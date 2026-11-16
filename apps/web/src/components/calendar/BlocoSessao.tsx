import { useDraggable } from "@dnd-kit/core";
import { CircleDollarSign } from "lucide-react";
import { ROTULO_ESTADO, type Sessao } from "@consultorio/shared";
import { useDados } from "@/app/dados";
import { ESTILO_ESTADO, grupoEstado } from "@/components/comuns";
import { hora } from "@/lib/datas";
import { cn } from "@/lib/utils";
import { novoHorario, pixelsParaMinutos } from "./layout";
import { usePuxarBorda } from "./usePuxarBorda";

export function podeArrastar(s: Sessao): boolean {
  return s.estado === "agendada" || s.estado === "remarcada";
}

function minutosParaHora(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** Bloco de sessão posicionado na grade de horários (Dia/Semana). */
export function BlocoSessao({
  sessao: s,
  inicioMin,
  topo,
  altura,
  esquerda,
  largura,
  pxPorMin,
  fusoPrincipal,
  fusoSecundario,
  aoAbrir,
  aoRedimensionar,
}: {
  sessao: Sessao;
  inicioMin: number;
  topo: number;
  altura: number;
  esquerda: number;
  largura: number;
  pxPorMin: number;
  fusoPrincipal: string;
  fusoSecundario: string | null;
  aoAbrir: (s: Sessao) => void;
  aoRedimensionar?: (id: string, duracaoMin: number) => void;
}) {
  const { paciente, nomeExibicao } = useDados();
  const p = paciente(s.pacienteId);
  const arrastavel = podeArrastar(s);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: s.id,
    disabled: !arrastavel,
    data: { inicioMin, duracaoMin: s.duracaoMin },
  });
  const grupo = grupoEstado(s.estado);
  const redimensionavel = arrastavel && !!aoRedimensionar;
  const borda = usePuxarBorda({
    inicioMin,
    duracaoMin: s.duracaoMin,
    pxPorMin,
    ativo: redimensionavel,
    aoMudar: (d) => aoRedimensionar?.(s.id, d),
  });
  const duracaoPrevia = borda.previa;
  const alturaVista = duracaoPrevia !== null ? duracaoPrevia * pxPorMin - 2 : altura;
  const compacto = alturaVista < 44;
  const previa = isDragging && transform ? novoHorario(inicioMin, pixelsParaMinutos(transform.y, pxPorMin), s.duracaoMin) : null;

  return (
    <button
      ref={setNodeRef}
      type="button"
      {...(arrastavel ? { ...attributes, ...listeners } : {})}
      onClick={() => {
        if (!borda.engolirClique()) aoAbrir(s);
      }}
      onKeyDown={borda.teclado}
      aria-roledescription={arrastavel ? "sessão arrastável" : "sessão"}
      className={cn(
        "absolute overflow-hidden rounded-md border border-l-[3px] px-1.5 py-1 text-left text-[11px] leading-tight shadow-xs transition-shadow",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        ESTILO_ESTADO[grupo],
        arrastavel ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
        grupo === "cancelada" && "opacity-70",
        (isDragging || duracaoPrevia !== null) && "z-30 shadow-lg ring-2 ring-ring/60",
      )}
      style={{
        top: topo,
        height: Math.max(alturaVista, 20),
        left: `calc(${esquerda}% + 2px)`,
        width: `calc(${largura}% - 4px)`,
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        touchAction: arrastavel ? "none" : undefined,
      }}
    >
      <span className={cn("flex items-center gap-1 font-semibold", grupo === "cancelada" && "line-through")}>
        <span className="tabular">{previa !== null ? minutosParaHora(previa) : hora(s.inicio, fusoPrincipal)}</span>
        <span className="truncate">{nomeExibicao(p, "curto")}</span>
        {s.pago && <CircleDollarSign className="ml-auto size-3 shrink-0" aria-hidden />}
      </span>
      {!compacto && (
        <span className="mt-0.5 block truncate opacity-80">
          {fusoSecundario ? `${hora(s.inicio, fusoSecundario)} no outro fuso` : ROTULO_ESTADO[s.estado]}
        </span>
      )}
      {/* Para leitor de tela: o texto visível + o que só a cor/ícone indicam. */}
      <span className="sr-only">
        {compacto || fusoSecundario ? `, ${ROTULO_ESTADO[s.estado]}` : ""}
        {s.pago ? ", pago" : ""}
        {redimensionavel ? ". Shift + setas mudam a duração" : ""}
      </span>
      {duracaoPrevia !== null && (
        <span className="absolute right-1 bottom-1 rounded bg-background/80 px-1 text-[10px] font-medium tabular">{duracaoPrevia} min</span>
      )}
      {redimensionavel && (
        <span
          aria-hidden
          {...borda.alca}
          className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize touch-none after:absolute after:inset-x-1/3 after:bottom-0.5 after:h-0.5 after:rounded-full after:bg-current after:opacity-0 hover:after:opacity-40"
        />
      )}
    </button>
  );
}
