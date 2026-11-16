import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { CalendarOff, ChevronLeft, ChevronRight, CircleDollarSign, Globe2, Undo2, X } from "lucide-react";
import { ocorrencias as expandir, type Alcance, type Compromisso, type Ocorrencia, type Sessao } from "@consultorio/shared";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useDados } from "@/app/dados";
import { usePreferencias } from "@/app/preferencias";
import { ESTILO_ESTADO } from "@/components/comuns";
import { DialogoRecorrencia } from "@/components/calendar/DialogoRecorrencia";
import { GradeHorario, type Fantasma } from "@/components/calendar/GradeHorario";
import { type SessaoInicial } from "@/components/formularios/DialogoSessao";
import { FormCompromisso, type ValoresCompromisso } from "@/components/formularios/FormCompromisso";
import { DialogoNovoEvento } from "@/components/calendar/DialogoNovoEvento";
import { PainelCompromisso } from "@/components/calendar/PainelCompromisso";
import { lerIdOcorrencia } from "@/components/calendar/BlocoCompromisso";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PainelSessao } from "@/components/calendar/PainelSessao";
import { VisaoMes } from "@/components/calendar/VisaoMes";
import { capitalizar, chaveDia, FUSOS_DISPONIVEIS, fmt, hora, instanteEm, minutosDoDia, nomeFuso, noFuso, offsetFuso, SEMANA } from "@/lib/datas";
import { cn } from "@/lib/utils";

type Visao = "dia" | "semana" | "mes";
const VISOES: Visao[] = ["dia", "semana", "mes"];

function visaoPadrao(): Visao {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches ? "dia" : "semana";
}

function titulo(visao: Visao, ref: Date): string {
  if (visao === "dia") return capitalizar(fmt(ref, "EEEE, d 'de' MMMM 'de' yyyy"));
  if (visao === "mes") return capitalizar(fmt(ref, "MMMM 'de' yyyy"));
  const ini = startOfWeek(ref, SEMANA);
  const fim = endOfWeek(ref, SEMANA);
  if (isSameMonth(ini, fim)) return `${fmt(ini, "d")} – ${fmt(fim, "d 'de' MMMM 'de' yyyy")}`;
  return `${fmt(ini, "d 'de' MMM")} – ${fmt(fim, "d 'de' MMM 'de' yyyy")}`;
}

const LEGENDA = [
  ["agendada", "Agendada"],
  ["realizada", "Realizada"],
  ["falta", "Falta"],
  ["cancelada", "Cancelada"],
  ["remarcada", "Remarcada"],
] as const;

interface Aviso {
  texto: string;
  desfazer?: () => void;
}

/** Mudança de horário/duração esperando a resposta "só esta / esta e as seguintes". */
interface Pendente {
  sessao: Sessao;
  inicio: string;
  duracaoMin: number;
}

type AlcanceSessao = "so_esta" | "seguintes";

/** Mudança num compromisso que se repete, esperando "este / este e os seguintes / todos". */
interface PendenteCompromisso {
  compromisso: Compromisso;
  ocorrencia: Ocorrencia;
  acao: "alterar" | "excluir";
  mudanca?: Partial<ValoresCompromisso>;
  /** A regra mudou: "só este" não faz sentido. */
  regraMudou?: boolean;
}

