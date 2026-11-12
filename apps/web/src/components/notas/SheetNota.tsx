import { useEffect, useMemo, useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useDados } from "@/app/dados";
import { usePreferencias } from "@/app/preferencias";
import { PacienteAvatar } from "@/components/comuns";
import { SeletorSimples } from "@/components/formularios/campos";
import { capitalizar, fmt, hora, noFuso } from "@/lib/datas";
import { EditorNota } from "./Notas";
import { Relembrar } from "./Relembrar";

/**
 * Escrever a nota sem sair da tela atual (Painel, menu Novo). Se a sessão já tem
 * nota, abre essa nota para continuar.
 */
export function SheetNota({ aberto, aoFechar, pacienteId: fixo, sessaoId }: { aberto: boolean; aoFechar: () => void; pacienteId?: string; sessaoId?: string }) {
  const { pacientes, paciente, sessoes, notas, nomeExibicao } = useDados();
  const { fusoPrincipal } = usePreferencias();
  const [pacienteId, setPacienteId] = useState(fixo ?? "");

  useEffect(() => {
    if (aberto) setPacienteId(fixo ?? "");
  }, [aberto, fixo]);

  const p = pacienteId ? paciente(pacienteId) : undefined;
  const sessao = sessaoId ? sessoes.find((s) => s.id === sessaoId) : undefined;
  // Congelada ao abrir: a nota criada pelo salvamento automático não pode remontar o editor.
  const existente = useMemo(
    () => (sessaoId ? notas.find((n) => n.sessaoId === sessaoId) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [aberto, sessaoId],
  );

  return (
    <Sheet open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-xl">
        <SheetHeader className="border-b pb-4">
          <div className="flex items-center gap-3">
            {p && <PacienteAvatar paciente={p} className="size-10 text-sm" />}
            <div className="min-w-0">
              <SheetTitle className="truncate font-serif text-xl font-medium">{p ? nomeExibicao(p) : "Nova nota"}</SheetTitle>
              <SheetDescription>
                {sessao
                  ? `Sessão de ${capitalizar(fmt(noFuso(sessao.inicio, fusoPrincipal), "EEEE, d 'de' MMMM"))}, ${hora(sessao.inicio, fusoPrincipal)}`
                  : "Salva sozinha enquanto você escreve."}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>
        <div className="flex flex-col gap-4 p-4">
          {!fixo && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="nota-paciente" className="text-sm font-medium">
                Paciente
              </label>
              <SeletorSimples
                id="nota-paciente"
                valor={pacienteId}
                aoMudar={setPacienteId}
                opcoes={pacientes.filter((x) => x.status !== "interrompido").map((x) => [x.id, nomeExibicao(x)] as const)}
              />
            </div>
          )}
          {p && (
            <>
              <EditorNota key={`${p.id}-${existente?.id ?? sessaoId ?? "nova"}`} paciente={p} nota={existente} sessaoInicial={sessaoId ?? null} aoTerminar={aoFechar} />
              <Relembrar paciente={p} antesDe={sessao?.inicio} sessaoId={sessaoId} />
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
