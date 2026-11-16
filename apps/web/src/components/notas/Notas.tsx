/**
 * Notas clínicas na ficha do paciente: escrever (com salvamento automático),
 * editar, apagar e filtrar. Texto em markdown simples.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { Bold, Bookmark, BookmarkCheck, Check, FileText, Heading, Italic, List, NotebookPen, Pencil, Pin, Plus, Trash2 } from "lucide-react";
import { ROTULO_ESTADO, type Nota, type Paciente } from "@consultorio/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useAvisos } from "@/app/avisos";
import { useDados } from "@/app/dados";
import { usePreferencias } from "@/app/preferencias";
import { EstadoVazio } from "@/components/comuns";
import { DialogoConfirmacao, SeletorSimples } from "@/components/formularios/campos";
import { capitalizar, fmt, hora, noFuso } from "@/lib/datas";
import { Markdown } from "@/lib/markdown";
import { DiscussaoSupervisao } from "./DiscussaoSupervisao";
import { cn } from "@/lib/utils";
import { ErroApi } from "@/lib/api";

type Natureza = Nota["natureza"];
type Situacao = "ocioso" | "salvando" | "salvo" | "erro";

/** Aplica formatação markdown na seleção do textarea e devolve o novo texto + seleção. */
function formatar(el: HTMLTextAreaElement, tipo: "negrito" | "italico" | "lista" | "titulo"): { texto: string; ini: number; fim: number } {
  const { value: v, selectionStart: a, selectionEnd: b } = el;
  if (tipo === "negrito" || tipo === "italico") {
    const m = tipo === "negrito" ? "**" : "*";
    const sel = v.slice(a, b) || (tipo === "negrito" ? "negrito" : "itálico");
    return { texto: v.slice(0, a) + m + sel + m + v.slice(b), ini: a + m.length, fim: a + m.length + sel.length };
  }
  // Por linha: do começo da primeira linha selecionada ao fim da última.
  const ini = v.lastIndexOf("\n", a - 1) + 1;
  const fimLinha = v.indexOf("\n", b);
  const fim = fimLinha === -1 ? v.length : fimLinha;
  const prefixo = tipo === "lista" ? "- " : "## ";
  const linhas = v.slice(ini, fim).split("\n");
  const todas = linhas.every((l) => l.startsWith(prefixo));
  const novo = linhas.map((l) => (todas ? l.slice(prefixo.length) : prefixo + l)).join("\n");
  return { texto: v.slice(0, ini) + novo + v.slice(fim), ini, fim: ini + novo.length };
}

