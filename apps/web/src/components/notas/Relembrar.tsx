import { useState } from "react";
import { Link } from "react-router";
import { History, Pin } from "lucide-react";
import type { Nota, Paciente } from "@consultorio/shared";
import { Button } from "@/components/ui/button";
import { useDados } from "@/app/dados";
import { usePreferencias } from "@/app/preferencias";
import { capitalizar, fmt, noFuso } from "@/lib/datas";
import { Markdown } from "@/lib/markdown";
import { cn } from "@/lib/utils";

/** Última nota do paciente escrita antes de `antesDe` (ou a mais recente), ignorando `excetoSessao`. */
export function ultimaNota(notas: Nota[], sessoes: { id: string; inicio: string }[], pacienteId: string, antesDe?: string, excetoSessao?: string): Nota | undefined {
  const inicioDe = new Map(sessoes.map((s) => [s.id, s.inicio]));
  const quando = (n: Nota) => (n.sessaoId && inicioDe.get(n.sessaoId)) || n.criadoEm;
  return notas
    .filter((n) => n.pacienteId === pacienteId && (!excetoSessao || n.sessaoId !== excetoSessao))
    .filter((n) => !antesDe || quando(n) < antesDe)
    .sort((a, b) => quando(b).localeCompare(quando(a)))[0];
}

function Trecho({ texto, linhas }: { texto: string; linhas: number }) {
  const [aberto, setAberto] = useState(false);
  const longo = texto.length > linhas * 90 || texto.split("\n").length > linhas;
  return (
    <div>
      <div className={cn("text-sm leading-relaxed", !aberto && longo && "overflow-hidden")} style={!aberto && longo ? { maxHeight: `${linhas * 1.625}em` } : undefined}>
        <Markdown texto={texto} className="flex flex-col gap-1" />
      </div>
      {longo && (
        <Button variant="link" size="sm" className="h-auto px-0 text-xs" aria-expanded={aberto} onClick={() => setAberto((v) => !v)}>
          {aberto ? "Mostrar menos" : "Mostrar tudo"}
        </Button>
      )}
    </div>
  );
}

/**
 * Para reler antes de atender: pontos fixos e a nota da sessão anterior.
 * `antesDe` = início da sessão em questão (a nota dela mesma não aparece).
 */
export function Relembrar({ paciente: p, antesDe, sessaoId, className }: { paciente: Paciente; antesDe?: string; sessaoId?: string; className?: string }) {
  const { notas, sessoes } = useDados();
  const { fusoPrincipal } = usePreferencias();
  const anterior = ultimaNota(notas, sessoes, p.id, antesDe, sessaoId);
  if (!p.pontosFixos.trim() && !anterior) return null;
  const sessaoAnterior = anterior?.sessaoId ? sessoes.find((s) => s.id === anterior.sessaoId) : undefined;
  const quando = sessaoAnterior?.inicio ?? anterior?.criadoEm;

  return (
    <section aria-label="Para relembrar" className={cn("flex flex-col gap-3", className)}>
      {p.pontosFixos.trim() && (
        <div className="rounded-lg border border-[var(--st-falta-bd)]/50 bg-[var(--st-falta-bg)]/40 px-3 py-2.5">
          <h3 className="mb-1 flex items-center gap-1.5 font-sans text-xs font-medium tracking-normal text-muted-foreground">
            <Pin className="size-3.5" aria-hidden /> Pontos fixos
          </h3>
          <Trecho texto={p.pontosFixos} linhas={4} />
        </div>
      )}
      {anterior && quando && (
        <div className="rounded-lg border px-3 py-2.5">
          <h3 className="mb-1 flex items-center gap-1.5 font-sans text-xs font-medium tracking-normal text-muted-foreground">
            <History className="size-3.5" aria-hidden /> Nota anterior · {capitalizar(fmt(noFuso(quando, fusoPrincipal), "EEE, d 'de' MMM"))}
            <Link to={`/pacientes/${p.id}?aba=notas&nota=${anterior.id}`} className="ml-auto font-normal hover:text-foreground hover:underline">
              ver todas
            </Link>
          </h3>
          <Trecho texto={anterior.texto} linhas={6} />
        </div>
      )}
    </section>
  );
}
