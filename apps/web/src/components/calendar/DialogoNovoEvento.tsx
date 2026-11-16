import { useEffect, useState } from "react";
import { Ban, CalendarClock, UserRound } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useAvisos } from "@/app/avisos";
import { useDados } from "@/app/dados";
import { FormCompromisso } from "@/components/formularios/FormCompromisso";
import { FormSessao, type SessaoInicial } from "@/components/formularios/DialogoSessao";

type Tipo = "sessao" | "compromisso" | "bloqueio";

const DESCRICAO: Record<Tipo, string> = {
  sessao: "Sessão fora do horário fixo: primeira entrevista, sessão extra, reposição.",
  compromisso: "Supervisão, análise pessoal, grupo de estudo, reunião.",
  bloqueio: "Folga, férias ou horário pessoal: aparece só como ocupado.",
};

/**
 * Criar evento a partir da agenda (clique num horário vazio, arrastar ou atalho C),
 * como o cartão do Google Agenda: sessão, compromisso ou bloqueio.
 */
export function DialogoNovoEvento({ inicial, aoFechar }: { inicial: SessaoInicial | null; aoFechar: () => void }) {
  const { mutar } = useDados();
  const { avisar } = useAvisos();
  const [tipo, setTipo] = useState<Tipo>("sessao");

  useEffect(() => {
    if (inicial) setTipo("sessao");
  }, [inicial]);

  return (
    <Dialog open={inicial !== null} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl font-medium">Novo evento</DialogTitle>
          <DialogDescription>{DESCRICAO[tipo]}</DialogDescription>
        </DialogHeader>
        <ToggleGroup
          type="single"
          variant="outline"
          value={tipo}
          onValueChange={(v) => v && setTipo(v as Tipo)}
          aria-label="Tipo de evento"
          className="w-full"
        >
          <ToggleGroupItem value="sessao" className="flex-1 gap-1.5">
            <UserRound aria-hidden /> Sessão
          </ToggleGroupItem>
          <ToggleGroupItem value="compromisso" className="flex-1 gap-1.5">
            <CalendarClock aria-hidden /> Compromisso
          </ToggleGroupItem>
          <ToggleGroupItem value="bloqueio" className="flex-1 gap-1.5">
            <Ban aria-hidden /> Bloqueio
          </ToggleGroupItem>
        </ToggleGroup>
        {inicial &&
          (tipo === "sessao" ? (
            <FormSessao inicial={inicial} aoConcluir={aoFechar} aoCancelar={aoFechar} />
          ) : (
            <FormCompromisso
              key={tipo}
              inicial={{ tipo, data: inicial.data, horario: inicial.horario, duracaoMin: inicial.duracaoMin ?? (tipo === "bloqueio" ? 60 : 50) }}
              rotuloEnviar={tipo === "bloqueio" ? "Bloquear horário" : "Criar compromisso"}
              aoEnviar={async (v) => {
                await mutar("POST", "/compromissos", v);
                avisar(tipo === "bloqueio" ? "Horário bloqueado." : "Compromisso criado.");
                aoFechar();
              }}
              aoCancelar={aoFechar}
            />
          ))}
      </DialogContent>
    </Dialog>
  );
}
