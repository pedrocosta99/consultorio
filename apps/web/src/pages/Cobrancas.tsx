/**
 * Cobranças: fechamento do mês por paciente (com mensagem pronta para enviar) e
 * controle dos recibos emitidos no Receita Saúde.
 */
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { CheckCheck, ChevronLeft, ChevronRight, CircleDollarSign, FileCheck2, ReceiptText, Undo2 } from "lucide-react";
import { fechamentoDoMes, ROTULO_MEIO, type Pagamento } from "@consultorio/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useAvisos } from "@/app/avisos";
import { somarPorMoeda, useDados } from "@/app/dados";
import { usePreferencias } from "@/app/preferencias";
import { BotaoMensagem } from "@/components/BotaoMensagem";
import { CabecalhoPagina, EstadoVazio, PacienteAvatar, Valor, Valores } from "@/components/comuns";
import { Campo, DialogoConfirmacao } from "@/components/formularios/campos";
import { api } from "@/lib/api";
import { DialogoPagamento } from "@/components/formularios/DialogoPagamento";
import { capitalizar, chaveDia, fmt } from "@/lib/datas";
import { mensagemCobranca } from "@/lib/mensagens";

function somarMes(mes: string, delta: number): string {
  const [a, m] = mes.split("-").map(Number) as [number, number];
  const d = new Date(a, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const nomeMes = (mes: string) => capitalizar(fmt(new Date(`${mes}-15T12:00:00`), "MMMM 'de' yyyy"));

export function PaginaCobrancas() {
  const { sessoes, pagamentos, carregando, paciente, nomeExibicao, mensagens } = useDados();
  const { fusoPrincipal } = usePreferencias();
  const hoje = chaveDia(new Date(), fusoPrincipal);
  // Começo de mês (até o dia 10) é quando se cobra o mês anterior.
  const [mes, setMes] = useState(() => (Number(hoje.slice(8)) <= 10 ? somarMes(hoje.slice(0, 7), -1) : hoje.slice(0, 7)));
  const [pagarDe, setPagarDe] = useState<string | null>(null);

  const fechamentos = useMemo(
    () =>
      fechamentoDoMes(sessoes, mes, fusoPrincipal).sort(
        (a, b) => Number(b.aberto.length > 0) - Number(a.aberto.length > 0) || nomeExibicao(paciente(a.pacienteId)).localeCompare(nomeExibicao(paciente(b.pacienteId)), "pt-BR"),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessoes, mes, fusoPrincipal],
  );
  const total = somarPorMoeda(fechamentos.flatMap((f) => f.total));
  const aberto = somarPorMoeda(fechamentos.flatMap((f) => f.aberto));
  const recebidoNoMes = somarPorMoeda(pagamentos.filter((p) => p.data.startsWith(mes)).map((p) => p.valor));

  return (
    <>
      <CabecalhoPagina
        titulo="Cobranças"
        descricao="Fechamento do mês por paciente e recibos do Receita Saúde."
        acoes={
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" aria-label="Mês anterior" onClick={() => setMes((m) => somarMes(m, -1))}>
              <ChevronLeft aria-hidden />
            </Button>
            <span className="min-w-40 text-center font-serif text-lg" aria-live="polite">
              {nomeMes(mes)}
            </span>
            <Button variant="ghost" size="icon" aria-label="Próximo mês" onClick={() => setMes((m) => somarMes(m, 1))}>
              <ChevronRight aria-hidden />
            </Button>
          </div>
        }
      />

      {carregando ? (
        <div aria-busy="true" aria-label="Carregando cobranças" className="flex flex-col gap-4">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Resumo titulo="Sessões cobráveis" valores={total} />
            <Resumo titulo="Em aberto" valores={aberto} destaque={aberto.length > 0} />
            <Resumo titulo="Recebido no mês" valores={recebidoNoMes} ajuda="Pagamentos com data neste mês" />
          </div>

          <Card className="gap-0 py-0">
            <CardHeader className="border-b px-5 py-4">
              <CardTitle className="font-serif text-lg font-medium">Fechamento de {nomeMes(mes).toLowerCase()}</CardTitle>
              <CardDescription>Sessões realizadas e faltas cobradas. A mensagem lista as sessões e cobra o que está em aberto.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {fechamentos.length === 0 ? (
                <EstadoVazio icone={CircleDollarSign} titulo="Nada para cobrar" descricao="Nenhuma sessão realizada ou falta cobrada neste mês." />
              ) : (
                <ul className="divide-y">
                  {fechamentos.map((f) => {
                    const p = paciente(f.pacienteId);
                    const faltas = f.sessoes.filter((s) => s.estado === "falta_cobrada").length;
                    return (
                      <li key={f.pacienteId} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
                        <Link to={`/pacientes/${f.pacienteId}`} className="flex min-w-0 flex-1 basis-56 items-center gap-3 hover:underline">
                          <PacienteAvatar paciente={p} />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">{nomeExibicao(p)}</span>
                            <span className="block text-xs text-muted-foreground">
                              {f.sessoes.length} {f.sessoes.length === 1 ? "sessão" : "sessões"}
                              {faltas > 0 && ` · ${faltas} ${faltas === 1 ? "falta cobrada" : "faltas cobradas"}`}
                            </span>
                          </span>
                        </Link>
                        <span className="w-32 text-right text-sm">
                          <Valores valores={f.total} className="justify-end text-muted-foreground" />
                        </span>
                        <span className="w-32 text-right text-sm font-medium">
                          {f.aberto.length ? (
                            <Valores valores={f.aberto} className="justify-end" />
                          ) : (
                            <span className="text-positivo">Pago</span>
                          )}
                        </span>
                        <span className="flex w-full justify-end gap-1.5 sm:w-48">
                          {p && f.aberto.length > 0 && (
                            <>
                              <BotaoMensagem paciente={p} titulo={`Cobrança de ${nomeMes(mes).toLowerCase()}`} rotulo="Cobrar" gerar={() => mensagemCobranca(f, p, mensagens, mes, fusoPrincipal)} />
                              <Button size="sm" variant="outline" onClick={() => setPagarDe(f.pacienteId)}>
                                <CircleDollarSign aria-hidden /> Recebi
                              </Button>
                            </>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <Recibos mes={mes} />
        </div>
      )}

      <DialogoPagamento aberto={pagarDe !== null} aoFechar={() => setPagarDe(null)} pacienteId={pagarDe ?? undefined} />
    </>
  );
}

function Resumo({ titulo, valores, destaque, ajuda }: { titulo: string; valores: ReturnType<typeof somarPorMoeda>; destaque?: boolean; ajuda?: string }) {
  return (
    <Card className="gap-1 px-4 py-3.5">
      <p className="text-sm text-muted-foreground">{titulo}</p>
      <Valores valores={valores} className={destaque ? "font-serif text-xl text-negativo" : "font-serif text-xl"} />
      {ajuda && <p className="text-xs text-muted-foreground">{ajuda}</p>}
    </Card>
  );
}

// ── Recibos (Receita Saúde) ──────────────────────────────────

function Recibos({ mes }: { mes: string }) {
  const { pagamentos, paciente, nomeExibicao, mutar, recarregar } = useDados();
  const { fusoPrincipal } = usePreferencias();
  const { avisar, avisarErro } = useAvisos();
  const [aba, setAba] = useState<"pendentes" | "emitidos">("pendentes");
  const [emitindo, setEmitindo] = useState<Pagamento | null>(null);
  const [todos, setTodos] = useState(false);

  // O Receita Saúde vale para pagamentos em real.
  const emReal = pagamentos.filter((p) => p.valor.moeda === "BRL");
  const pendentes = emReal.filter((p) => !p.reciboEm).sort((a, b) => a.data.localeCompare(b.data));
  const emitidos = emReal.filter((p) => p.reciboEm && p.data.startsWith(mes)).sort((a, b) => b.data.localeCompare(a.data));
  const lista = aba === "pendentes" ? pendentes : emitidos;

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 border-b px-5 py-4">
        <div>
          <CardTitle className="flex items-center gap-2 font-serif text-lg font-medium">
            <ReceiptText className="size-4 text-muted-foreground" aria-hidden /> Recibos
          </CardTitle>
          <CardDescription className="mt-1">O recibo sai no app Receita Saúde; aqui você marca o que já emitiu. Só pagamentos em real.</CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
        {aba === "pendentes" && pendentes.length > 1 && (
          <Button size="sm" variant="ghost" onClick={() => setTodos(true)}>
            <CheckCheck aria-hidden /> Marcar todos
          </Button>
        )}
        <ToggleGroup type="single" size="sm" variant="outline" value={aba} onValueChange={(v) => v && setAba(v as typeof aba)} aria-label="Recibos">
          <ToggleGroupItem value="pendentes" className="px-3">
            A emitir {pendentes.length > 0 && <span className="ml-1 tabular text-muted-foreground">{pendentes.length}</span>}
          </ToggleGroupItem>
          <ToggleGroupItem value="emitidos" className="px-3">
            Emitidos em {fmt(new Date(`${mes}-15T12:00:00`), "MMM")}
          </ToggleGroupItem>
        </ToggleGroup>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {lista.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">{aba === "pendentes" ? "Nenhum recibo pendente." : "Nenhum recibo marcado como emitido para pagamentos deste mês."}</p>
        ) : (
          <ul className="max-h-[28rem] divide-y overflow-y-auto">
            {lista.map((pg) => {
              const p = paciente(pg.pacienteId);
              return (
                <li key={pg.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-2.5 text-sm">
                  <span className="w-20 tabular text-muted-foreground">{fmt(new Date(`${pg.data}T12:00:00`), "dd/MM/yy")}</span>
                  <span className="min-w-0 flex-1 truncate">{nomeExibicao(p)}</span>
                  <span className="text-xs text-muted-foreground">{ROTULO_MEIO[pg.meio]}</span>
                  <Valor valor={pg.valor} className="w-28 text-right font-medium" />
                  {aba === "pendentes" ? (
                    <Button size="sm" variant="outline" onClick={() => setEmitindo(pg)}>
                      <FileCheck2 aria-hidden /> Emitido
                    </Button>
                  ) : (
                    <span className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {fmt(new Date(`${pg.reciboEm}T12:00:00`), "dd/MM")}
                        {pg.reciboNumero && ` · nº ${pg.reciboNumero}`}
                      </span>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label="Desfazer: recibo não emitido"
                        title="Desfazer"
                        onClick={() =>
                          mutar("PUT", `/pagamentos/${pg.id}/recibo`, { em: null })
                            .then(() => avisar("Recibo voltou para “a emitir”."))
                            .catch(avisarErro)
                        }
                      >
                        <Undo2 aria-hidden />
                      </Button>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
      <DialogoRecibo pagamento={emitindo} aoFechar={() => setEmitindo(null)} />
      <DialogoConfirmacao
        aberto={todos}
        aoFechar={() => setTodos(false)}
        titulo="Marcar todos como emitidos"
        rotuloConfirmar={`Marcar ${pendentes.length}`}
        descricao="Útil ao começar a usar o app, quando os recibos antigos já foram emitidos. Cada um pode ser desfeito depois na aba “Emitidos”."
        aoConfirmar={async () => {
          const hoje = chaveDia(new Date(), fusoPrincipal);
          try {
            for (const pg of pendentes) await api("PUT", `/pagamentos/${pg.id}/recibo`, { em: hoje });
            avisar(`${pendentes.length} recibos marcados como emitidos.`);
          } finally {
            await recarregar();
          }
        }}
      />
    </Card>
  );
}

function DialogoRecibo({ pagamento, aoFechar }: { pagamento: Pagamento | null; aoFechar: () => void }) {
  const { mutar, paciente, nomeExibicao } = useDados();
  const { fusoPrincipal } = usePreferencias();
  const { avisar } = useAvisos();
  const [em, setEm] = useState("");
  const [numero, setNumero] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);

  // Reinicia o formulário a cada pagamento aberto.
  if (pagamento && aberto !== pagamento.id) {
    setAberto(pagamento.id);
    setEm(chaveDia(new Date(), fusoPrincipal));
    setNumero("");
    setErro(null);
  } else if (!pagamento && aberto !== null) setAberto(null);

  const salvar = async () => {
    if (!pagamento) return;
    try {
      await mutar("PUT", `/pagamentos/${pagamento.id}/recibo`, { em, numero: numero.trim() || undefined });
      avisar("Recibo marcado como emitido.");
      setAberto(null);
      aoFechar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não salvou.");
    }
  };

  return (
    <Dialog
      open={!!pagamento}
      onOpenChange={(v) => {
        if (!v) {
          setAberto(null);
          aoFechar();
        }
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl font-medium">Recibo emitido</DialogTitle>
          <DialogDescription>
            {pagamento && (
              <>
                {nomeExibicao(paciente(pagamento.pacienteId))} · <Valor valor={pagamento.valor} /> em {fmt(new Date(`${pagamento.data}T12:00:00`), "dd/MM/yyyy")}
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Campo rotulo="Emitido em">{(id) => <Input id={id} type="date" value={em} onChange={(e) => setEm(e.target.value)} />}</Campo>
          <Campo rotulo="Número do recibo" ajuda="Opcional.">
            {(id, d) => <Input id={id} aria-describedby={d} value={numero} onChange={(e) => setNumero(e.target.value)} autoComplete="off" />}
          </Campo>
          {erro && (
            <p className="text-sm text-destructive" role="alert">
              {erro}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={aoFechar}>
            Cancelar
          </Button>
          <Button onClick={() => void salvar()} disabled={!em}>
            Marcar emitido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
