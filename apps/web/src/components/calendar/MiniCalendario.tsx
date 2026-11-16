import { useState } from "react";
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, startOfMonth, startOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { capitalizar, fmt, SEMANA } from "@/lib/datas";
import { cn } from "@/lib/utils";

const INICIAIS = ["S", "T", "Q", "Q", "S", "S", "D"];

/** Mês pequeno para pular de data, como o do canto do Google Agenda. */
export function MiniCalendario({
  selecionado,
  hoje,
  marcados,
  aoEscolher,
}: {
  selecionado: Date;
  hoje: string;
  /** Dias ("yyyy-MM-dd") com algo marcado: ganham um ponto. */
  marcados?: ReadonlySet<string>;
  aoEscolher: (d: Date) => void;
}) {
  const [mes, setMes] = useState(() => startOfMonth(selecionado));
  const dias = eachDayOfInterval({ start: startOfWeek(mes, SEMANA), end: endOfWeek(endOfMonth(mes), SEMANA) });
  const sel = format(selecionado, "yyyy-MM-dd");
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{capitalizar(fmt(mes, "MMMM 'de' yyyy"))}</span>
        <span className="flex">
          <Button variant="ghost" size="icon-sm" aria-label="Mês anterior" onClick={() => setMes((m) => addMonths(m, -1))}>
            <ChevronLeft aria-hidden />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Próximo mês" onClick={() => setMes((m) => addMonths(m, 1))}>
            <ChevronRight aria-hidden />
          </Button>
        </span>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center text-xs">
        {INICIAIS.map((l, i) => (
          <span key={i} className="py-1 text-muted-foreground" aria-hidden>
            {l}
          </span>
        ))}
        {dias.map((d) => {
          const k = format(d, "yyyy-MM-dd");
          return (
            <button
              key={k}
              type="button"
              onClick={() => aoEscolher(d)}
              aria-label={fmt(d, "EEEE, d 'de' MMMM")}
              aria-current={k === hoje ? "date" : undefined}
              aria-pressed={k === sel}
              className={cn(
                "relative flex aspect-square items-center justify-center rounded-full tabular hover:bg-muted",
                !isSameMonth(d, mes) && "text-muted-foreground/60",
                k === hoje && "font-semibold text-primary",
                k === sel && "bg-primary text-primary-foreground hover:bg-primary/90",
              )}
            >
              {fmt(d, "d")}
              {marcados?.has(k) && k !== sel && <span aria-hidden className="absolute bottom-0.5 size-1 rounded-full bg-muted-foreground/60" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
