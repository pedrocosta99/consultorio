import { useEffect, useRef, useState } from "react";
import { BookmarkCheck, MessagesSquare, Undo2 } from "lucide-react";
import type { Nota } from "@consultorio/shared";
import { Button } from "@/components/ui/button";
import { useAvisos } from "@/app/avisos";
import { useDados } from "@/app/dados";
import { usePreferencias } from "@/app/preferencias";
import { chaveDia, fmt } from "@/lib/datas";
import { cn } from "@/lib/utils";

/**
 * "Discutido em supervisão": texto livre (salva sozinho) e a data em que a nota
 * foi discutida. Discutida não some: vai para a aba "Discutidas".
 */
export function DiscussaoSupervisao({ nota, className }: { nota: Nota; className?: string }) {
  const { mutar } = useDados();
  const { fusoPrincipal } = usePreferencias();
  const { avisar, avisarErro } = useAvisos();
  const [texto, setTexto] = useState(nota.supervisaoTexto ?? "");
  const [situacao, setSituacao] = useState<"" | "salvando" | "salvo" | "erro">("");
  const area = useRef<HTMLTextAreaElement>(null);
  const salvo = useRef(nota.supervisaoTexto ?? "");

  // Mudou por fora (outra tela) e não estou editando: acompanha.
  useEffect(() => {
    if (document.activeElement !== area.current) {
      setTexto(nota.supervisaoTexto ?? "");
      salvo.current = nota.supervisaoTexto ?? "";
    }
  }, [nota.supervisaoTexto]);

  useEffect(() => {
    if (texto === salvo.current) return;
    const t = window.setTimeout(() => {
      setSituacao("salvando");
      mutar("PATCH", `/notas/${nota.id}`, { supervisaoTexto: texto })
        .then(() => {
          salvo.current = texto;
          setSituacao("salvo");
        })
        .catch(() => setSituacao("erro"));
    }, 900);
    return () => window.clearTimeout(t);
  }, [texto, nota.id, mutar]);

  useEffect(() => {
    const el = area.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.max(64, el.scrollHeight)}px`;
    }
  }, [texto]);

  // Salva o que estiver pendente se o cartão sair da tela (ex.: mudou de aba).
  const pendente = useRef(texto);
  pendente.current = texto;
  useEffect(
    () => () => {
      if (pendente.current !== salvo.current) void mutar("PATCH", `/notas/${nota.id}`, { supervisaoTexto: pendente.current }).catch(() => {});
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Manda o texto junto: o salvamento automático pode não ter rodado ainda.
  const marcar = (em: string | null) =>
    mutar("PATCH", `/notas/${nota.id}`, { supervisaoEm: em, supervisaoTexto: texto })
      .then((r) => {
        salvo.current = texto;
        return r;
      })
      .then(() => avisar(em ? "Marcada como discutida." : "Voltou para “a levar”."))
      .catch(avisarErro);

  const id = `discussao-${nota.id}`;
  return (
    <div className={cn("flex flex-col gap-1.5 rounded-lg border border-dashed bg-muted/30 px-3 py-2.5", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={id} className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <MessagesSquare className="size-3.5" aria-hidden /> Discutido em supervisão
        </label>
        <span className={cn("text-xs text-muted-foreground", situacao === "erro" && "text-destructive")} role="status">
          {situacao === "salvando" ? "Salvando…" : situacao === "salvo" ? "Salvo" : situacao === "erro" ? "Não salvou" : ""}
        </span>
        <span className="ml-auto flex items-center gap-1">
          {nota.supervisaoEm ? (
            <>
              <span className="text-xs text-muted-foreground">Discutida em {fmt(new Date(`${nota.supervisaoEm}T12:00:00`), "dd/MM/yyyy")}</span>
              <Button variant="ghost" size="icon-xs" aria-label="Desfazer: ainda a levar" title="Desfazer" onClick={() => void marcar(null)}>
                <Undo2 aria-hidden />
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" className="h-7" onClick={() => void marcar(chaveDia(new Date(), fusoPrincipal))}>
              <BookmarkCheck aria-hidden /> Discutida
            </Button>
          )}
        </span>
      </div>
      <textarea
        id={id}
        ref={area}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="O que a supervisão apontou, hipóteses, próximos passos…"
        className="w-full resize-none rounded-md border bg-card px-3 py-2 text-sm leading-relaxed outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
      />
    </div>
  );
}
