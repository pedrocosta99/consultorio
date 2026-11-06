import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { Archive, ArchiveRestore, CalendarClock, CalendarOff, FileDown, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { FUSO_CONSULTORIO, type Contrato, type Paciente } from "@consultorio/shared";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useAvisos } from "@/app/avisos";
import { useDados } from "@/app/dados";
import { baixar } from "@/lib/api";
import { chaveDia, fmt } from "@/lib/datas";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Campo, DialogoConfirmacao, textoDeDinheiro } from "./campos";
import { CamposGrade, DialogoPaciente, GRADE_PADRAO, validarGrade, type GradeForm } from "./DialogoPaciente";

function dataBonita(d: string) {
  return fmt(new Date(d + "T12:00:00"), "d 'de' MMM 'de' yyyy");
}

/** Novo contrato ou reajuste: o anterior termina na véspera da nova vigência. */
export function DialogoContrato({ aberto, aoFechar, paciente, atual }: { aberto: boolean; aoFechar: () => void; paciente: Paciente; atual?: Contrato }) {
  const { mutar } = useDados();
  const { avisar } = useAvisos();
  const hoje = chaveDia(new Date(), FUSO_CONSULTORIO);
  const [grade, setGrade] = useState<GradeForm>(GRADE_PADRAO);
  const [vigenteDe, setVigenteDe] = useState(hoje);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setGrade(
      atual
        ? { diasSemana: atual.diasSemana, horario: atual.horario, duracaoMin: String(atual.duracaoMin), valor: textoDeDinheiro(atual.valor), cobranca: atual.cobranca }
        : GRADE_PADRAO,
    );
    setVigenteDe(hoje);
    setErro(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    const g = validarGrade(grade, vigenteDe);
    if (!g.ok) return setErro(g.erro);
    setEnviando(true);
    try {
      await mutar("POST", `/pacientes/${paciente.id}/contratos`, g.dados);
      avisar(atual ? "Contrato atualizado. As sessões a partir da nova data já seguem a grade nova." : "Horário fixo criado e sessões geradas.");
      aoFechar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl font-medium">{atual ? "Alterar contrato" : "Horário fixo"}</DialogTitle>
          <DialogDescription>
            {atual
              ? "Reajuste de valor, troca de dia ou horário. O passado não muda: o contrato atual termina na véspera da nova vigência."
              : "A grade gera as sessões das próximas 8 semanas automaticamente."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={enviar} className="flex flex-col gap-5" noValidate>
          <CamposGrade grade={grade} aoMudar={setGrade} />
          <Campo rotulo="Vale a partir de" ajuda={atual ? `O contrato atual começou em ${dataBonita(atual.vigenteDe)}.` : undefined} className="sm:max-w-56">
            {(id, d) => <Input id={id} aria-describedby={d} type="date" value={vigenteDe} onChange={(e) => setVigenteDe(e.target.value)} />}
          </Campo>
          {erro && (
            <p className="text-sm text-destructive" role="alert">
              {erro}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={aoFechar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={enviando}>
              {enviando ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type Dialogo = null | "editar" | "contrato" | "encerrar" | "arquivar" | "excluir" | "pdf";

export function AcoesPaciente({ paciente: p, contrato }: { paciente: Paciente; contrato?: Contrato }) {
  const { mutar, nomeExibicao } = useDados();
  const { avisar } = useAvisos();
  const navegar = useNavigate();
  const [aberto, setAberto] = useState<Dialogo>(null);
  const [pessoais, setPessoais] = useState(false);
  const [fimContrato, setFimContrato] = useState(() => chaveDia(new Date(), FUSO_CONSULTORIO));
  const fechar = () => setAberto(null);
  const interrompido = p.status === "interrompido";

  return (
    <>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setAberto("editar")}>
          <Pencil aria-hidden /> Editar
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon-sm" aria-label="Mais ações">
              <MoreHorizontal aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuItem onSelect={() => setAberto("contrato")}>
              <CalendarClock aria-hidden /> {contrato ? "Alterar contrato / reajuste" : "Definir horário fixo"}
            </DropdownMenuItem>
            {contrato && (
              <DropdownMenuItem onSelect={() => setAberto("encerrar")}>
                <CalendarOff aria-hidden /> Encerrar horário fixo
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={() => setAberto("pdf")}>
              <FileDown aria-hidden /> Exportar prontuário (PDF)
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {p.arquivadoEm ? (
              <DropdownMenuItem
                onSelect={() =>
                  mutar("POST", `/pacientes/${p.id}/desarquivar`)
                    .then(() => avisar("Paciente voltou para as listas."))
                    .catch((e) => avisar(e.message, { tipo: "erro" }))
                }
              >
                <ArchiveRestore aria-hidden /> Desarquivar
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem disabled={!interrompido} onSelect={() => setAberto("arquivar")}>
                <Archive aria-hidden /> Arquivar
              </DropdownMenuItem>
            )}
            <DropdownMenuItem variant="destructive" disabled={!interrompido} onSelect={() => setAberto("excluir")}>
              <Trash2 aria-hidden /> Excluir definitivamente
            </DropdownMenuItem>
            {!interrompido && <p className="px-2 py-1.5 text-xs text-muted-foreground">Arquivar e excluir só ficam disponíveis com status “interrompido”.</p>}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <DialogoPaciente aberto={aberto === "editar"} aoFechar={fechar} paciente={p} />
      <DialogoContrato aberto={aberto === "contrato"} aoFechar={fechar} paciente={p} atual={contrato} />

      <DialogoConfirmacao
        aberto={aberto === "pdf"}
        aoFechar={fechar}
        titulo="Exportar prontuário"
        rotuloConfirmar="Baixar PDF"
        descricao={
          <div className="flex flex-col gap-3">
            <p>Identificação, contratos, pontos fixos, sessões e o registro documental. O arquivo sai sem cifra: guarde-o num lugar seguro.</p>
            <div className="flex items-center gap-2">
              <Switch id="pdf-pessoais" checked={pessoais} onCheckedChange={setPessoais} />
              <Label htmlFor="pdf-pessoais" className="text-sm text-foreground">
                Incluir anotações pessoais
              </Label>
            </div>
          </div>
        }
        aoConfirmar={async () => {
          await baixar(`/pacientes/${p.id}/prontuario.pdf${pessoais ? "?pessoais=1" : ""}`, `prontuario-${p.apelido.replace(/[^\w-]+/g, "")}.pdf`);
          avisar("PDF gerado.");
        }}
      />

      <DialogoConfirmacao
        aberto={aberto === "encerrar"}
        aoFechar={fechar}
        titulo="Encerrar horário fixo"
        rotuloConfirmar="Encerrar"
        descricao={
          <div className="flex flex-col gap-3">
            <p>As sessões agendadas depois desta data deixam de existir. As já realizadas ficam como estão.</p>
            <Campo rotulo="Último dia do contrato" className="max-w-56">
              {(id) => <Input id={id} type="date" value={fimContrato} onChange={(e) => setFimContrato(e.target.value)} />}
            </Campo>
          </div>
        }
        aoConfirmar={async () => {
          await mutar("POST", `/contratos/${contrato!.id}/encerrar`, { ate: fimContrato });
          avisar("Horário fixo encerrado.");
        }}
      />

      <DialogoConfirmacao
        aberto={aberto === "arquivar"}
        aoFechar={fechar}
        titulo="Arquivar paciente"
        rotuloConfirmar="Arquivar"
        descricao={
          <p>
            {nomeExibicao(p)} sai das listas e da agenda futura, mas o prontuário fica guardado (o CFP pede guarda mínima de 5 anos). Dá para desarquivar a
            qualquer momento em Pacientes › Arquivados.
          </p>
        }
        aoConfirmar={async () => {
          await mutar("POST", `/pacientes/${p.id}/arquivar`);
          avisar("Paciente arquivado.");
          navegar("/pacientes");
        }}
      />

      <DialogoConfirmacao
        aberto={aberto === "excluir"}
        aoFechar={fechar}
        titulo="Excluir definitivamente"
        rotuloConfirmar="Excluir para sempre"
        destrutivo
        exigirTexto={p.apelido}
        descricao={
          <div className="flex flex-col gap-2">
            <p>
              Apaga cadastro, contratos, sessões, pagamentos e notas de <strong className="text-foreground">{nomeExibicao(p)}</strong>. <strong className="text-foreground">Não tem volta</strong> (só restaurando um backup).
            </p>
            <p>Se você atua como psicólogo(a) registrado(a) no CFP, a guarda mínima do prontuário é de 5 anos. Na dúvida, prefira arquivar.</p>
          </div>
        }
        aoConfirmar={async () => {
          await mutar("DELETE", `/pacientes/${p.id}`);
          avisar("Paciente excluído.");
          navegar("/pacientes");
        }}
      />
    </>
  );
}