const lerTags = (t: string) =>
  [...new Set(t.split(/[,\s]+/).map((x) => x.replace(/^#/, "").trim().toLowerCase()).filter(Boolean))].slice(0, 20);

/** Editor com salvamento automático: a nota nasce no banco na primeira pausa de digitação. */
export function EditorNota({
  paciente,
  nota,
  sessaoInicial,
  aoTerminar,
}: {
  paciente: Paciente;
  nota?: Nota;
  sessaoInicial?: string | null;
  aoTerminar: () => void;
}) {
  const { sessoes, mutar, mensagens } = useDados();
  const { fusoPrincipal } = usePreferencias();
  const [texto, setTexto] = useState(nota?.texto ?? "");
  const [tags, setTags] = useState(nota?.tags.join(", ") ?? "");
  const [natureza, setNatureza] = useState<Natureza>(nota?.natureza ?? "documental");
  const [supervisao, setSupervisao] = useState(nota?.levarSupervisao ?? false);
  const [discussao, setDiscussao] = useState(nota?.supervisaoTexto ?? "");
  const [sessaoId, setSessaoId] = useState<string>(() => {
    if (nota) return nota.sessaoId ?? "";
    if (sessaoInicial) return sessaoInicial;
    // Padrão: a sessão mais recente que já começou (normalmente a de hoje).
    const agora = Date.now() + 15 * 60_000;
    return sessoes.filter((s) => s.pacienteId === paciente.id && Date.parse(s.inicio) <= agora).sort((a, b) => b.inicio.localeCompare(a.inicio))[0]?.id ?? "";
  });
  const [situacao, setSituacao] = useState<Situacao>("ocioso");
  const [erro, setErro] = useState<string | null>(null);
  const id = useRef<string | null>(nota?.id ?? null);
  // Versão que esta tela conhece; a API recusa (409) se a nota mudou em outro lugar.
  const versao = useRef<string | undefined>(nota?.atualizadoEm);
  const [conflito, setConflito] = useState(false);
  const salvando = useRef<Promise<void> | null>(null);
  const primeira = useRef(true);
  const area = useRef<HTMLTextAreaElement>(null);

  const opcoesSessao = useMemo(() => {
    const limite = Date.now() + 36 * 3600_000;
    const lista = sessoes
      .filter((s) => s.pacienteId === paciente.id && Date.parse(s.inicio) <= limite)
      .sort((a, b) => b.inicio.localeCompare(a.inicio))
      .slice(0, 30);
    return [
      ["", "Sem sessão (nota geral)"] as const,
      ...lista.map((s) => [s.id, `${capitalizar(fmt(noFuso(s.inicio, fusoPrincipal), "EEE, d MMM"))} ${hora(s.inicio, fusoPrincipal)} · ${ROTULO_ESTADO[s.estado]}`] as const),
    ];
  }, [sessoes, paciente.id, fusoPrincipal]);

  const salvar = useCallback(
    async (forcar = false) => {
      if (!texto.trim()) return;
      if (conflito && !forcar) return; // espera a pessoa decidir
      const corpo = { texto, tags: lerTags(tags), natureza, levarSupervisao: supervisao, sessaoId: sessaoId || null, ...(supervisao ? { supervisaoTexto: discussao } : {}) };
      setSituacao("salvando");
      try {
        if (id.current) {
          const r = await mutar<{ ok: true; atualizadoEm: string }>("PATCH", `/notas/${id.current}`, { ...corpo, ...(forcar ? {} : { versao: versao.current }) });
          versao.current = r.atualizadoEm;
        } else {
          const r = await mutar<{ ok: true; id: string; atualizadoEm: string }>("POST", "/notas", { ...corpo, pacienteId: paciente.id });
          id.current = r.id;
          versao.current = r.atualizadoEm;
        }
        setConflito(false);
        setSituacao("salvo");
        setErro(null);
      } catch (e) {
        setSituacao("erro");
        setConflito(e instanceof ErroApi && e.status === 409);
        setErro(e instanceof Error ? e.message : "Não salvou.");
      }
    },
    [texto, tags, natureza, supervisao, discussao, sessaoId, mutar, paciente.id, conflito],
  );

  // Salvamento automático 900 ms depois da última mudança.
  useEffect(() => {
    if (primeira.current) {
      primeira.current = false;
      return;
    }
    const t = window.setTimeout(() => {
      salvando.current = salvar();
    }, 900);
    return () => window.clearTimeout(t);
  }, [salvar]);

  useEffect(() => {
    area.current?.focus();
  }, []);

  // Altura acompanha o texto.
  useEffect(() => {
    const el = area.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.max(140, el.scrollHeight)}px`;
    }
  }, [texto]);

  const aplicar = (tipo: Parameters<typeof formatar>[1]) => {
    const el = area.current;
    if (!el) return;
    const r = formatar(el, tipo);
    setTexto(r.texto);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(r.ini, r.fim);
    });
  };

  const inserirModelo = () => {
    const modelo = mensagens.modeloNota;
    const novo = texto.trim() ? `${texto.replace(/\s+$/, "")}\n\n${modelo}` : modelo;
    setTexto(novo);
    requestAnimationFrame(() => {
      const el = area.current;
      if (!el) return;
      el.focus();
      // Cursor no fim do primeiro item do modelo.
      const pos = novo.length - modelo.length + (modelo.indexOf("\n") === -1 ? modelo.length : modelo.indexOf("\n"));
      el.setSelectionRange(pos, pos);
    });
  };

  const concluir = async () => {
    await salvando.current;
    if (texto.trim()) await salvar();
    aoTerminar();
  };

  return (
    <Card className="gap-3 p-4 shadow-none ring-1 ring-primary/20">
      <label htmlFor="texto-nota" className="sr-only">
        Texto da nota
      </label>
      <div className="-mb-1 flex flex-wrap items-center gap-0.5" role="toolbar" aria-label="Formatação" aria-controls="texto-nota">
        {(
          [
            ["negrito", Bold, "Negrito (Cmd+B)"],
            ["italico", Italic, "Itálico (Cmd+I)"],
            ["titulo", Heading, "Título"],
            ["lista", List, "Lista"],
          ] as const
        ).map(([tipo, Icone, rotulo]) => (
          <Button key={tipo} type="button" variant="ghost" size="icon-sm" aria-label={rotulo} title={rotulo} onClick={() => aplicar(tipo)}>
            <Icone aria-hidden />
          </Button>
        ))}
        {natureza === "documental" && mensagens.modeloNota.trim() && (
          <Button type="button" variant="ghost" size="sm" className="ml-auto h-8 text-muted-foreground" onClick={inserirModelo} title="Itens do registro documental (CFP 001/2009). Edite o modelo em Configurações.">
            <FileText aria-hidden /> Usar modelo
          </Button>
        )}
      </div>
      <textarea
        id="texto-nota"
        ref={area}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            void concluir();
          } else if ((e.metaKey || e.ctrlKey) && (e.key === "b" || e.key === "i")) {
            e.preventDefault();
            aplicar(e.key === "b" ? "negrito" : "italico");
          }
        }}
        placeholder={"Escreva aqui como quiser. Os botões acima formatam o texto.\nCmd+Enter conclui."}
        className="w-full resize-none rounded-md border bg-transparent px-3 py-2 text-sm leading-relaxed outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nota-sessao" className="text-xs">
            Sessão
          </Label>
          <SeletorSimples id="nota-sessao" valor={sessaoId} aoMudar={setSessaoId} opcoes={opcoesSessao} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nota-tags" className="text-xs">
            Tags
          </Label>
          <Input id="nota-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="sonho, lapso, dinheiro" autoComplete="off" />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={natureza}
          onValueChange={(v) => v && setNatureza(v as Natureza)}
          aria-label="Natureza da nota"
        >
          <ToggleGroupItem value="documental" className="px-3">
            Registro documental
          </ToggleGroupItem>
          <ToggleGroupItem value="pessoal" className="px-3">
            Anotação pessoal
          </ToggleGroupItem>
        </ToggleGroup>
        <div className="flex items-center gap-2">
          <Switch id="nota-supervisao" checked={supervisao} onCheckedChange={setSupervisao} />
          <Label htmlFor="nota-supervisao" className="text-sm">
            Levar para supervisão
          </Label>
        </div>
        {supervisao && (
          <div className="flex w-full flex-col gap-1.5">
            <Label htmlFor="nota-discussao" className="text-xs">
              Discutido em supervisão <span className="font-normal text-muted-foreground">(preencha depois da supervisão)</span>
            </Label>
            <textarea
              id="nota-discussao"
              value={discussao}
              onChange={(e) => setDiscussao(e.target.value)}
              rows={2}
              placeholder="O que a supervisão apontou, hipóteses, próximos passos…"
              className="w-full resize-y rounded-md border bg-transparent px-3 py-2 text-sm leading-relaxed outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
          </div>
        )}
        <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
          <span className={cn("text-xs text-muted-foreground", situacao === "erro" && "text-destructive")} role="status">
            {situacao === "salvando" ? "Salvando…" : situacao === "salvo" ? "Salvo" : situacao === "erro" ? erro : ""}
          </span>
          {conflito && (
            <Button size="sm" variant="outline" onClick={() => void salvar(true)} title="Substitui a versão salva pelo que está nesta tela">
              Salvar mesmo assim
            </Button>
          )}
          <Button size="sm" onClick={() => void concluir()}>
            <Check aria-hidden /> Concluir
          </Button>
        </div>
      </div>
    </Card>
  );
}

function CartaoNota({ nota: n, paciente, destacada }: { nota: Nota; paciente: Paciente; destacada: boolean }) {
  const { sessoes, mutar } = useDados();
  const { fusoPrincipal } = usePreferencias();
  const { avisar } = useAvisos();
  const [editando, setEditando] = useState(false);
  const [apagar, setApagar] = useState(false);
  const ref = useRef<HTMLLIElement>(null);
  const sessao = n.sessaoId ? sessoes.find((s) => s.id === n.sessaoId) : undefined;
  const quando = sessao?.inicio ?? n.criadoEm;

  useEffect(() => {
    if (destacada) ref.current?.scrollIntoView({ block: "center" });
  }, [destacada]);

  return (
    <li ref={ref} id={`nota-${n.id}`} className="relative pb-6 last:pb-0">
      <span className="absolute top-1.5 -left-[29px] size-2.5 rounded-full border-2 border-background bg-primary" aria-hidden />
      <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{capitalizar(fmt(noFuso(quando, fusoPrincipal), "EEEE, d 'de' MMMM"))}</span>
        {!sessao && <span>· nota geral</span>}
        <Badge variant="outline" className="font-normal">
          {n.natureza === "documental" ? "Registro documental" : "Anotação pessoal"}
        </Badge>
        {n.levarSupervisao && (
          <Badge variant="secondary" className="font-normal">
            {n.supervisaoEm ? (
              <>
                <BookmarkCheck aria-hidden /> Discutida em supervisão
              </>
            ) : (
              <>
                <Bookmark aria-hidden /> Supervisão
              </>
            )}
          </Badge>
        )}
        {n.tags.map((t) => (
          <span key={t}>#{t}</span>
        ))}
        {!editando && (
          <span className="ml-auto flex gap-1">
            <Button variant="ghost" size="icon-xs" aria-label="Editar nota" onClick={() => setEditando(true)}>
              <Pencil aria-hidden />
            </Button>
            <Button variant="ghost" size="icon-xs" aria-label="Apagar nota" onClick={() => setApagar(true)}>
              <Trash2 aria-hidden />
            </Button>
          </span>
        )}
      </div>
      {editando ? (
        <EditorNota paciente={paciente} nota={n} aoTerminar={() => setEditando(false)} />
      ) : (
        <>
          <Card className={cn("px-4 py-3 text-sm leading-relaxed shadow-none", destacada && "ring-2 ring-primary/40")}>
            <Markdown texto={n.texto} />
          </Card>
          {n.levarSupervisao && <DiscussaoSupervisao nota={n} className="mt-2" />}
        </>
      )}
      <DialogoConfirmacao
        aberto={apagar}
        aoFechar={() => setApagar(false)}
        titulo="Apagar nota"
        rotuloConfirmar="Apagar"
        destrutivo
        descricao="A nota sai do prontuário e da busca. Não dá para desfazer (só restaurando um backup)."
        aoConfirmar={async () => {
          await mutar("DELETE", `/notas/${n.id}`);
          avisar("Nota apagada.");
        }}
      />
    </li>
  );
}

type Filtro = "todas" | "documental" | "pessoal" | "supervisao";

export function AbaNotas({ paciente: p }: { paciente: Paciente }) {
  const { notas } = useDados();
  const [params, setParams] = useSearchParams();
  const sessaoParam = params.get("sessao");
  const notaParam = params.get("nota");
  const [escrevendo, setEscrevendo] = useState(!!sessaoParam);
  const [filtro, setFiltro] = useState<Filtro>("todas");

  const doPaciente = notas.filter((n) => n.pacienteId === p.id);
  const lista = doPaciente
    .filter((n) => filtro === "todas" || (filtro === "supervisao" ? n.levarSupervisao : n.natureza === filtro))
    .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));

  const terminar = () => {
    setEscrevendo(false);
    if (sessaoParam)
      setParams(
        (prm) => {
          prm.delete("sessao");
          return prm;
        },
        { replace: true },
      );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {!escrevendo && (
          <Button size="sm" onClick={() => setEscrevendo(true)}>
            <Plus aria-hidden /> Nova nota
          </Button>
        )}
        {doPaciente.length > 0 && (
          <ToggleGroup type="single" size="sm" value={filtro} onValueChange={(v) => v && setFiltro(v as Filtro)} aria-label="Filtrar notas" className="ml-auto">
            <ToggleGroupItem value="todas" className="px-2.5">
              Todas
            </ToggleGroupItem>
            <ToggleGroupItem value="documental" className="px-2.5">
              Documentais
            </ToggleGroupItem>
            <ToggleGroupItem value="pessoal" className="px-2.5">
              Pessoais
            </ToggleGroupItem>
            <ToggleGroupItem value="supervisao" className="px-2.5">
              Supervisão
            </ToggleGroupItem>
          </ToggleGroup>
        )}
      </div>

      {escrevendo && <EditorNota paciente={p} sessaoInicial={sessaoParam} aoTerminar={terminar} />}

      {doPaciente.length === 0 && !escrevendo ? (
        <Card className="py-0">
          <EstadoVazio
            icone={NotebookPen}
            titulo="Nenhuma nota"
            descricao="Notas de sessão, sonhos, hipóteses. Ficam só neste computador e entram na busca (Cmd+K)."
            acao={
              <Button onClick={() => setEscrevendo(true)}>
                <Plus aria-hidden /> Escrever a primeira
              </Button>
            }
          />
        </Card>
      ) : lista.length === 0 ? (
        doPaciente.length > 0 && <p className="text-sm text-muted-foreground">Nenhuma nota com esse filtro.</p>
      ) : (
        <ol className="relative ml-2 border-l pl-6">
          {lista.map((n) => (
            <CartaoNota key={n.id} nota={n} paciente={p} destacada={n.id === notaParam} />
          ))}
        </ol>
      )}
    </div>
  );
}

/** Bloco "Pontos fixos": sempre visível no topo da ficha, editável no lugar, salva sozinho. */
export function PontosFixos({ paciente: p }: { paciente: Paciente }) {
  const { mutar } = useDados();
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(p.pontosFixos);
  const [situacao, setSituacao] = useState<Situacao>("ocioso");
  const [expandido, setExpandido] = useState(false);
  const longo = p.pontosFixos.length > 320;
  const area = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!editando) setTexto(p.pontosFixos);
  }, [p.pontosFixos, editando]);

  useEffect(() => {
    if (!editando || texto === p.pontosFixos) return;
    const t = window.setTimeout(() => {
      setSituacao("salvando");
      mutar("PATCH", `/pacientes/${p.id}`, { pontosFixos: texto })
        .then(() => setSituacao("salvo"))
        .catch(() => setSituacao("erro"));
    }, 900);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto, editando]);

  useEffect(() => {
    const el = area.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.max(120, el.scrollHeight)}px`;
    }
  }, [texto, editando]);

  return (
    <Card className="gap-3 border-[var(--st-falta-bd)]/50 bg-[var(--st-falta-bg)]/40 px-5 py-4">
      <div className="flex items-center gap-2">
        <h2 className="flex items-center gap-2 font-serif text-lg font-medium">
          <Pin className="size-4" aria-hidden /> Pontos fixos
        </h2>
        <span className="hidden text-xs text-muted-foreground sm:inline">o que lembrar sempre</span>
        <span className={cn("ml-auto text-xs text-muted-foreground", situacao === "erro" && "text-destructive")} role="status">
          {editando && (situacao === "salvando" ? "Salvando…" : situacao === "salvo" ? "Salvo" : situacao === "erro" ? "Não salvou" : "")}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7"
          onClick={() => {
            setEditando((v) => !v);
            setSituacao("ocioso");
            if (!editando) setTimeout(() => area.current?.focus(), 0);
          }}
        >
          {editando ? (
            <>
              <Check aria-hidden /> Pronto
            </>
          ) : (
            <>
              <Pencil aria-hidden /> Editar
            </>
          )}
        </Button>
      </div>
      {editando ? (
        <>
          <label htmlFor="pontos-fixos" className="sr-only">
            Pontos fixos
          </label>
          <textarea
            id="pontos-fixos"
            ref={area}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="História, temas recorrentes, sonhos, hipóteses, cuidados…"
            className="w-full resize-none rounded-md border bg-card px-3 py-2 text-sm leading-relaxed outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
        </>
      ) : p.pontosFixos ? (
        <div>
          <div className={cn("relative", longo && !expandido && "max-h-32 overflow-hidden")}>
            <Markdown texto={p.pontosFixos} className="flex flex-col gap-1.5 text-sm leading-relaxed" />
            {longo && !expandido && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[color-mix(in_oklab,var(--st-falta-bg)_40%,var(--card))]" aria-hidden />}
          </div>
          {longo && (
            <Button variant="link" size="sm" className="mt-1 h-auto px-0 text-xs" aria-expanded={expandido} onClick={() => setExpandido((v) => !v)}>
              {expandido ? "Mostrar menos" : "Mostrar tudo"}
            </Button>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Nada registrado ainda. Aqui fica o que vale ter sempre à vista antes de cada sessão: história, temas recorrentes, sonhos, hipóteses, cuidados.</p>
      )}
    </Card>
  );
}
