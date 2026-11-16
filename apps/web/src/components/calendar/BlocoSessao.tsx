import { useRef, useState, type PointerEvent as PE } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CircleDollarSign } from "lucide-react";
import { ROTULO_ESTADO, type Sessao } from "@consultorio/shared";
import { useDados } from "@/app/dados";
import { ESTILO_ESTADO, grupoEstado } from "@/components/comuns";
import { hora } from "@/lib/datas";
import { cn } from "@/lib/utils";
import { PASSO_MIN, novaDuracao, novoHorario, pixelsParaMinutos } from "./layout";

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
  // Duração em prévia enquanto a borda de baixo é puxada.
  const [duracaoPrevia, setDuracaoPrevia] = useState<number | null>(null);
  const puxando = useRef<{ y: number; acabouDe: boolean }>({ y: 0, acabouDe: false });
  const redimensionavel = arrastavel && !!aoRedimensionar;
  const alturaVista = duracaoPrevia !== null ? duracaoPrevia * pxPorMin - 2 : altura;
  const compacto = alturaVista < 44;

  const iniciarPuxar = (e: PE<HTMLSpanElement>) => {
    e.stopPropagation(); // não deixa o arrastar (dnd-kit) começar
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    puxando.current = { y: e.clientY, acabouDe: false };
    setDuracaoPrevia(s.duracaoMin);
  };
  const puxar = (e: PE<HTMLSpanElement>) => {
    if (duracaoPrevia === null) return;
    setDuracaoPrevia(novaDuracao(inicioMin, s.duracaoMin, pixelsParaMinutos(e.clientY - puxando.current.y, pxPorMin)));
  };
  const soltar = (e: PE<HTMLSpanElement>) => {
    if (duracaoPrevia === null) return;
    e.stopPropagation();
    const d = duracaoPrevia;
    setDuracaoPrevia(null);
    puxando.current.acabouDe = true;
    if (d !== s.duracaoMin) aoRedimensionar?.(s.id, d);
  };
  const previa = isDragging && transform ? novoHorario(inicioMin, pixelsParaMinutos(transform.y, pxPorMin), s.duracaoMin) : null;

  return (
    <button
      ref={setNodeRef}
      type="button"
      {...(arrastavel ? { ...attributes, ...listeners } : {})}
      onClick={() => {
        // O clique que fecha um "puxar a borda" não abre a sessão.
        if (puxando.current.acabouDe) {
          puxando.current.acabouDe = false;
          return;
        }
        aoAbrir(s);
      }}
      onKeyDown={(e) => {
        // Shift + ↑/↓ muda a duração pelo teclado.
        if (!redimensionavel || !e.shiftKey || (e.key !== "ArrowDown" && e.key !== "ArrowUp")) return;
        e.preventDefault();
        const d = novaDuracao(inicioMin, s.duracaoMin, e.key === "ArrowDown" ? PASSO_MIN : -PASSO_MIN);
        if (d !== s.duracaoMin) aoRedimensionar?.(s.id, d);
      }}
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
          onPointerDown={iniciarPuxar}
          onPointerMove={puxar}
          onPointerUp={soltar}
          onPointerCancel={() => setDuracaoPrevia(null)}
          className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize touch-none after:absolute after:inset-x-1/3 after:bottom-0.5 after:h-0.5 after:rounded-full after:bg-current after:opacity-0 hover:after:opacity-40"
        />
      )}
    </button>
  );
}
