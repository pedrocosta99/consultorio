import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { CalendarClock, Globe2, NotebookPen, UserRound } from "lucide-react";
import { ROTULO_MODALIDADE, sessaoCobravel, type Sessao } from "@consultorio/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useDados } from "@/app/dados";
import { AcoesSessao } from "@/components/AcoesSessao";
import { BotaoMensagem } from "@/components/BotaoMensagem";
import { EditorNota } from "@/components/notas/Notas";
import { Relembrar } from "@/components/notas/Relembrar";
import { mensagemLembrete } from "@/lib/mensagens";
import { EstadoBadge, PacienteAvatar, Valor } from "@/components/comuns";
import { capitalizar, chaveDia, fmt, hora, nomeFuso, noFuso, offsetFuso } from "@/lib/datas";

function LinhaFuso({ rotulo, inicio, fuso, duracao }: { rotulo: string; inicio: string; fuso: string; duracao: number }) {
  const fim = new Date(Date.parse(inicio) + duracao * 60_000);
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-muted-foreground">
        {rotulo} <span className="text-xs">({nomeFuso(fuso)}, {offsetFuso(fuso, new Date(inicio))})</span>
      </span>
      <span className="font-medium tabular">
        {hora(inicio, fuso)}–{hora(fim, fuso)}
      </span>
    </div>
  );
}

export function PainelSessao({
  sessaoId,
  fusoPrincipal,
  fusoSecundario,
  aoFechar,
  aoRemarcar,
}: {
  sessaoId: string | null;
  fusoPrincipal: string;
  fusoSecundario: string | null;
  aoFechar: () => void;
  aoRemarcar: (id: string, diaChave: string, minutos: number) => void;
}) {
  const { sessoes, notas, paciente, nomeExibicao, mensagens } = useDados();
  const s: Sessao | undefined = sessoes.find((x) => x.id === sessaoId);
  const p = s ? paciente(s.pacienteId) : undefined;
  const [data, setData] = useState("");
  const [horario, setHorario] = useState("");
  const [escrevendo, setEscrevendo] = useState(false);
  // Congelada ao abrir a sessão (o salvamento automático não remonta o editor).
  const notaDaSessao = useMemo(
    () => (sessaoId ? notas.find((n) => n.sessaoId === sessaoId) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessaoId, escrevendo],
  );
  const futura = s ? Date.parse(s.inicio) > Date.now() : false;

  useEffect(() => setEscrevendo(false), [sessaoId]);

  useEffect(() => {
    if (s) {
      setData(chaveDia(s.inicio, fusoPrincipal));
      setHorario(hora(s.inicio, fusoPrincipal));
    }
  }, [s, fusoPrincipal]);

  const mudou = s && (data !== chaveDia(s.inicio, fusoPrincipal) || horario !== hora(s.inicio, fusoPrincipal));

  return (
    <Sheet open={!!s} onOpenChange={(v) => !v && aoFechar()}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
        {s && p && (
          <>
            <SheetHeader className="border-b pb-4">
              <div className="flex items-center gap-3">
                <PacienteAvatar paciente={p} className="size-11 text-sm" />
                <div className="min-w-0">
                  <SheetTitle className="truncate font-serif text-xl font-medium">{nomeExibicao(p)}</SheetTitle>
                  <SheetDescription>
                    {capitalizar(fmt(noFuso(s.inicio, fusoPrincipal), "EEEE, d 'de' MMMM"))} · {ROTULO_MODALIDADE[p.modalidade]}
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>

            <div className="flex flex-col gap-5 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <EstadoBadge estado={s.estado} />
                <span className="text-sm text-muted-foreground">
                  <Valor valor={s.valor} />
                  {sessaoCobravel(s.estado) && (s.pago ? " · pago" : " · em aberto")}
                </span>
              </div>

              <section aria-label="Ações rápidas">
                <AcoesSessao sessao={s} />
              </section>

              {escrevendo ? (
                <EditorNota key={s.id} paciente={p} nota={notaDaSessao} sessaoInicial={s.id} aoTerminar={() => setEscrevendo(false)} />
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setEscrevendo(true)}>
                    <NotebookPen aria-hidden /> {notaDaSessao ? "Continuar a nota" : "Escrever nota"}
                  </Button>
                  {futura && s.estado === "agendada" && (
                    <BotaoMensagem
                      paciente={p}
                      titulo="Lembrete da sessão"
                      rotulo="Lembrete"
                      variant="secondary"
                      gerar={() => mensagemLembrete(s, p, mensagens, fusoPrincipal)}
                    />
                  )}
                </div>
              )}

              <Relembrar paciente={p} antesDe={s.inicio} sessaoId={s.id} />

              <Separator />

              <section className="flex flex-col gap-2" aria-label="Horários">
                <h3 className="flex items-center gap-2 font-sans text-sm font-medium tracking-normal">
                  <Globe2 className="size-4 text-muted-foreground" aria-hidden /> Horário
                </h3>
                <LinhaFuso rotulo="Agenda" inicio={s.inicio} fuso={fusoPrincipal} duracao={s.duracaoMin} />
                {fusoSecundario && fusoSecundario !== fusoPrincipal && (
                  <LinhaFuso rotulo="Seu outro fuso" inicio={s.inicio} fuso={fusoSecundario} duracao={s.duracaoMin} />
                )}
                {p.fuso !== fusoPrincipal && p.fuso !== fusoSecundario && (
                  <LinhaFuso rotulo="Para o paciente" inicio={s.inicio} fuso={p.fuso} duracao={s.duracaoMin} />
                )}
              </section>

              <Separator />

              <section className="flex flex-col gap-3" aria-label="Remarcar">
                <h3 className="flex items-center gap-2 font-sans text-sm font-medium tracking-normal">
                  <CalendarClock className="size-4 text-muted-foreground" aria-hidden /> Remarcar
                </h3>
                <p className="-mt-1 text-xs text-muted-foreground">Ou arraste a sessão na agenda.</p>
                <div className="grid grid-cols-[1fr_7rem] gap-2">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="remarcar-data" className="text-xs">Data</Label>
                    <Input id="remarcar-data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="remarcar-hora" className="text-xs">Hora ({nomeFuso(fusoPrincipal)})</Label>
                    <Input id="remarcar-hora" type="time" step={900} value={horario} onChange={(e) => setHorario(e.target.value)} />
                  </div>
                </div>
                <Button
                  variant="outline"
                  disabled={!mudou || !data || !horario}
                  onClick={() => {
                    const [h, m] = horario.split(":").map(Number) as [number, number];
                    aoRemarcar(s.id, data, h * 60 + m);
                  }}
                >
                  Salvar novo horário
                </Button>
              </section>

              <Separator />

              <div className="flex flex-wrap gap-2">
                <Button asChild variant="secondary" size="sm">
                  <Link to={`/pacientes/${p.id}`}>
                    <UserRound aria-hidden /> Abrir ficha
                  </Link>
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
