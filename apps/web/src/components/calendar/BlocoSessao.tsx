import { useDraggable } from "@dnd-kit/core";
import { CircleDollarSign } from "lucide-react";
import { ROTULO_ESTADO, type Sessao } from "@consultorio/shared";
import { useDados } from "@/app/dados";
import { ESTILO_ESTADO, grupoEstado } from "@/components/comuns";
import { hora } from "@/lib/datas";
import { cn } from "@/lib/utils";
import { novoHorario, pixelsParaMinutos } from "./layout";

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
  const compacto = altura < 44;
  const previa = isDragging && transform ? novoHorario(inicioMin, pixelsParaMinutos(transform.y, pxPorMin), s.duracaoMin) : null;

  return (
    <button
      ref={setNodeRef}
      type="button"
      {...(arrastavel ? { ...attributes, ...listeners } : {})}
      onClick={() => aoAbrir(s)}
      aria-roledescription={arrastavel ? "sessão arrastável" : "sessão"}
      aria-label={`${hora(s.inicio, fusoPrincipal)}, ${nomeExibicao(p)}, ${ROTULO_ESTADO[s.estado]}${s.pago ? ", pago" : ""}`}
      className={cn(
        "absolute overflow-hidden rounded-md border border-l-[3px] px-1.5 py-1 text-left text-[11px] leading-tight shadow-xs transition-shadow",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        ESTILO_ESTADO[grupo],
        arrastavel ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
        grupo === "cancelada" && "opacity-70",
        isDragging && "z-30 shadow-lg ring-2 ring-ring/60",
      )}
      style={{
        top: topo,
        height: Math.max(altura, 20),
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
    </button>
  );
}
