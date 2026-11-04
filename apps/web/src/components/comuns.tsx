import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { formatarDinheiro, ROTULO_ESTADO, type Dinheiro, type EstadoSessao, type Paciente } from "@consultorio/shared";
import { cn } from "@/lib/utils";

/** Valor monetário com números tabulares. */
export function Valor({
  valor,
  className,
  colorir = false,
  sinal = false,
}: {
  valor: Dinheiro;
  className?: string;
  colorir?: boolean;
  sinal?: boolean;
}) {
  return (
    <span
      className={cn(
        "tabular whitespace-nowrap",
        colorir && valor.centavos > 0 && "text-positivo",
        colorir && valor.centavos < 0 && "text-negativo",
        className,
      )}
    >
      {formatarDinheiro(valor, { sinal })}
    </span>
  );
}

/** Lista de valores em moedas diferentes: "R$ 500,00 · US$ 90,00". */
export function Valores({ valores, className }: { valores: Dinheiro[]; className?: string }) {
  if (valores.length === 0) return <span className={cn("tabular text-muted-foreground", className)}>—</span>;
  return (
    <span className={cn("inline-flex flex-wrap items-baseline gap-x-2", className)}>
      {valores.map((v, i) => (
        <span key={v.moeda} className="inline-flex items-baseline gap-2">
          {i > 0 && <span className="text-muted-foreground" aria-hidden>·</span>}
          <Valor valor={v} />
        </span>
      ))}
    </span>
  );
}

/** Classe do grupo visual de cada estado (as faltas compartilham a cor). */
export function grupoEstado(estado: EstadoSessao): "agendada" | "realizada" | "falta" | "cancelada" | "remarcada" {
  if (estado === "falta_cobrada" || estado === "falta_nao_cobrada") return "falta";
  return estado;
}

export const ESTILO_ESTADO: Record<ReturnType<typeof grupoEstado>, string> = {
  agendada: "bg-[var(--st-agendada-bg)] text-[var(--st-agendada-fg)] border-[var(--st-agendada-bd)]",
  realizada: "bg-[var(--st-realizada-bg)] text-[var(--st-realizada-fg)] border-[var(--st-realizada-bd)]",
  falta: "bg-[var(--st-falta-bg)] text-[var(--st-falta-fg)] border-[var(--st-falta-bd)]",
  cancelada: "bg-[var(--st-cancelada-bg)] text-[var(--st-cancelada-fg)] border-[var(--st-cancelada-bd)]",
  remarcada: "bg-[var(--st-remarcada-bg)] text-[var(--st-remarcada-fg)] border-[var(--st-remarcada-bd)]",
};

export function EstadoBadge({ estado, className }: { estado: EstadoSessao; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        ESTILO_ESTADO[grupoEstado(estado)],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {ROTULO_ESTADO[estado]}
    </span>
  );
}

const TONS_AVATAR = [
  "bg-[oklch(0.9_0.04_150)] text-[oklch(0.32_0.06_152)] dark:bg-[oklch(0.34_0.04_152)] dark:text-[oklch(0.9_0.05_150)]",
  "bg-[oklch(0.91_0.04_80)] text-[oklch(0.36_0.06_65)] dark:bg-[oklch(0.35_0.04_70)] dark:text-[oklch(0.92_0.05_85)]",
  "bg-[oklch(0.91_0.03_240)] text-[oklch(0.34_0.05_245)] dark:bg-[oklch(0.33_0.04_245)] dark:text-[oklch(0.9_0.04_240)]",
  "bg-[oklch(0.91_0.03_20)] text-[oklch(0.38_0.07_25)] dark:bg-[oklch(0.35_0.04_25)] dark:text-[oklch(0.92_0.04_25)]",
  "bg-[oklch(0.91_0.03_300)] text-[oklch(0.36_0.06_300)] dark:bg-[oklch(0.34_0.04_300)] dark:text-[oklch(0.9_0.04_300)]",
];

export function PacienteAvatar({ paciente, className }: { paciente: Paciente | undefined; className?: string }) {
  const iniciais = paciente?.apelido.replace(/\./g, "").slice(0, 2) ?? "?";
  const tom = paciente ? TONS_AVATAR[Number(paciente.id.replace(/\D/g, "")) % TONS_AVATAR.length] : TONS_AVATAR[0];
  return (
    <span
      aria-hidden
      className={cn("inline-flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold", tom, className)}
    >
      {iniciais}
    </span>
  );
}

export function CabecalhoPagina({ titulo, descricao, acoes }: { titulo: string; descricao?: ReactNode; acoes?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-medium sm:text-3xl">{titulo}</h1>
        {descricao && <p className="mt-1 text-sm text-muted-foreground">{descricao}</p>}
      </div>
      {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
    </div>
  );
}

export function EstadoVazio({
  icone: Icone,
  titulo,
  descricao,
  acao,
  className,
}: {
  icone: LucideIcon;
  titulo: string;
  descricao?: string;
  acao?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 px-6 py-12 text-center", className)}>
      <span className="mb-1 flex size-11 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
        <Icone className="size-5" aria-hidden />
      </span>
      <p className="font-serif text-lg">{titulo}</p>
      {descricao && <p className="max-w-sm text-sm text-muted-foreground">{descricao}</p>}
      {acao && <div className="mt-2">{acao}</div>}
    </div>
  );
}
