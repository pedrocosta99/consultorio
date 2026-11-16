import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeftRight, CalendarOff, Clock, Coins, Eye, RefreshCw, FlaskConical, HardDriveDownload, Landmark, Plus, RotateCcw, Trash2 } from "lucide-react";
import { formatarTaxa, lerTaxa, feriadoEntradaSchema, horarioAtendimentoSchema, HORARIO_ATENDIMENTO_PADRAO, TIPOS_CONTA, type Conta, type HorarioAtendimento, type Moeda } from "@consultorio/shared";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAvisos } from "@/app/avisos";
import { useDados } from "@/app/dados";
import { usePreferencias } from "@/app/preferencias";
import { api } from "@/lib/api";
import { fmt, noFuso } from "@/lib/datas";
import { Campo, DialogoConfirmacao, SeletorSimples } from "./campos";

const ROTULO_TIPO_CONTA: Record<Conta["tipo"], string> = {
  corrente: "Conta corrente",
  poupanca: "Poupança",
  cartao: "Cartão",
  dinheiro: "Dinheiro vivo",
};

export function SecaoFeriados() {
  const { feriados, mutar } = useDados();
  const { avisar, avisarErro } = useAvisos();
  const [data, setData] = useState("");
  const [descricao, setDescricao] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const adicionar = async (e: FormEvent) => {
    e.preventDefault();
    const r = feriadoEntradaSchema.safeParse({ data, descricao });
    if (!r.success) return setErro(r.error.issues[0]!.message);
    setErro(null);
    try {
      await mutar("POST", "/feriados", r.data);
      setData("");
      setDescricao("");
      avisar("Folga adicionada. As sessões geradas nesse dia saíram da agenda.");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não deu certo.");
    }
  };

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2 font-serif text-lg font-medium">
          <CalendarOff className="size-4 text-muted-foreground" aria-hidden /> Feriados e folgas
        </CardTitle>
        <CardDescription>Nesses dias a grade fixa não gera sessão.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form onSubmit={adicionar} className="grid items-end gap-3 sm:grid-cols-[10rem_1fr_auto]" noValidate>
          <Campo rotulo="Data">{(id) => <Input id={id} type="date" value={data} onChange={(e) => setData(e.target.value)} />}</Campo>
          <Campo rotulo="Descrição">{(id) => <Input id={id} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Natal, férias, congresso…" />}</Campo>
          <Button type="submit" variant="outline">
            <Plus aria-hidden /> Adicionar
          </Button>
        </form>
        {erro && (
          <p className="text-sm text-destructive" role="alert">
            {erro}
          </p>
        )}
        {feriados.length > 0 && (
          <ul className="divide-y rounded-lg border">
            {feriados.map((f) => (
              <li key={f.data} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="w-28 tabular">{fmt(new Date(f.data + "T12:00:00"), "dd/MM/yyyy")}</span>
                <span className="flex-1 text-muted-foreground">{f.descricao}</span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remover ${f.descricao}`}
                  onClick={() =>
                    mutar("DELETE", `/feriados/${f.data}`)
                      .then(() => avisar("Folga removida; a grade voltou a gerar sessões nesse dia."))
                      .catch(avisarErro)
                  }
                >
                  <Trash2 aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

const ROTULO_ACAO = { abriu_ficha: "Abriu a ficha", exportou_prontuario: "Exportou o prontuário (PDF)", buscou: "Buscou nas notas" } as const;

interface Acesso {
  em: string;
  acao: keyof typeof ROTULO_ACAO;
  pacienteId: string | null;
  usuario: string;
}

/** Quem abriu o quê e quando (só o dono vê). Não guarda conteúdo nem o termo buscado. */
export function SecaoRegistroAcesso() {
  const { paciente, nomeExibicao } = useDados();
  const { fusoPrincipal } = usePreferencias();
  const [lista, setLista] = useState<Acesso[] | null>(null);
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = async () => {
    setAberto(true);
    setErro(null);
    try {
      setLista(await api<Acesso[]>("GET", "/acessos"));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar.");
    }
  };

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2 font-serif text-lg font-medium">
          <Eye className="size-4 text-muted-foreground" aria-hidden /> Registro de acesso
        </CardTitle>
        <CardDescription>Quem abriu fichas, exportou prontuários ou buscou nas notas, e quando. Guarda só isso: nunca o conteúdo nem o termo buscado.</CardDescription>
      </CardHeader>
      <CardContent>
        {!aberto ? (
          <Button type="button" variant="outline" onClick={carregar}>
            Ver os últimos acessos
          </Button>
        ) : erro ? (
          <p className="text-sm text-destructive" role="alert">
            {erro}
          </p>
        ) : !lista ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : lista.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum acesso registrado ainda.</p>
        ) : (
          <ul className="max-h-80 divide-y overflow-y-auto rounded-lg border text-sm">
            {lista.map((a, i) => (
              <li key={i} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-3 py-2">
                <span className="w-32 shrink-0 text-muted-foreground tabular">{fmt(noFuso(a.em, fusoPrincipal), "dd/MM/yy HH:mm")}</span>
                <span className="min-w-0 flex-1">
                  {ROTULO_ACAO[a.acao]}
                  {a.pacienteId && <span className="font-medium"> · {nomeExibicao(paciente(a.pacienteId))}</span>}
                </span>
                <span className="text-xs text-muted-foreground">{a.usuario}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

const NOMES_DIAS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

/** Horário de atendimento por dia: fora dele a agenda fica sombreada. */
export function SecaoHorarioAtendimento() {
  const { horarioAtendimento, mutar } = useDados();
  const { avisar } = useAvisos();
  const [h, setH] = useState<HorarioAtendimento>(horarioAtendimento);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => setH(horarioAtendimento), [horarioAtendimento]);
  const mudou = JSON.stringify(h) !== JSON.stringify(horarioAtendimento);
  const mudar = (i: number, f: HorarioAtendimento[number]) => setH((x) => x.map((y, j) => (j === i ? f : y)));

  const salvar = async () => {
    setErro(null);
    const r = horarioAtendimentoSchema.safeParse(h);
    if (!r.success) return setErro(r.error.issues[0]!.message);
    try {
      await mutar("PUT", "/configuracoes/horario-atendimento", r.data);
      avisar("Horário de atendimento salvo.");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar.");
    }
  };

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2 font-serif text-lg font-medium">
          <Clock className="size-4 text-muted-foreground" aria-hidden /> Horário de atendimento
        </CardTitle>
        <CardDescription>Fora destes horários a agenda fica sombreada. Dá para marcar sessões mesmo assim.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ul className="divide-y">
          {NOMES_DIAS.map((nome, i) => {
            const f = h[i] ?? null;
            return (
              <li key={nome} className="flex flex-wrap items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <Switch
                  id={`atende-${i}`}
                  checked={f !== null}
                  onCheckedChange={(v) => mudar(i, v ? { inicio: "08:00", fim: "20:00" } : null)}
                  aria-label={`Atende ${nome.toLowerCase()}`}
                />
                <Label htmlFor={`atende-${i}`} className="w-20 text-sm font-medium">
                  {nome}
                </Label>
                {f ? (
                  <span className="flex items-center gap-2 text-sm">
                    <Input type="time" step={900} className="w-28" aria-label={`${nome}: início`} value={f.inicio} onChange={(e) => mudar(i, { ...f, inicio: e.target.value })} />
                    <span className="text-muted-foreground">até</span>
                    <Input type="time" step={900} className="w-28" aria-label={`${nome}: fim`} value={f.fim} onChange={(e) => mudar(i, { ...f, fim: e.target.value })} />
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground">Não atende</span>
                )}
              </li>
            );
          })}
        </ul>
        {erro && (
          <p className="text-sm text-destructive" role="alert">
            {erro}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => setH(HORARIO_ATENDIMENTO_PADRAO)}>
            <RotateCcw aria-hidden /> Padrão
          </Button>
          <Button type="button" disabled={!mudou} onClick={salvar}>
            Salvar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

const NOME_MOEDA: Record<Moeda, string> = { BRL: "Real (R$)", USD: "Dólar (US$)", EUR: "Euro (€)" };

/** Finanças numa moeda só (convertida) ou cada moeda à parte; e as cotações usadas. */
function ExibicaoECotacoes() {
  const { moedas, cotacoes, mutar } = useDados();
  const { moedaExibicao, atualizar } = usePreferencias();
  const { avisar, avisarErro } = useAvisos();
  const estrangeiras = moedas.filter((m): m is "USD" | "EUR" => m !== "BRL");
  const [buscando, setBuscando] = useState(false);
  const [moeda, setMoeda] = useState<"USD" | "EUR">(estrangeiras[0] ?? "USD");
  const [data, setData] = useState("");
  const [taxa, setTaxa] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  if (estrangeiras.length === 0) return null;

  const ultima = (m: Moeda) => [...cotacoes].reverse().find((c) => c.moeda === m);
  const buscar = async () => {
    setBuscando(true);
    try {
      const r = await mutar<{ ok: true; novas: number }>("POST", "/cotacoes/atualizar");
      avisar(r.novas ? `${r.novas} cotações novas do Banco Central.` : "As cotações já estavam em dia.");
    } catch (e) {
      avisarErro(e);
    } finally {
      setBuscando(false);
    }
  };
  const adicionar = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    const t = lerTaxa(taxa);
    if (!data) return setErro("Informe a data.");
    if (t === null) return setErro("Cotação inválida. Ex.: 5,4618");
    try {
      await mutar("POST", "/cotacoes", { data, moeda, taxa: t });
      avisar(`Cotação de ${moeda} em ${fmt(new Date(data + "T12:00:00"), "dd/MM/yyyy")} salva.`);
      setTaxa("");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível salvar.");
    }
  };

  return (
    <div className="flex flex-col gap-4 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Label htmlFor="moeda-exibicao" className="flex items-center gap-1.5 text-sm font-medium">
            <ArrowLeftRight className="size-3.5 text-muted-foreground" aria-hidden /> Em Finanças, mostrar
          </Label>
          <p className="mt-0.5 text-xs text-muted-foreground">Converter simplifica totais e gráficos. Cada lançamento continua gravado na moeda original.</p>
        </div>
        <SeletorSimples
          id="moeda-exibicao"
          className="w-56"
          valor={moedaExibicao}
          aoMudar={(v) => atualizar({ moedaExibicao: v })}
          opcoes={[["separada", "Cada moeda separada"], ...moedas.map((m) => [m, `Tudo em ${NOME_MOEDA[m]}`] as const)]}
        />
      </div>
      <div className="rounded-lg border p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">Cotações</p>
          <Button type="button" variant="outline" size="sm" onClick={buscar} disabled={buscando}>
            <RefreshCw aria-hidden className={buscando ? "animate-spin" : undefined} /> {buscando ? "Buscando…" : "Atualizar do Banco Central"}
          </Button>
        </div>
        <ul className="mt-2 flex flex-col gap-1 text-sm">
          {estrangeiras.map((m) => {
            const c = ultima(m);
            return (
              <li key={m} className="flex flex-wrap justify-between gap-2">
                <span>{NOME_MOEDA[m]}</span>
                <span className="text-muted-foreground tabular">
                  {c ? `R$ ${formatarTaxa(c.taxa)} · ${fmt(new Date(c.data + "T12:00:00"), "dd/MM/yyyy")} · ${c.fonte === "bcb" ? "PTAX" : "manual"}` : "sem cotação"}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">PTAX de fechamento. Só a moeda e o período saem do computador; nada do consultório.</p>
        <form onSubmit={adicionar} className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-[6rem_1fr_1fr_auto] sm:items-end" noValidate>
          <Campo rotulo="Moeda">{(id) => <SeletorSimples id={id} valor={moeda} aoMudar={setMoeda} opcoes={estrangeiras.map((m) => [m, m] as const)} />}</Campo>
          <Campo rotulo="Data">{(id) => <Input id={id} type="date" value={data} onChange={(e) => setData(e.target.value)} />}</Campo>
          <Campo rotulo="R$ por unidade">{(id) => <Input id={id} inputMode="decimal" placeholder="5,4618" value={taxa} onChange={(e) => setTaxa(e.target.value)} />}</Campo>
          <Button type="submit" variant="secondary">
            <Plus aria-hidden /> Manual
          </Button>
        </form>
        {erro && (
          <p className="mt-2 text-sm text-destructive" role="alert">
            {erro}
          </p>
        )}
      </div>
    </div>
  );
}

export function SecaoMoedas() {
  const { moedas, mutar } = useDados();
  const { avisar, avisarErro } = useAvisos();
  const alternar = (m: Moeda, ligar: boolean) =>
    mutar("PUT", "/configuracoes/moedas", { moedas: ligar ? [...moedas, m] : moedas.filter((x) => x !== m) })
      .then(() => avisar(ligar ? `${m} ligado. Já dá para criar contas e contratos em ${m}.` : `${m} desligado.`))
      .catch(avisarErro);
  return (
    <Card id="moedas">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2 font-serif text-lg font-medium">
          <Coins className="size-4 text-muted-foreground" aria-hidden /> Moedas
        </CardTitle>
        <CardDescription>O real é a moeda principal. Ligue dólar ou euro se tiver pacientes ou contas nessas moedas.</CardDescription>
      </CardHeader>
      <CardContent className="divide-y">
        {(
          [
            ["BRL", "Real (R$)", "Moeda principal, sempre ligada."],
            ["USD", "Dólar (US$)", "Mostra contas e valores em dólar."],
            ["EUR", "Euro (€)", "Mostra contas e valores em euro."],
          ] as const
        ).map(([m, rotulo, ajuda]) => (
          <div key={m} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
            <div>
              <Label htmlFor={`moeda-${m}`} className="text-sm font-medium">
                {rotulo}
              </Label>
              <p className="mt-0.5 text-xs text-muted-foreground">{ajuda}</p>
            </div>
            <Switch id={`moeda-${m}`} checked={moedas.includes(m)} disabled={m === "BRL"} onCheckedChange={(v) => alternar(m, v)} />
          </div>
        ))}
        <ExibicaoECotacoes />
      </CardContent>
    </Card>
  );
}

export function SecaoContas() {
  const { contas, mutar, moedas } = useDados();
  const { avisar } = useAvisos();
  const [nome, setNome] = useState("");
  const [instituicao, setInstituicao] = useState("");
  const [moeda, setMoeda] = useState<Moeda>("BRL");
  const [tipo, setTipo] = useState<Conta["tipo"]>("corrente");
  const [erro, setErro] = useState<string | null>(null);

  const adicionar = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    try {
      await mutar("POST", "/contas", { nome, instituicao, moeda, tipo, pais: moeda === "BRL" ? "BR" : moeda === "USD" ? "US" : "BE" });
      setNome("");
      setInstituicao("");
      avisar("Conta criada.");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não deu certo.");
    }
  };

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2 font-serif text-lg font-medium">
          <Landmark className="size-4 text-muted-foreground" aria-hidden /> Contas que recebem pagamentos
        </CardTitle>
        <CardDescription>Cada pagamento de paciente entra numa conta da mesma moeda.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ul className="divide-y rounded-lg border">
          {contas.map((c) => (
            <li key={c.id} className="flex items-center gap-3 px-3 py-2 text-sm">
              <span className="flex-1">
                {c.instituicao} · {c.nome}
              </span>
              <span className="text-xs text-muted-foreground">{ROTULO_TIPO_CONTA[c.tipo]}</span>
              <span className="w-10 text-right text-xs font-medium tabular">{c.moeda}</span>
            </li>
          ))}
        </ul>
        <form onSubmit={adicionar} className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_7rem_10rem_auto]" noValidate>
          <Campo rotulo="Nome">{(id) => <Input id={id} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Conta corrente" />}</Campo>
          <Campo rotulo="Instituição">{(id) => <Input id={id} value={instituicao} onChange={(e) => setInstituicao(e.target.value)} placeholder="Banco" />}</Campo>
          <Campo rotulo="Moeda">{(id) => <SeletorSimples id={id} valor={moeda} aoMudar={setMoeda} opcoes={moedas.map((m) => [m, m] as const)} />}</Campo>
          <Campo rotulo="Tipo">{(id) => <SeletorSimples id={id} valor={tipo} aoMudar={setTipo} opcoes={TIPOS_CONTA.map((t) => [t, ROTULO_TIPO_CONTA[t]] as const)} />}</Campo>
          <Button type="submit" variant="outline">
            <Plus aria-hidden /> Criar
          </Button>
        </form>
        {erro && (
          <p className="text-sm text-destructive" role="alert">
            {erro}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

interface InfoBackup {
  pasta: string;
  ultimo: string | null;
  snapshots: Array<{ arquivo: string; tamanho: number; criadoEm?: string; dispositivoId?: string; erro?: string }>;
}

export function SecaoBackup() {
  const { avisar } = useAvisos();
  const [info, setInfo] = useState<InfoBackup | null>(null);
  const [pasta, setPasta] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [restaurar, setRestaurar] = useState<string | null>(null);
  const [senhaRestaurar, setSenhaRestaurar] = useState("");

  const carregar = async (p?: string) => {
    try {
      const r = await api<InfoBackup>("GET", `/backup${p ? `?pasta=${encodeURIComponent(p)}` : ""}`);
      setInfo(r);
      if (!p) setPasta(r.pasta);
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não consegui ler a pasta.");
    }
  };
  useEffect(() => {
    void carregar();
  }, []);

  const exportar = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setErro(null);
    try {
      const r = await api<{ arquivo: string }>("POST", "/backup/exportar", { pasta, senha });
      setSenha("");
      avisar(`Backup salvo: ${r.arquivo}`);
      await carregar(pasta);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não deu certo.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2 font-serif text-lg font-medium">
          <HardDriveDownload className="size-4 text-muted-foreground" aria-hidden /> Backup cifrado
        </CardTitle>
        <CardDescription>
          Gera uma cópia cifrada do banco numa pasta (use a do Google Drive para Desktop). O banco em uso nunca fica na pasta sincronizada. Mantém os últimos 30.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form onSubmit={exportar} className="flex flex-col gap-3" noValidate>
          <Campo rotulo="Pasta" ajuda="Caminho completo. Ex.: ~/Library/CloudStorage/GoogleDrive-…/Meu Drive/Consultório">
            {(id, d) => (
              <div className="flex gap-2">
                <Input id={id} aria-describedby={d} value={pasta} onChange={(e) => setPasta(e.target.value)} placeholder="~/Google Drive/Consultório" />
                <Button type="button" variant="outline" onClick={() => carregar(pasta)} disabled={!pasta}>
                  Ver
                </Button>
              </div>
            )}
          </Campo>
          <Campo rotulo="Senha do backup" ajuda="Mínimo de 10 caracteres. O arquivo sai do computador, então vai cifrado. Guarde a senha fora do app: sem ela o backup não abre.">
            {(id, d) => <Input id={id} aria-describedby={d} type="password" autoComplete="off" value={senha} onChange={(e) => setSenha(e.target.value)} />}
          </Campo>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={enviando || !pasta || senha.length < 10}>
              <HardDriveDownload aria-hidden /> {enviando ? "Gerando…" : "Exportar agora"}
            </Button>
            {info?.ultimo && <span className="text-xs text-muted-foreground">Último: {fmt(new Date(info.ultimo), "dd/MM/yyyy 'às' HH:mm")}</span>}
          </div>
        </form>
        {erro && (
          <p className="text-sm text-destructive" role="alert">
            {erro}
          </p>
        )}
        {info && info.snapshots.length > 0 && (
          <ul className="max-h-64 divide-y overflow-y-auto rounded-lg border">
            {info.snapshots.map((s) => (
              <li key={s.arquivo} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{s.criadoEm ? fmt(new Date(s.criadoEm), "dd/MM/yyyy HH:mm") : s.arquivo}</span>
                  <span className="text-xs text-muted-foreground">{s.erro ?? `${(s.tamanho / 1024).toFixed(0)} KB · dispositivo ${s.dispositivoId}`}</span>
                </span>
                {!s.erro && (
                  <Button variant="ghost" size="sm" onClick={() => setRestaurar(s.arquivo)}>
                    <RotateCcw aria-hidden /> Restaurar
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <DialogoConfirmacao
        aberto={restaurar !== null}
        aoFechar={() => {
          setRestaurar(null);
          setSenhaRestaurar("");
        }}
        titulo="Restaurar backup"
        rotuloConfirmar="Restaurar"
        destrutivo
        descricao={
          <div className="flex flex-col gap-3">
            <p>
              O banco atual é substituído por este backup. Antes disso, uma cópia do atual fica em <code className="text-xs">data/backups/</code>.
            </p>
            <Campo rotulo="Senha do backup">
              {(id) => <Input id={id} type="password" autoComplete="off" value={senhaRestaurar} onChange={(e) => setSenhaRestaurar(e.target.value)} />}
            </Campo>
          </div>
        }
        aoConfirmar={async () => {
          await api("POST", "/backup/importar", { pasta, arquivo: restaurar, senha: senhaRestaurar });
          window.location.reload();
        }}
      />
    </Card>
  );
}

/** Só aparece com o banco vazio: preenche com os pacientes fictícios para testar o app. */
export function SecaoFicticios() {
  const { pacientes, arquivados, mutar } = useDados();
  const { avisar, avisarErro } = useAvisos();
  const [enviando, setEnviando] = useState(false);
  if (pacientes.length + arquivados.length > 0) return null;
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2 font-serif text-lg font-medium">
          <FlaskConical className="size-4 text-muted-foreground" aria-hidden /> Dados fictícios
        </CardTitle>
        <CardDescription>O banco está vazio. Para experimentar o app, carregue pacientes, sessões, pagamentos e notas inventados.</CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          variant="outline"
          disabled={enviando}
          onClick={() => {
            setEnviando(true);
            mutar("POST", "/dados-ficticios")
              .then(() => avisar("Dados fictícios carregados."))
              .catch(avisarErro)
              .finally(() => setEnviando(false));
          }}
        >
          <FlaskConical aria-hidden /> Carregar dados fictícios
        </Button>
      </CardContent>
    </Card>
  );
}
