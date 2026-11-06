import { useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { ArrowLeft, CalendarX2, Globe2, Receipt, Trash2, UserX } from "lucide-react";
import {
  ROTULO_MEIO,
  ROTULO_MODALIDADE,
  ROTULO_ORIGEM,
  sessaoCobravel,
  type Contrato,
  type Paciente,
} from "@consultorio/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { somarPorMoeda, useDados } from "@/app/dados";
import { usePreferencias } from "@/app/preferencias";
import { AcoesSessao } from "@/components/AcoesSessao";
import { EstadoBadge, EstadoVazio, PacienteAvatar, Valor, Valores } from "@/components/comuns";
import { capitalizar, fmt, hora, nomeFuso, noFuso, offsetFuso } from "@/lib/datas";
import { AcoesPaciente } from "@/components/formularios/AcoesPaciente";
import { AbaNotas, PontosFixos } from "@/components/notas/Notas";
import { DialogoConfirmacao } from "@/components/formularios/campos";
import { DialogoPagamento } from "@/components/formularios/DialogoPagamento";
import { useAvisos } from "@/app/avisos";
import { contratoVigente, descreverFrequencia, descreverGrade } from "@/lib/pacientes";
import { StatusPaciente } from "./Pacientes";

const ABAS = ["resumo", "sessoes", "pagamentos", "notas"] as const;
type Aba = (typeof ABAS)[number];

export function PaginaPacienteFicha() {
  const { id = "" } = useParams();
  const { paciente, nomeExibicao, contratos } = useDados();
  const [params, setParams] = useSearchParams();
  const aba = (ABAS as readonly string[]).includes(params.get("aba") ?? "") ? (params.get("aba") as Aba) : "resumo";
  const p = paciente(id);

  if (!p) {
    return (
      <EstadoVazio
        icone={UserX}
        titulo="Paciente não encontrado"
        descricao="Talvez o link esteja errado ou o cadastro tenha sido removido."
        acao={
          <Button asChild variant="outline">
            <Link to="/pacientes">Voltar para pacientes</Link>
          </Button>
        }
      />
    );
  }

  const contrato = contratoVigente(contratos, p.id);

  return (
    <>
      <Link to="/pacientes" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Pacientes
      </Link>

      <header className="mb-6 flex flex-wrap items-center gap-4">
        <PacienteAvatar paciente={p} className="size-14 text-base" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-medium sm:text-3xl">{nomeExibicao(p)}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
            <StatusPaciente status={p.status} />
            <Badge variant="outline">{ROTULO_ORIGEM[p.origem]}</Badge>
            <Badge variant="outline">{ROTULO_MODALIDADE[p.modalidade]}</Badge>
            <span className="ml-1">desde {fmt(new Date(p.inicioEm + "T12:00:00"), "MMM 'de' yyyy")}</span>
            {p.fuso !== "America/Sao_Paulo" && (
              <span className="inline-flex items-center gap-1">
                · <Globe2 className="size-3.5" aria-hidden /> {nomeFuso(p.fuso)} ({offsetFuso(p.fuso)})
              </span>
            )}
            {p.arquivadoEm && <Badge variant="secondary">Arquivado</Badge>}
          </div>
        </div>
        <AcoesPaciente paciente={p} contrato={contrato} />
      </header>

      <div className="mb-5">
        <PontosFixos paciente={p} />
      </div>

      <Tabs
        value={aba}
        onValueChange={(v) =>
          setParams(
            (prm) => {
              if (v === "resumo") prm.delete("aba");
              else prm.set("aba", v);
              return prm;
            },
            { replace: true },
          )
        }
      >
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <TabsList>
            <TabsTrigger value="resumo">Resumo</TabsTrigger>
            <TabsTrigger value="sessoes">Sessões</TabsTrigger>
            <TabsTrigger value="pagamentos">Pagamentos</TabsTrigger>
            <TabsTrigger value="notas">Notas</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="resumo" className="mt-4">
          <AbaResumo paciente={p} contrato={contrato} />
        </TabsContent>
        <TabsContent value="sessoes" className="mt-4">
          <AbaSessoes paciente={p} />
        </TabsContent>
        <TabsContent value="pagamentos" className="mt-4">
          <AbaPagamentos paciente={p} />
        </TabsContent>
        <TabsContent value="notas" className="mt-4">
          <AbaNotas paciente={p} />
        </TabsContent>
      </Tabs>
    </>
  );
}

function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 text-sm">
      <dt className="text-muted-foreground">{rotulo}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}

