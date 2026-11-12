import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Archive, ChevronRight, Search, SearchX, UserPlus, Users } from "lucide-react";
import {
  ORIGENS,
  ultimaRealizada,
  ROTULO_MODALIDADE,
  ROTULO_ORIGEM,
  ROTULO_STATUS,
  STATUS_PACIENTE,
  type Paciente,
} from "@consultorio/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDados } from "@/app/dados";
import { CabecalhoPagina, EstadoVazio, PacienteAvatar, Valor, Valores } from "@/components/comuns";
import { DialogoPaciente } from "@/components/formularios/DialogoPaciente";
import { contratoVigente, descreverGrade, ESTILO_STATUS } from "@/lib/pacientes";
import { capitalizar, fmt, noFuso } from "@/lib/datas";
import { usePreferencias } from "@/app/preferencias";
import { cn } from "@/lib/utils";

type FiltroStatus = Paciente["status"] | "todos" | "arquivados";
type FiltroOrigem = Paciente["origem"] | "todas";

export function StatusPaciente({ status, className }: { status: Paciente["status"]; className?: string }) {
  return (
    <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap", ESTILO_STATUS[status], className)}>
      {ROTULO_STATUS[status]}
    </span>
  );
}

/** Ativo sem sessão realizada há este tanto de dias = "sumiu" (pausa não combinada?). */
export const DIAS_SUMIDO = 21;

const DIA = 86_400_000;

function haQuanto(instante: string, agora: number): string {
  const dias = Math.floor((agora - Date.parse(instante)) / DIA);
  return dias <= 0 ? "hoje" : dias === 1 ? "ontem" : `há ${dias} dias`;
}

/** Última sessão realizada, próxima agendada e alerta de quem sumiu. */
function Acompanhamento({ ultima, proxima, sumido, compacto }: { ultima?: string; proxima?: string; sumido: number | null; compacto?: boolean }) {
  const { fusoPrincipal } = usePreferencias();
  const agora = Date.now();
  if (sumido !== null)
    return (
      <span className="inline-flex rounded-full border border-[var(--st-falta-bd)] bg-[var(--st-falta-bg)] px-2 py-0.5 text-xs font-medium whitespace-nowrap text-[var(--st-falta-fg)]" title="Ativo, mas sem sessão realizada recentemente">
        {ultima ? `Sem sessão ${haQuanto(ultima, agora)}` : "Nenhuma sessão ainda"}
      </span>
    );
  return (
    <span className={cn("text-sm", compacto && "text-xs text-muted-foreground")}>
      {ultima ? <span className={cn(!compacto && "block")}>Última {haQuanto(ultima, agora)}</span> : null}
      {proxima && (
        <span className={cn("text-xs text-muted-foreground", !compacto && "block")}>
          {compacto && ultima ? " · " : ""}Próxima {capitalizar(fmt(noFuso(proxima, fusoPrincipal), "EEE, d/MM"))}
        </span>
      )}
      {!ultima && !proxima && <span className="text-muted-foreground">—</span>}
    </span>
  );
}

