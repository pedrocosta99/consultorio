import { useRef, useState, type KeyboardEvent, type PointerEvent as PE } from "react";
import { PASSO_MIN, novaDuracao, pixelsParaMinutos } from "./layout";

/**
 * Puxar a borda de baixo de um evento na grade muda a duração (com prévia), e
 * Shift + ↑/↓ faz o mesmo pelo teclado. O clique que encerra o "puxar" não abre o evento.
 */
export function usePuxarBorda({
  inicioMin,
  duracaoMin,
  pxPorMin,
  ativo,
  aoMudar,
}: {
  inicioMin: number;
  duracaoMin: number;
  pxPorMin: number;
  ativo: boolean;
  aoMudar: (duracaoMin: number) => void;
}) {
  const [previa, setPrevia] = useState<number | null>(null);
  const estado = useRef({ y: 0, acabouDe: false });

  const alca = {
    onPointerDown: (e: PE<HTMLElement>) => {
      e.stopPropagation(); // não deixa o arrastar (dnd-kit) começar
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      estado.current = { y: e.clientY, acabouDe: false };
      setPrevia(duracaoMin);
    },
    onPointerMove: (e: PE<HTMLElement>) => {
      if (previa === null) return;
      setPrevia(novaDuracao(inicioMin, duracaoMin, pixelsParaMinutos(e.clientY - estado.current.y, pxPorMin)));
    },
    onPointerUp: (e: PE<HTMLElement>) => {
      if (previa === null) return;
      e.stopPropagation();
      const d = previa;
      setPrevia(null);
      estado.current.acabouDe = true;
      if (d !== duracaoMin) aoMudar(d);
    },
    onPointerCancel: () => setPrevia(null),
  };

  /** Use no onClick do evento: devolve true se o clique deve ser ignorado. */
  const engolirClique = () => {
    if (!estado.current.acabouDe) return false;
    estado.current.acabouDe = false;
    return true;
  };

  const teclado = (e: KeyboardEvent) => {
    if (!ativo || !e.shiftKey || (e.key !== "ArrowDown" && e.key !== "ArrowUp")) return;
    e.preventDefault();
    const d = novaDuracao(inicioMin, duracaoMin, e.key === "ArrowDown" ? PASSO_MIN : -PASSO_MIN);
    if (d !== duracaoMin) aoMudar(d);
  };

  return { previa, alca, engolirClique, teclado };
}
