import { useMemo, useState } from "react";
import { Link } from "react-router";
import { AlarmClock, CalendarCheck2, CalendarDays, CircleDollarSign, Coffee, NotebookPen, Sunrise, TrendingUp, UserX } from "lucide-react";
import { endOfWeek, format, startOfWeek } from "date-fns";
import { sessoesSemRegistro, type Dinheiro, type Sessao } from "@consultorio/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { somarPorMoeda, useDados } from "@/app/dados";
import { usePreferencias } from "@/app/preferencias";
import { AcoesSessao } from "@/components/AcoesSessao";
import { BotaoMensagem } from "@/components/BotaoMensagem";
import { SheetNota } from "@/components/notas/SheetNota";
import { mensagemLembrete } from "@/lib/mensagens";
import { CabecalhoPagina, EstadoBadge, EstadoVazio, PacienteAvatar, Valor, Valores } from "@/components/comuns";
import { capitalizar, chaveDia, fmt, hora, noFuso, SEMANA } from "@/lib/datas";

function saudacao(h: number): string {
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function Indicador({
  titulo,
  icone: Icone,
  children,
  rodape,
}: {
  titulo: string;
  icone: typeof CalendarDays;
  children: React.ReactNode;
  rodape?: React.ReactNode;
}) {
  return (
    <Card className="gap-2 py-4">
      <CardHeader className="px-4">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Icone className="size-4" aria-hidden />
          {titulo}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4">
        <div className="font-serif text-2xl leading-tight font-medium">{children}</div>
        {rodape && <p className="mt-1 text-xs text-muted-foreground">{rodape}</p>}
      </CardContent>
    </Card>
  );
}

export function PaginaPainel() {
  const { sessoes, pagamentos, notas, carregando, paciente, nomeExibicao, saldoPaciente, pacientes, mensagens } = useDados();
  const [notaDe, setNotaDe] = useState<Sessao | null>(null);
  const comNota = useMemo(() => new Set(notas.map((n) => n.sessaoId).filter(Boolean)), [notas]);
  const { fusoPrincipal } = usePreferencias();
  const agora = new Date();
  const hojeLocal = noFuso(agora, fusoPrincipal);
  const hoje = format(hojeLocal, "yyyy-MM-dd");
  const mes = hoje.slice(0, 7);

  const dados = useMemo(() => {
    const deHoje = sessoes.filter((s) => chaveDia(s.inicio, fusoPrincipal) === hoje);
    const inicioSemana = format(startOfWeek(hojeLocal, SEMANA), "yyyy-MM-dd");
    const fimSemana = format(endOfWeek(hojeLocal, SEMANA), "yyyy-MM-dd");
    const daSemana = sessoes.filter((s) => {
      const d = chaveDia(s.inicio, fusoPrincipal);
      return d >= inicioSemana && d <= fimSemana && s.estado !== "cancelada";
    });
    const doMes = sessoes.filter((s) => chaveDia(s.inicio, fusoPrincipal).startsWith(mes));
    const passadasMes = doMes.filter((s) => s.estado !== "agendada");
    const faltasMes = doMes.filter((s) => s.estado === "falta_cobrada" || s.estado === "falta_nao_cobrada");
    const receitaMes = somarPorMoeda(pagamentos.filter((p) => p.data.startsWith(mes)).map((p) => p.valor));

    const porPaciente = new Map<string, Dinheiro[]>();
    for (const p of pagamentos.filter((x) => x.data.startsWith(mes))) {
      porPaciente.set(p.pacienteId, [...(porPaciente.get(p.pacienteId) ?? []), p.valor]);
    }
    const receitaPorPaciente = [...porPaciente.entries()]
      .map(([id, v]) => ({ id, valores: somarPorMoeda(v) }))
      .sort((a, b) => (b.valores[0]?.centavos ?? 0) - (a.valores[0]?.centavos ?? 0));

    const devedores = pacientes
      .map((p) => ({ p, saldo: saldoPaciente(p.id).filter((v) => v.centavos > 0) }))
      .filter((x) => x.saldo.length > 0)
      .sort((a, b) => (b.saldo[0]?.centavos ?? 0) - (a.saldo[0]?.centavos ?? 0));

    const semRegistro = sessoesSemRegistro(sessoes, agora).filter((s) => chaveDia(s.inicio, fusoPrincipal) !== hoje);
    const amanhaChave = format(new Date(hojeLocal.getFullYear(), hojeLocal.getMonth(), hojeLocal.getDate() + 1), "yyyy-MM-dd");
    const deAmanha = sessoes.filter((s) => chaveDia(s.inicio, fusoPrincipal) === amanhaChave && s.estado === "agendada");

    return {
      semRegistro,
      deAmanha,
      deHoje,
      proxima: deHoje.find((s) => new Date(s.inicio) > agora && s.estado === "agendada"),
      realizadasHoje: deHoje.filter((s) => s.estado === "realizada").length,
      semana: daSemana.length,
      ativos: pacientes.filter((p) => p.status === "ativo").length,
      aReceber: somarPorMoeda(devedores.flatMap((d) => d.saldo)),
      qtdDevedores: devedores.length,
      receitaMes,
      faltasMes: faltasMes.length,
      taxaFaltas: passadasMes.length ? Math.round((faltasMes.length / passadasMes.length) * 100) : 0,
      receitaPorPaciente,
      devedores,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessoes, pagamentos, pacientes, fusoPrincipal, hoje, mes]);

  const maxReceita = Math.max(1, ...dados.receitaPorPaciente.filter((r) => r.valores[0]?.moeda === "BRL").map((r) => r.valores[0]!.centavos));

  return (
    <>
      <CabecalhoPagina
        titulo={saudacao(hojeLocal.getHours())}
        descricao={capitalizar(fmt(hojeLocal, "EEEE, d 'de' MMMM 'de' yyyy"))}
        acoes={
          <Button asChild variant="outline" size="sm">
            <Link to="/agenda">
              <CalendarDays aria-hidden /> Abrir agenda
            </Link>
          </Button>
        }
      />

      {carregando ? (
        <CarregandoPainel />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Indicador
              titulo="Sessões hoje"
              icone={CalendarCheck2}
              rodape={
                dados.proxima
                  ? `Próxima às ${hora(dados.proxima.inicio, fusoPrincipal)} · ${nomeExibicao(paciente(dados.proxima.pacienteId), "curto")}`
                  : dados.deHoje.length
                    ? `${dados.realizadasHoje} realizadas`
                    : "Dia livre"
              }
            >
              {dados.deHoje.length}
              <span className="ml-2 font-sans text-xs font-normal text-muted-foreground">
                {dados.semana} na semana · {dados.ativos} ativos
              </span>
            </Indicador>
            <Indicador
              titulo="A receber"
              icone={CircleDollarSign}
              rodape={dados.qtdDevedores ? `${dados.qtdDevedores} pacientes com saldo em aberto` : "Tudo em dia"}
            >
              <ValorMultimoeda valores={dados.aReceber} />
            </Indicador>
            <Indicador titulo="Receita do mês" icone={TrendingUp} rodape={capitalizar(fmt(hojeLocal, "MMMM"))}>
              <ValorMultimoeda valores={dados.receitaMes} />
            </Indicador>
            <Indicador titulo="Faltas no mês" icone={UserX} rodape={`${dados.taxaFaltas}% das sessões do mês`}>
              {dados.faltasMes}
            </Indicador>
          </div>

          <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="flex min-w-0 flex-col gap-6">
            {dados.semRegistro.length > 0 && (
              <Card className="gap-0 border-[var(--st-falta-bd)]/60 py-0">
                <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 border-b px-5 py-4">
                  <CardTitle className="flex items-center gap-2 font-serif text-lg font-medium">
                    <AlarmClock className="size-4 text-[var(--st-falta-fg)]" aria-hidden /> Sem registro
                  </CardTitle>
                  <span className="text-xs text-muted-foreground">
                    {dados.semRegistro.length === 1 ? "1 sessão passada continua" : `${dados.semRegistro.length} sessões passadas continuam`} “agendada”
                  </span>
                </CardHeader>
                <CardContent className="p-0">
                  <ul className="max-h-96 divide-y overflow-y-auto">
                    {dados.semRegistro.map((s) => {
                      const p = paciente(s.pacienteId);
                      return (
                        <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
                          <span className="w-24 text-sm tabular">
                            <span className="block font-medium">{capitalizar(fmt(noFuso(s.inicio, fusoPrincipal), "EEE, d/MM"))}</span>
                            <span className="text-xs text-muted-foreground">{hora(s.inicio, fusoPrincipal)}</span>
                          </span>
                          <span className="flex min-w-0 flex-1 items-center gap-3">
                            <PacienteAvatar paciente={p} className="size-7 text-[10px]" />
                            <span className="truncate text-sm">{nomeExibicao(p)}</span>
                          </span>
                          <div className="flex w-full flex-wrap items-center gap-1.5 sm:w-auto">
                            <AcoesSessao sessao={s} compacto />
                            <BotaoNota sessao={s} temNota={comNota.has(s.id)} aoAbrir={setNotaDe} />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </CardContent>
              </Card>
            )}
            <Card className="gap-0 py-0">
              <CardHeader className="flex flex-row items-center justify-between border-b px-5 py-4">
                <CardTitle className="font-serif text-lg font-medium">Hoje</CardTitle>
                <span className="text-xs text-muted-foreground">Marque tudo ao fim do dia</span>
              </CardHeader>
              <CardContent className="p-0">
                {dados.deHoje.length === 0 ? (
                  <EstadoVazio icone={Coffee} titulo="Nenhuma sessão hoje" descricao="Aproveite o dia livre — ou confira a agenda da semana." />
                ) : (
                  <ul className="divide-y">
                    {dados.deHoje.map((s) => {
                      const p = paciente(s.pacienteId);
                      return (
                        <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-3.5">
                          <span className="w-12 font-medium tabular">{hora(s.inicio, fusoPrincipal)}</span>
                          <Link to={`/pacientes/${s.pacienteId}`} className="flex min-w-0 flex-1 items-center gap-3 hover:underline">
                            <PacienteAvatar paciente={p} />
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-medium">{nomeExibicao(p)}</span>
                              <span className="block text-xs text-muted-foreground">
                                {p?.modalidade === "online" ? "Online" : "Presencial"} · <Valor valor={s.valor} />
                              </span>
                            </span>
                          </Link>
                          {/* Os botões já mostram realizada/falta; o selo só aparece para o que eles não mostram. */}
                          {(s.estado === "cancelada" || s.estado === "remarcada") && <EstadoBadge estado={s.estado} className="max-sm:hidden" />}
                          <div className="flex w-full flex-wrap items-center gap-1.5 sm:w-auto">
                            <AcoesSessao sessao={s} compacto />
                            <BotaoNota sessao={s} temNota={comNota.has(s.id)} aoAbrir={setNotaDe} />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
            </div>

            <div className="flex flex-col gap-6">
              {dados.deAmanha.length > 0 && (
                <Card className="gap-0 py-0">
                  <CardHeader className="flex flex-row items-center justify-between border-b px-5 py-4">
                    <CardTitle className="flex items-center gap-2 font-serif text-lg font-medium">
                      <Sunrise className="size-4 text-muted-foreground" aria-hidden /> Amanhã
                    </CardTitle>
                    <span className="text-xs text-muted-foreground">Lembretes</span>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ul className="divide-y">
                      {dados.deAmanha.map((s) => {
                        const p = paciente(s.pacienteId);
                        return (
                          <li key={s.id} className="flex items-center gap-3 px-5 py-2 text-sm">
                            <span className="w-11 tabular text-muted-foreground">{hora(s.inicio, fusoPrincipal)}</span>
                            <span className="min-w-0 flex-1 truncate">{nomeExibicao(p)}</span>
                            {p && (
                              <BotaoMensagem
                                paciente={p}
                                titulo={`Lembrete para ${nomeExibicao(p, "curto")}`}
                                rotulo="Enviar lembrete"
                                variant="ghost"
                                somenteIcone
                                gerar={() => mensagemLembrete(s, p, mensagens, fusoPrincipal)}
                              />
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </CardContent>
                </Card>
              )}
              <Card className="gap-0 py-0">
                <CardHeader className="border-b px-5 py-4">
                  <CardTitle className="font-serif text-lg font-medium">A receber</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {dados.devedores.length === 0 ? (
                    <p className="px-5 py-6 text-sm text-muted-foreground">Nenhum saldo em aberto.</p>
                  ) : (
                    <ul className="divide-y">
                      {dados.devedores.slice(0, 6).map(({ p, saldo }) => (
                        <li key={p.id}>
                          <Link to={`/pacientes/${p.id}`} className="flex items-center gap-3 px-5 py-2.5 text-sm hover:bg-muted/60">
                            <PacienteAvatar paciente={p} className="size-7 text-[10px]" />
                            <span className="min-w-0 flex-1 truncate">{nomeExibicao(p)}</span>
                            <Valores valores={saldo} className="font-medium" />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <Card className="gap-0 py-0">
                <CardHeader className="border-b px-5 py-4">
                  <CardTitle className="font-serif text-lg font-medium">Receita do mês por paciente</CardTitle>
                </CardHeader>
                <CardContent className="px-5 py-4">
                  {dados.receitaPorPaciente.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum pagamento neste mês ainda.</p>
                  ) : (
                    <ul className="space-y-3">
                      {dados.receitaPorPaciente.map(({ id, valores }) => {
                        const v = valores[0]!;
                        const largura = v.moeda === "BRL" ? (v.centavos / maxReceita) * 100 : 0;
                        return (
                          <li key={id} className="text-sm">
                            <div className="flex items-baseline justify-between gap-3">
                              <span className="truncate">{nomeExibicao(paciente(id), "curto")}</span>
                              <Valores valores={valores} className="text-muted-foreground" />
                            </div>
                            {largura > 0 && (
                              <div className="mt-1 h-1.5 rounded-full bg-muted">
                                <div className="h-full rounded-full bg-chart-1" style={{ width: `${largura}%` }} />
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
      <SheetNota aberto={!!notaDe} aoFechar={() => setNotaDe(null)} pacienteId={notaDe?.pacienteId} sessaoId={notaDe?.id} />
    </>
  );
}

/** Abre a nota da sessão; com nota escrita, mostra "Nota ✓". */
function BotaoNota({ sessao, temNota, aoAbrir }: { sessao: Sessao; temNota: boolean; aoAbrir: (s: Sessao) => void }) {
  return (
    <Button size="sm" variant={temNota ? "secondary" : "outline"} onClick={() => aoAbrir(sessao)} title={temNota ? "Continuar a nota desta sessão" : "Escrever a nota desta sessão"}>
      <NotebookPen aria-hidden /> Nota{temNota && <span className="sr-only"> (escrita)</span>}
    </Button>
  );
}

/** Valor principal (BRL, se houver) em destaque; demais moedas pequenas embaixo. */
function ValorMultimoeda({ valores }: { valores: Dinheiro[] }) {
  if (valores.length === 0) return <span className="text-muted-foreground">—</span>;
  // O real é a moeda principal: vem primeiro, mesmo zerado, para os cards serem comparáveis.
  const brl = valores.find((v) => v.moeda === "BRL") ?? { centavos: 0, moeda: "BRL" as const };
  const principal = brl;
  const outros = valores.filter((v) => v.moeda !== "BRL");
  return (
    <>
      <Valor valor={principal} />
      {outros.length > 0 && (
        <span className="mt-0.5 block font-sans text-xs font-normal text-muted-foreground">
          + {outros.map((v) => <Valor key={v.moeda} valor={v} className="mr-2" />)}
        </span>
      )}
    </>
  );
}

function CarregandoPainel() {
  return (
    <div aria-busy="true" aria-label="Carregando painel">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-[108px] rounded-xl" />
        ))}
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[2fr_1fr]">
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </div>
  );
}