function AbaResumo({ paciente: p, contrato }: { paciente: Paciente; contrato: Contrato | undefined }) {
  const { sessoes, saldoPaciente, contratos } = useDados();
  const { fusoPrincipal } = usePreferencias();
  const historico = contratos.filter((k) => k.pacienteId === p.id && k.id !== contrato?.id).sort((a, b) => b.vigenteDe.localeCompare(a.vigenteDe));
  const agora = Date.now();
  const doPaciente = sessoes.filter((s) => s.pacienteId === p.id);
  const proximas = doPaciente.filter((s) => new Date(s.inicio).getTime() > agora && s.estado === "agendada").slice(0, 4);
  const passadas = doPaciente.filter((s) => new Date(s.inicio).getTime() <= agora);
  const faltas = passadas.filter((s) => s.estado === "falta_cobrada" || s.estado === "falta_nao_cobrada").length;
  const saldo = saldoPaciente(p.id);

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="flex flex-col gap-4">

        <Card className="gap-0 py-0">
          <CardHeader className="flex items-center border-b px-5 py-4">
            <CardTitle className="font-serif text-lg font-medium">Próximas sessões</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {proximas.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted-foreground">Nenhuma sessão agendada.</p>
            ) : (
              <ul className="divide-y">
                {proximas.map((s) => {
                  const d = noFuso(s.inicio, fusoPrincipal);
                  return (
                    <li key={s.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                      <span className="w-28 font-medium">{capitalizar(fmt(d, "EEE, d MMM"))}</span>
                      <span className="tabular text-muted-foreground">{hora(s.inicio, fusoPrincipal)}</span>
                      {p.fuso !== fusoPrincipal && (
                        <span className="text-xs text-muted-foreground">
                          ({hora(s.inicio, p.fuso)} em {nomeFuso(p.fuso)})
                        </span>
                      )}
                      <EstadoBadge estado={s.estado} className="ml-auto" />
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-4">
        <Card className="gap-1 py-4">
          <CardHeader className="px-5">
            <CardTitle className="font-serif text-lg font-medium">Financeiro</CardTitle>
          </CardHeader>
          <CardContent className="px-5">
            <dl className="divide-y">
              <Linha rotulo="A receber">
                <Valores valores={saldo.filter((v) => v.centavos > 0)} className="justify-end" />
              </Linha>
              {saldo.some((v) => v.centavos < 0) && (
                <Linha rotulo="Crédito (pago adiantado)">
                  <Valores valores={saldo.filter((v) => v.centavos < 0).map((v) => ({ ...v, centavos: -v.centavos }))} className="justify-end" />
                </Linha>
              )}
              <Linha rotulo="Sessões realizadas">{passadas.filter((s) => s.estado === "realizada").length}</Linha>
              <Linha rotulo="Faltas">
                {faltas} {passadas.length > 0 && <span className="font-normal text-muted-foreground">({Math.round((faltas / passadas.length) * 100)}%)</span>}
              </Linha>
            </dl>
          </CardContent>
        </Card>

        <Card className="gap-1 py-4">
          <CardHeader className="px-5">
            <CardTitle className="font-serif text-lg font-medium">Contrato</CardTitle>
          </CardHeader>
          <CardContent className="px-5">
            {contrato ? (
              <dl className="divide-y">
                <Linha rotulo="Frequência">{descreverFrequencia(contrato)}</Linha>
                <Linha rotulo="Horário">
                  {contrato.horario} · {contrato.duracaoMin} min
                </Linha>
                <Linha rotulo="Valor por sessão">
                  <Valor valor={contrato.valor} />
                </Linha>
                <Linha rotulo="Cobrança">{contrato.cobranca === "mensal" ? "Fechamento mensal" : "Por sessão"}</Linha>
                <Linha rotulo="Vigente desde">{fmt(new Date(contrato.vigenteDe + "T12:00:00"), "d MMM yyyy")}</Linha>
                {contrato.vigenteAte && <Linha rotulo="Até">{fmt(new Date(contrato.vigenteAte + "T12:00:00"), "d MMM yyyy")}</Linha>}
              </dl>
            ) : (
              <p className="py-2 text-sm text-muted-foreground">Sem contrato vigente ({p.status === "ativo" ? "cadastre um" : "paciente não está ativo"}).</p>
            )}
            {historico.length > 0 && (
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
                  Histórico de contratos ({historico.length})
                </summary>
                <ul className="mt-2 flex flex-col gap-1.5">
                  {historico.map((k) => (
                    <li key={k.id} className="flex items-baseline justify-between gap-3 text-xs">
                      <span className="text-muted-foreground">
                        {fmt(new Date(k.vigenteDe + "T12:00:00"), "dd/MM/yy")} – {k.vigenteAte ? fmt(new Date(k.vigenteAte + "T12:00:00"), "dd/MM/yy") : "…"} · {descreverGrade(k)}
                      </span>
                      <Valor valor={k.valor} className="font-medium" />
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {p.contato && <p className="mt-3 text-xs text-muted-foreground">Contato: {p.contato}</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AbaSessoes({ paciente: p }: { paciente: Paciente }) {
  const { sessoes } = useDados();
  const { fusoPrincipal } = usePreferencias();
  const lista = useMemo(
    () => sessoes.filter((s) => s.pacienteId === p.id).sort((a, b) => b.inicio.localeCompare(a.inicio)),
    [sessoes, p.id],
  );

  if (lista.length === 0) {
    return <Card className="py-0"><EstadoVazio icone={CalendarX2} titulo="Nenhuma sessão" descricao="As sessões aparecem aqui quando houver um contrato com horário fixo." /></Card>;
  }

  const agora = Date.now();
  const proximas = lista.filter((s) => Date.parse(s.inicio) > agora).reverse().slice(0, 4);
  const anteriores = lista.filter((s) => Date.parse(s.inicio) <= agora);

  const linha = (s: (typeof lista)[number]) => {
    const d = noFuso(s.inicio, fusoPrincipal);
    return (
      <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-5">
        <div className="text-sm whitespace-nowrap sm:w-36">
          <span className="font-medium">{capitalizar(fmt(d, "EEE, d MMM"))}</span>
          <span className="ml-2 tabular text-muted-foreground">{hora(s.inicio, fusoPrincipal)}</span>
        </div>
        <EstadoBadge estado={s.estado} />
        <span className="text-sm text-muted-foreground">
          <Valor valor={s.valor} />
          {sessaoCobravel(s.estado) && (s.pago ? " · pago" : " · em aberto")}
        </span>
        <AcoesSessao sessao={s} compacto className="w-full sm:ml-auto sm:w-auto" />
      </li>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {proximas.length > 0 && (
        <Card className="gap-0 overflow-hidden py-0">
          <h2 className="border-b px-5 py-3 font-sans text-sm font-medium text-muted-foreground">Próximas</h2>
          <ul className="divide-y">{proximas.map(linha)}</ul>
        </Card>
      )}
      <Card className="gap-0 overflow-hidden py-0">
        <h2 className="border-b px-5 py-3 font-sans text-sm font-medium text-muted-foreground">
          Anteriores <span className="tabular">({anteriores.length})</span>
        </h2>
        <ul className="divide-y">{anteriores.map(linha)}</ul>
      </Card>
    </div>
  );
}

function AbaPagamentos({ paciente: p }: { paciente: Paciente }) {
  const { pagamentos, contas, mutar } = useDados();
  const { avisar } = useAvisos();
  const [registrar, setRegistrar] = useState(false);
  const [excluir, setExcluir] = useState<string | null>(null);
  const lista = pagamentos.filter((x) => x.pacienteId === p.id).sort((a, b) => b.data.localeCompare(a.data));
  const contaPorId = new Map(contas.map((c) => [c.id, c]));
  const dialogos = (
    <>
      <DialogoPagamento aberto={registrar} aoFechar={() => setRegistrar(false)} pacienteId={p.id} />
      <DialogoConfirmacao
        aberto={excluir !== null}
        aoFechar={() => setExcluir(null)}
        titulo="Excluir pagamento"
        rotuloConfirmar="Excluir"
        destrutivo
        descricao="As sessões que ele quitava voltam a ficar em aberto."
        aoConfirmar={async () => {
          await mutar("DELETE", `/pagamentos/${excluir}`);
          avisar("Pagamento excluído.");
        }}
      />
    </>
  );

  if (lista.length === 0) {
    return (
      <Card className="py-0">
        {dialogos}
        <EstadoVazio
          icone={Receipt}
          titulo="Nenhum pagamento"
          descricao="Os pagamentos registrados aparecem aqui e entram como receita em Finanças."
          acao={
            <Button onClick={() => setRegistrar(true)}>
              <Receipt aria-hidden /> Registrar pagamento
            </Button>
          }
        />
      </Card>
    );
  }

  return (
    <Card className="gap-0 overflow-hidden py-0">
      {dialogos}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3 text-sm">
        <span className="text-muted-foreground">
          {lista.length} pagamentos · Total: <Valores valores={somarPorMoeda(lista.map((x) => x.valor))} className="font-medium text-foreground" />
        </span>
        <Button size="sm" onClick={() => setRegistrar(true)}>
          <Receipt aria-hidden /> Registrar pagamento
        </Button>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-5">Data</TableHead>
              <TableHead>Meio</TableHead>
              <TableHead>Conta</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="w-12 pr-3">
                <span className="sr-only">Ações</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lista.map((x) => {
              const c = contaPorId.get(x.contaId);
              return (
                <TableRow key={x.id}>
                  <TableCell className="pl-5 tabular">{fmt(new Date(x.data + "T12:00:00"), "dd/MM/yyyy")}</TableCell>
                  <TableCell>{ROTULO_MEIO[x.meio]}</TableCell>
                  <TableCell className="text-muted-foreground">{c ? `${c.instituicao} · ${c.nome}` : "—"}</TableCell>
                  <TableCell className="text-right font-medium">
                    <Valor valor={x.valor} />
                    {x.sessaoIds.length > 0 && (
                      <span className="block text-xs font-normal text-muted-foreground">
                        {x.sessaoIds.length} {x.sessaoIds.length === 1 ? "sessão" : "sessões"}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="pr-3">
                    <Button variant="ghost" size="icon-sm" aria-label={`Excluir pagamento de ${fmt(new Date(x.data + "T12:00:00"), "dd/MM/yyyy")}`} onClick={() => setExcluir(x.id)}>
                      <Trash2 aria-hidden />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