function hhmm(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export function PaginaAgenda() {
  const { sessoes, compromissos, carregando, atualizarSessao, paciente, mutar } = useDados();
  const { fusoPrincipal, fusoSecundario, atualizar } = usePreferencias();
  const [params, setParams] = useSearchParams();
  const [agora, setAgora] = useState(() => new Date());
  const [aberta, setAberta] = useState<string | null>(null);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [pendente, setPendente] = useState<Pendente | null>(null);
  const [criando, setCriando] = useState<Fantasma | null>(null);
  const [compromissoAberto, setCompromissoAberto] = useState<string | null>(null);
  const [pendenteC, setPendenteC] = useState<PendenteCompromisso | null>(null);
  const [editando, setEditando] = useState<{ compromisso: Compromisso; ocorrencia: Ocorrencia } | null>(null);

  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), aviso.desfazer ? 6000 : 8000);
    return () => clearTimeout(t);
  }, [aviso]);

  const visao: Visao = VISOES.includes(params.get("visao") as Visao) ? (params.get("visao") as Visao) : visaoPadrao();
  const hojeParede = noFuso(agora, fusoPrincipal);
  const dataParam = params.get("data");
  const ref = dataParam && /^\d{4}-\d{2}-\d{2}$/.test(dataParam) ? new Date(dataParam + "T00:00:00") : hojeParede;

  const ir = useCallback(
    (v: Visao, d: Date) =>
      setParams(
        (p) => {
          p.set("visao", v);
          p.set("data", format(d, "yyyy-MM-dd"));
          return p;
        },
        { replace: true },
      ),
    [setParams],
  );

  const passo = useCallback(
    (n: number) => ir(visao, visao === "dia" ? addDays(ref, n) : visao === "semana" ? addWeeks(ref, n) : addMonths(ref, n)),
    [ir, visao, ref],
  );

  // Atalhos: ← → navegam, T = hoje, D/S/M trocam a visão.
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || alvo.closest("input, textarea, select, [role=dialog], [contenteditable]")) return;
      const k = e.key.toLowerCase();
      if (e.key === "ArrowLeft") passo(-1);
      else if (e.key === "ArrowRight") passo(1);
      else if (k === "t") ir(visao, hojeParede);
      else if (k === "d") ir("dia", ref);
      else if (k === "s") ir("semana", ref);
      else if (k === "m") ir("mes", ref);
      else if (k === "c") {
        e.preventDefault();
        // Próxima hora cheia de hoje, ou 09:00 em outro dia.
        const chave = format(ref, "yyyy-MM-dd");
        const ehHoje = chave === format(hojeParede, "yyyy-MM-dd");
        const inicio = ehHoje ? Math.min(23 * 60, (Math.floor(minutosDoDia(agora, fusoPrincipal) / 60) + 1) * 60) : 9 * 60;
        setCriando({ chave, inicio, duracao: 50 });
      }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [passo, ir, visao, ref, hojeParede, agora, fusoPrincipal]);

  const dias = useMemo(() => {
    if (visao === "dia") return [ref];
    if (visao === "semana") return eachDayOfInterval({ start: startOfWeek(ref, SEMANA), end: endOfWeek(ref, SEMANA) });
    return eachDayOfInterval({ start: startOfWeek(startOfMonth(ref), SEMANA), end: endOfWeek(endOfMonth(ref), SEMANA) });
  }, [visao, ref]);

  const chavesVisiveis = useMemo(() => new Set(dias.map((d) => format(d, "yyyy-MM-dd"))), [dias]);
  const visiveis = useMemo(
    () => sessoes.filter((s) => chavesVisiveis.has(chaveDia(s.inicio, fusoPrincipal))),
    [sessoes, chavesVisiveis, fusoPrincipal],
  );
  const ocorrenciasVisiveis = useMemo(() => {
    const de = format(addDays(dias[0]!, -1), "yyyy-MM-dd");
    const ate = format(addDays(dias.at(-1)!, 1), "yyyy-MM-dd");
    return compromissos.flatMap((c) => expandir(c, de, ate)).filter((o) => chavesVisiveis.has(chaveDia(o.inicio, fusoPrincipal)));
  }, [compromissos, dias, chavesVisiveis, fusoPrincipal]);
  const ocorrenciaPorId = useCallback(
    (id: string) => {
      const ref = lerIdOcorrencia(id);
      if (!ref) return null;
      const o = ocorrenciasVisiveis.find((x) => x.compromissoId === ref.compromissoId && x.data === ref.data);
      const c = compromissos.find((x) => x.id === ref.compromissoId);
      return o && c ? { o, c } : null;
    },
    [ocorrenciasVisiveis, compromissos],
  );
  const abertoC = compromissoAberto ? ocorrenciaPorId(compromissoAberto) : null;

  /** "Só esta": muda a sessão; se veio da grade, ela passa a ser uma exceção (remarcada). */
  const aplicarSoEsta = useCallback(
    (s: Sessao, inicio: string, duracaoMin: number) => {
      const antes = { inicio: s.inicio, duracaoMin: s.duracaoMin, estado: s.estado };
      const virouExcecao = !!s.contratoId && s.estado === "agendada";
      atualizarSessao(s.id, { inicio, duracaoMin, ...(virouExcecao ? { estado: "remarcada" as const } : {}) });
      const p = paciente(s.pacienteId);
      const quando = `${fmt(noFuso(inicio, fusoPrincipal), "EEE, d MMM")} às ${hora(inicio, fusoPrincipal)}`;
      setAviso({
        texto: inicio === s.inicio ? `${p?.apelido ?? "Sessão"}: agora com ${duracaoMin} min` : `${p?.apelido ?? "Sessão"} movida para ${quando}`,
        desfazer: () => atualizarSessao(s.id, antes),
      });
    },
    [atualizarSessao, paciente, fusoPrincipal],
  );

  /** Grava uma mudança de compromisso com o alcance escolhido. */
  const gravarCompromisso = useCallback(
    async (c: Compromisso, o: Ocorrencia, alcance: Alcance, mudanca: Partial<ValoresCompromisso>) => {
      const { recorrencia, ...resto } = mudanca;
      await mutar("PATCH", `/compromissos/${c.id}`, {
        alcance,
        data: o.data,
        ...resto,
        ...(recorrencia !== undefined && alcance !== "este" ? { recorrencia } : {}),
      });
    },
    [mutar],
  );

  /** Mover/redimensionar um compromisso: pergunta o alcance se ele se repete; senão grava com desfazer. */
  const alterarCompromisso = useCallback(
    (id: string, mudanca: { inicio?: string; duracaoMin?: number }) => {
      const achado = ocorrenciaPorId(id);
      if (!achado) return;
      const { o, c } = achado;
      if ((mudanca.inicio ?? o.inicio) === o.inicio && (mudanca.duracaoMin ?? o.duracaoMin) === o.duracaoMin) return;
      if (c.recorrencia) {
        setPendenteC({ compromisso: c, ocorrencia: o, acao: "alterar", mudanca });
        return;
      }
      const antes = { inicio: o.inicio, duracaoMin: o.duracaoMin };
      gravarCompromisso(c, o, "todos", mudanca)
        .then(() =>
          setAviso({
            texto: `${o.titulo}: ${fmt(noFuso(mudanca.inicio ?? o.inicio, fusoPrincipal), "EEE, d MMM")} às ${hora(mudanca.inicio ?? o.inicio, fusoPrincipal)}`,
            desfazer: () => {
              const novaData = chaveDia(mudanca.inicio ?? o.inicio, c.fuso);
              mutar("PATCH", `/compromissos/${c.id}`, { alcance: "todos", data: novaData, ...antes }).catch(() => {});
            },
          }),
        )
        .catch((e) => setAviso({ texto: e instanceof Error ? e.message : "Não foi possível mover." }));
    },
    [ocorrenciaPorId, gravarCompromisso, mutar, fusoPrincipal],
  );

  const responderAlcanceCompromisso = async (alcance: Alcance) => {
    if (!pendenteC) return;
    const { compromisso: c, ocorrencia: o, acao, mudanca } = pendenteC;
    try {
      if (acao === "excluir") {
        await mutar("POST", `/compromissos/${c.id}/excluir`, { alcance, data: o.data });
        setAviso({ texto: alcance === "este" ? `${o.titulo}: excluído neste dia.` : alcance === "seguintes" ? `${o.titulo}: excluído daqui em diante.` : `${o.titulo}: excluído.` });
      } else {
        await gravarCompromisso(c, o, alcance, mudanca ?? {});
        setAviso({ texto: `${o.titulo}: ${alcance === "este" ? "alterado só neste dia" : alcance === "seguintes" ? "alterado daqui em diante" : "todos alterados"}.` });
      }
    } catch (e) {
      setAviso({ texto: e instanceof Error ? e.message : "Não foi possível salvar." });
    }
    setPendenteC(null);
    setCompromissoAberto(null);
  };

  const excluirCompromisso = async (c: Compromisso, o: Ocorrencia) => {
    if (c.recorrencia) return setPendenteC({ compromisso: c, ocorrencia: o, acao: "excluir" });
    await mutar("POST", `/compromissos/${c.id}/excluir`, { alcance: "todos", data: o.data });
    setCompromissoAberto(null);
    setAviso({
      texto: `${o.titulo}: excluído.`,
      desfazer: () => {
        mutar("POST", "/compromissos", { tipo: c.tipo, titulo: c.titulo, categoria: c.categoria, inicio: c.inicio, duracaoMin: c.duracaoMin, recorrencia: null }).catch(() => {});
      },
    });
  };

  /** Ponto único para mover e redimensionar: pergunta o alcance quando a sessão vem da grade. */
  const alterar = useCallback(
    (id: string, mudanca: { inicio?: string; duracaoMin?: number }) => {
      if (lerIdOcorrencia(id)) return alterarCompromisso(id, mudanca);
      const s = sessoes.find((x) => x.id === id);
      if (!s) return;
      const inicio = mudanca.inicio ?? s.inicio;
      const duracaoMin = mudanca.duracaoMin ?? s.duracaoMin;
      if (inicio === s.inicio && duracaoMin === s.duracaoMin) return;
      if (s.contratoId && s.estado === "agendada") setPendente({ sessao: s, inicio, duracaoMin });
      else aplicarSoEsta(s, inicio, duracaoMin);
    },
    [sessoes, aplicarSoEsta, alterarCompromisso],
  );

  const mover = useCallback(
    (id: string, diaChave: string, minutos: number) =>
      alterar(id, { inicio: instanteEm(new Date(diaChave + "T00:00:00"), minutos, fusoPrincipal).toISOString() }),
    [alterar, fusoPrincipal],
  );
  const redimensionar = useCallback((id: string, duracaoMin: number) => alterar(id, { duracaoMin }), [alterar]);
  const abrirCompromisso = useCallback((o: Ocorrencia) => setCompromissoAberto(`c:${o.compromissoId}:${o.data}`), []);

  const responderAlcance = async (alcance: AlcanceSessao) => {
    if (!pendente) return;
    const { sessao: s, inicio, duracaoMin } = pendente;
    if (alcance === "so_esta") {
      aplicarSoEsta(s, inicio, duracaoMin);
      setPendente(null);
      return;
    }
    try {
      const r = await mutar<{ ok: true; mantidas: number }>("POST", `/sessoes/${s.id}/seguintes`, { inicio, duracaoMin });
      const p = paciente(s.pacienteId);
      const desde = fmt(noFuso(inicio < s.inicio ? inicio : s.inicio, fusoPrincipal), "d 'de' MMM");
      setAviso({
        texto:
          `Horário fixo de ${p?.apelido ?? "paciente"} alterado a partir de ${desde}.` +
          (r.mantidas ? ` ${r.mantidas === 1 ? "1 sessão com registro ficou" : `${r.mantidas} sessões com registro ficaram`} como estava${r.mantidas === 1 ? "" : "m"}.` : ""),
      });
      setPendente(null);
    } catch (e) {
      setAviso({ texto: e instanceof Error ? e.message : "Não foi possível alterar o horário fixo." });
      setPendente(null);
    }
  };

  const inicialCriacao: SessaoInicial | null = criando ? { data: criando.chave, horario: hhmm(criando.inicio), duracaoMin: criando.duracao } : null;

  const abrir = useCallback((s: Sessao) => setAberta(s.id), []);
  const abrirDia = useCallback((d: Date) => ir("dia", d), [ir]);
  const vazioTexto = visao === "dia" ? "neste dia" : visao === "semana" ? "nesta semana" : "neste mês";

  return (
    <>
      {/* Barra de ferramentas */}
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex min-w-0 items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => ir(visao, hojeParede)}>
            Hoje
          </Button>
          <div className="flex">
            <Button variant="ghost" size="icon-sm" aria-label="Anterior" onClick={() => passo(-1)}>
              <ChevronLeft aria-hidden />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Próximo" onClick={() => passo(1)}>
              <ChevronRight aria-hidden />
            </Button>
          </div>
          <h1 className="truncate text-xl font-medium sm:text-2xl" aria-live="polite">
            {titulo(visao, ref)}
          </h1>
        </div>

        <div className="flex items-center gap-2 lg:ml-auto">
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={visao}
            onValueChange={(v) => v && ir(v as Visao, ref)}
            aria-label="Visão do calendário"
          >
            <ToggleGroupItem value="dia" className="px-3">Dia</ToggleGroupItem>
            <ToggleGroupItem value="semana" className="px-3">Semana</ToggleGroupItem>
            <ToggleGroupItem value="mes" className="px-3">Mês</ToggleGroupItem>
          </ToggleGroup>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Globe2 aria-hidden />
                <span>{nomeFuso(fusoPrincipal)}</span>
                {fusoSecundario && <span className="text-muted-foreground">+ {nomeFuso(fusoSecundario)}</span>}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                Agenda em {nomeFuso(fusoPrincipal)} ({offsetFuso(fusoPrincipal)}). Mostrar também:
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup
                value={fusoSecundario ?? "nenhum"}
                onValueChange={(v) => atualizar({ fusoSecundario: v === "nenhum" ? null : v })}
              >
                <DropdownMenuRadioItem value="nenhum">Nenhum outro fuso</DropdownMenuRadioItem>
                {FUSOS_DISPONIVEIS.filter((f) => f !== fusoPrincipal).map((f) => (
                  <DropdownMenuRadioItem key={f} value={f}>
                    {nomeFuso(f)} <span className="ml-auto text-xs text-muted-foreground">{offsetFuso(f)}</span>
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Legenda */}
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
        {LEGENDA.map(([g, rotulo]) => (
          <span key={g} className="flex items-center gap-1.5">
            <span className={cn("size-2.5 rounded-[3px] border border-l-[3px]", ESTILO_ESTADO[g])} aria-hidden />
            {rotulo}
          </span>
        ))}
        <span className="flex items-center gap-1">
          <CircleDollarSign className="size-3.5" aria-hidden /> pago
        </span>
        <span className="ml-auto hidden lg:inline">Clique num horário para criar · arraste para remarcar · puxe a borda para a duração · C cria · T hoje</span>
      </div>

      {!carregando && visiveis.length === 0 && ocorrenciasVisiveis.length === 0 && (
        <div className="mb-3 flex items-center gap-3 rounded-xl border border-dashed bg-card px-4 py-3 text-sm">
          <CalendarOff className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          <span>
            <span className="font-medium">Nenhuma sessão {vazioTexto}.</span>{" "}
            <span className="text-muted-foreground">As sessões são geradas pela grade fixa de cada paciente.</span>
          </span>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => ir(visao, hojeParede)}>
            Ir para hoje
          </Button>
        </div>
      )}

      <div aria-busy={carregando}>
        {visao === "mes" ? (
          <VisaoMes
            referencia={ref}
            sessoes={visiveis}
            ocorrencias={ocorrenciasVisiveis}
            aoAbrirCompromisso={abrirCompromisso}
            agora={agora}
            fusoPrincipal={fusoPrincipal}
            carregando={carregando}
            aoAbrir={abrir}
            aoAbrirDia={abrirDia}
            aoMover={mover}
          />
        ) : (
          <GradeHorario
            dias={dias}
            sessoes={visiveis}
            ocorrencias={ocorrenciasVisiveis}
            aoAbrirCompromisso={abrirCompromisso}
            agora={agora}
            pxPorHora={visao === "dia" ? 64 : 48}
            fusoPrincipal={fusoPrincipal}
            fusoSecundario={fusoSecundario}
            carregando={carregando}
            aoAbrir={abrir}
            aoAbrirDia={abrirDia}
            aoMover={mover}
            aoRedimensionar={redimensionar}
            aoCriar={setCriando}
            fantasma={criando}
          />
        )}
      </div>

      <DialogoRecorrencia<AlcanceSessao>
        aberto={pendente !== null}
        titulo="Alterar sessão do horário fixo"
        descricao={pendente ? `${paciente(pendente.sessao.pacienteId)?.apelido ?? "Paciente"}: ${fmt(noFuso(pendente.inicio, fusoPrincipal), "EEE, d MMM")}, ${hora(pendente.inicio, fusoPrincipal)} · ${pendente.duracaoMin} min` : undefined}
        opcoes={[
          { valor: "so_esta", rotulo: "Só esta sessão", descricao: "As outras continuam no horário fixo." },
          {
            valor: "seguintes",
            rotulo: "Esta e as seguintes",
            descricao: "O horário fixo muda a partir desta. Sessões com nota ou pagamento não mudam.",
          },
        ]}
        aoEscolher={responderAlcance}
        aoFechar={() => setPendente(null)}
      />

      <DialogoNovoEvento inicial={inicialCriacao} aoFechar={() => setCriando(null)} />

      <PainelCompromisso
        ocorrencia={abertoC?.o ?? null}
        compromisso={abertoC?.c}
        fusoPrincipal={fusoPrincipal}
        aoFechar={() => setCompromissoAberto(null)}
        aoEditar={() => abertoC && setEditando({ compromisso: abertoC.c, ocorrencia: abertoC.o })}
        aoExcluir={() => abertoC && excluirCompromisso(abertoC.c, abertoC.o).catch((e) => setAviso({ texto: e instanceof Error ? e.message : "Não foi possível excluir." }))}
      />

      <Dialog open={editando !== null} onOpenChange={(v) => !v && setEditando(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl font-medium">{editando?.compromisso.tipo === "bloqueio" ? "Editar bloqueio" : "Editar compromisso"}</DialogTitle>
          </DialogHeader>
          {editando && (
            <FormCompromisso
              inicial={{
                tipo: editando.compromisso.tipo,
                titulo: editando.ocorrencia.titulo,
                categoria: editando.compromisso.categoria,
                data: chaveDia(editando.ocorrencia.inicio, fusoPrincipal),
                horario: hora(editando.ocorrencia.inicio, fusoPrincipal),
                duracaoMin: editando.ocorrencia.duracaoMin,
                recorrencia: editando.compromisso.recorrencia,
              }}
              rotuloEnviar="Salvar"
              aoEnviar={async (v) => {
                const { compromisso: c, ocorrencia: o } = editando;
                const regraMudou = v.recorrencia !== c.recorrencia;
                if (c.recorrencia) {
                  setPendenteC({ compromisso: c, ocorrencia: o, acao: "alterar", mudanca: v, regraMudou });
                } else {
                  await gravarCompromisso(c, o, "todos", v);
                  setAviso({ texto: `${v.titulo}: salvo.` });
                  setCompromissoAberto(null);
                }
                setEditando(null);
              }}
              aoCancelar={() => setEditando(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <DialogoRecorrencia<Alcance>
        aberto={pendenteC !== null}
        titulo={pendenteC?.acao === "excluir" ? "Excluir evento recorrente" : "Alterar evento recorrente"}
        descricao={pendenteC?.ocorrencia.titulo}
        opcoes={[
          ...(pendenteC?.regraMudou ? [] : [{ valor: "este" as const, rotulo: "Este evento" }]),
          { valor: "seguintes" as const, rotulo: "Este e os seguintes" },
          { valor: "todos" as const, rotulo: "Todos os eventos" },
        ]}
        aoEscolher={responderAlcanceCompromisso}
        aoFechar={() => setPendenteC(null)}
      />

      <PainelSessao
        sessaoId={aberta}
        fusoPrincipal={fusoPrincipal}
        fusoSecundario={fusoSecundario}
        aoFechar={() => setAberta(null)}
        aoRemarcar={mover}
      />

      {aviso && !pendente && !pendenteC && (
        <div
          role="status"
          className="fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] z-50 mx-auto flex max-w-md items-center gap-3 rounded-xl border bg-popover px-4 py-3 text-sm shadow-lg"
        >
          <span className="min-w-0 flex-1">{aviso.texto}</span>
          {aviso.desfazer && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                aviso.desfazer?.();
                setAviso(null);
              }}
            >
              <Undo2 aria-hidden /> Desfazer
            </Button>
          )}
          <Button size="icon-sm" variant="ghost" aria-label="Fechar aviso" onClick={() => setAviso(null)}>
            <X aria-hidden />
          </Button>
        </div>
      )}
    </>
  );
}