export function PaginaPacientes() {
  const { pacientes, arquivados, contratos, sessoes, carregando, nomeExibicao, saldoPaciente } = useDados();
  const [novo, setNovo] = useState(false);
  const navegar = useNavigate();
  const [params, setParams] = useSearchParams();
  const [busca, setBusca] = useState("");
  const status = (params.get("status") ?? "ativo") as FiltroStatus;
  const origem = (params.get("origem") ?? "todas") as FiltroOrigem;

  const mudarFiltro = (chave: string, valor: string, padrao: string) =>
    setParams(
      (p) => {
        if (valor === padrao) p.delete(chave);
        else p.set(chave, valor);
        return p;
      },
      { replace: true },
    );

  const contagem = useMemo(() => {
    const c: Record<FiltroStatus, number> = { todos: pacientes.length, ativo: 0, pausa: 0, alta: 0, interrompido: 0, arquivados: arquivados.length };
    for (const p of pacientes) c[p.status]++;
    return c;
  }, [pacientes, arquivados]);

  const agora = new Date();
  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (status === "arquivados" ? arquivados : pacientes)
      .filter((p) => status === "todos" || status === "arquivados" || p.status === status)
      .filter((p) => origem === "todas" || p.origem === origem)
      .filter((p) => !termo || p.nome.toLowerCase().includes(termo) || p.apelido.toLowerCase().includes(termo))
      .map((p) => {
        const ultima = ultimaRealizada(sessoes, p.id, agora);
        const proxima = sessoes.find((s) => s.pacienteId === p.id && s.estado === "agendada" && Date.parse(s.inicio) > agora.getTime())?.inicio;
        const desde = ultima ? Date.parse(ultima) : Date.parse(`${p.inicioEm}T12:00:00Z`);
        const sumido = p.status === "ativo" && agora.getTime() - desde > DIAS_SUMIDO * DIA ? Math.floor((agora.getTime() - desde) / DIA) : null;
        return { p, contrato: contratoVigente(contratos, p.id), saldo: saldoPaciente(p.id).filter((v) => v.centavos > 0), ultima, proxima, sumido };
      })
      .sort((a, b) => a.p.nome.localeCompare(b.p.nome, "pt-BR"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pacientes, arquivados, contratos, sessoes, status, origem, busca, saldoPaciente]);


  const temFiltro = status !== "ativo" || origem !== "todas" || busca !== "";
  const limpar = () => {
    setBusca("");
    setParams({}, { replace: true });
  };

  return (
    <>
      <CabecalhoPagina
        titulo="Pacientes"
        descricao={carregando ? "Carregando…" : `${contagem.ativo} ativos · ${pacientes.length} no total`}
        acoes={
          <Button size="sm" onClick={() => setNovo(true)}>
            <UserPlus aria-hidden /> Novo paciente
          </Button>
        }
      />
      <DialogoPaciente aberto={novo} aoFechar={() => setNovo(false)} />

      {/* Filtros */}
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div role="group" aria-label="Filtrar por status" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:pb-0">
          {(["todos", ...STATUS_PACIENTE] as Array<Paciente["status"] | "todos">).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={status === s ? "secondary" : "ghost"}
              aria-pressed={status === s}
              className={cn("shrink-0", status === s && "ring-1 ring-primary/25")}
              onClick={() => mudarFiltro("status", s, "ativo")}
            >
              {s === "todos" ? "Todos" : ROTULO_STATUS[s]}
              <span className="text-xs text-muted-foreground tabular">{contagem[s]}</span>
            </Button>
          ))}
          {contagem.arquivados > 0 && (
            <Button
              size="sm"
              variant={status === "arquivados" ? "secondary" : "ghost"}
              aria-pressed={status === "arquivados"}
              className={cn("shrink-0", status === "arquivados" && "ring-1 ring-primary/25")}
              onClick={() => mudarFiltro("status", "arquivados", "ativo")}
            >
              <Archive aria-hidden /> Arquivados
              <span className="text-xs text-muted-foreground tabular">{contagem.arquivados}</span>
            </Button>
          )}
        </div>
        <div className="flex gap-2 lg:ml-auto">
          <div className="relative min-w-0 flex-1 lg:w-64 lg:flex-none">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome ou iniciais"
              aria-label="Buscar paciente"
              className="bg-card pl-8"
            />
          </div>
          <Select value={origem} onValueChange={(v) => mudarFiltro("origem", v, "todas")}>
            <SelectTrigger className="w-40 bg-card" aria-label="Filtrar por origem">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as origens</SelectItem>
              {ORIGENS.map((o) => (
                <SelectItem key={o} value={o}>
                  {ROTULO_ORIGEM[o]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {carregando ? (
        <Card className="gap-0 p-0" aria-busy="true" aria-label="Carregando pacientes">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex items-center gap-3 border-b px-4 py-3 last:border-0">
              <Skeleton className="size-8 rounded-full" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="ml-auto h-4 w-20" />
            </div>
          ))}
        </Card>
      ) : pacientes.length === 0 && arquivados.length === 0 ? (
        <Card className="py-0">
          <EstadoVazio
            icone={Users}
            titulo="Nenhum paciente ainda"
            descricao="Cadastre o primeiro paciente para começar a montar a agenda."
            acao={
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={() => setNovo(true)}>
                  <UserPlus aria-hidden /> Novo paciente
                </Button>
                <Button asChild variant="outline">
                  <Link to="/configuracoes">Testar com dados fictícios</Link>
                </Button>
              </div>
            }
          />
        </Card>
      ) : lista.length === 0 ? (
        <Card className="py-0">
          <EstadoVazio
            icone={SearchX}
            titulo="Ninguém com esses filtros"
            descricao="Tente outro status, outra origem ou limpe a busca."
            acao={
              temFiltro && (
                <Button variant="outline" onClick={limpar}>
                  Limpar filtros
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <>
          {/* Desktop: tabela */}
          <Card className="hidden gap-0 overflow-hidden py-0 md:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4">Paciente</TableHead>
                  <TableHead>Acompanhamento</TableHead>
                  <TableHead>Horário fixo</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">A receber</TableHead>
                  <TableHead className="pr-4">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lista.map(({ p, contrato, saldo, ultima, proxima, sumido }) => (
                  <TableRow
                    key={p.id}
                    className="cursor-pointer"
                    onClick={() => navegar(`/pacientes/${p.id}`)}
                  >
                    <TableCell className="py-2.5 pl-4">
                      <div className="flex items-center gap-3">
                        <PacienteAvatar paciente={p} />
                        <div className="min-w-0">
                          <Link
                            to={`/pacientes/${p.id}`}
                            className="block truncate font-medium hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {nomeExibicao(p)}
                          </Link>
                          <span className="text-xs text-muted-foreground">
                            {ROTULO_MODALIDADE[p.modalidade]} · {ROTULO_ORIGEM[p.origem]}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Acompanhamento ultima={ultima} proxima={proxima} sumido={sumido} />
                    </TableCell>
                    <TableCell className="tabular">{descreverGrade(contrato)}</TableCell>
                    <TableCell className="text-right">{contrato ? <Valor valor={contrato.valor} /> : "—"}</TableCell>
                    <TableCell className="text-right font-medium">
                      <Valores valores={saldo} className="justify-end" />
                    </TableCell>
                    <TableCell className="pr-4">
                      <StatusPaciente status={p.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Mobile: cartões */}
          <ul className="flex flex-col gap-2 md:hidden">
            {lista.map(({ p, contrato, saldo, ultima, proxima, sumido }) => (
              <li key={p.id}>
                <Link
                  to={`/pacientes/${p.id}`}
                  className="flex items-center gap-3 rounded-xl border bg-card p-3.5 shadow-xs active:bg-muted"
                >
                  <PacienteAvatar paciente={p} className="size-10 text-sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{nomeExibicao(p)}</span>
                      {p.status !== "ativo" && <StatusPaciente status={p.status} />}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {descreverGrade(contrato)} · {ROTULO_ORIGEM[p.origem]}
                    </p>
                    <p className="mt-0.5">
                      <Acompanhamento ultima={ultima} proxima={proxima} sumido={sumido} compacto />
                    </p>
                    {saldo.length > 0 && (
                      <p className="mt-0.5 text-xs">
                        A receber: <Valores valores={saldo} className="font-medium" />
                      </p>
                    )}
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
