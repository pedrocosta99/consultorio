import { useEffect, useState, type FormEvent } from "react";
import { CalendarOff, Coins, HardDriveDownload, Landmark, Plus, RotateCcw, Trash2 } from "lucide-react";
import { feriadoEntradaSchema, TIPOS_CONTA, type Conta, type Moeda } from "@consultorio/shared";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAvisos } from "@/app/avisos";
import { useDados } from "@/app/dados";
import { api } from "@/lib/api";
import { fmt } from "@/lib/datas";
import { Campo, DialogoConfirmacao, SeletorSimples } from "./campos";

const ROTULO_TIPO_CONTA: Record<Conta["tipo"], string> = {
  corrente: "Conta corrente",
  poupanca: "Poupança",
  cartao: "Cartão",
  investimento: "Investimentos",
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

export function SecaoMoedas() {
  const { moedas, mutar } = useDados();
  const { avisar, avisarErro } = useAvisos();
  const alternar = (m: Moeda, ligar: boolean) =>
    mutar("PUT", "/configuracoes/moedas", { moedas: ligar ? [...moedas, m] : moedas.filter((x) => x !== m) })
      .then(() => avisar(ligar ? `${m} ligado. Já dá para criar contas e contratos em ${m}.` : `${m} desligado.`))
      .catch(avisarErro);
  return (
    <Card>
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
        <CardDescription>Cada pagamento de paciente entra numa conta da mesma moeda. A gestão completa de contas vem com Finanças (Fase 3).</CardDescription>
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
  const [pinRestaurar, setPinRestaurar] = useState("");

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
          <Campo rotulo="Senha do backup" ajuda="Mínimo de 10 caracteres. É separada do PIN porque o arquivo sai da máquina; um PIN de 6 dígitos seria fácil de quebrar. Guarde-a fora do app.">
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
          setPinRestaurar("");
        }}
        titulo="Restaurar backup"
        rotuloConfirmar="Restaurar"
        destrutivo
        descricao={
          <div className="flex flex-col gap-3">
            <p>
              O banco atual é substituído por este backup. Antes disso, uma cópia (cifrada) do atual fica em <code className="text-xs">data/backups/</code>. Depois,
              entre com o PIN do backup.
            </p>
            <Campo rotulo="Senha do backup">
              {(id) => <Input id={id} type="password" autoComplete="off" value={senhaRestaurar} onChange={(e) => setSenhaRestaurar(e.target.value)} />}
            </Campo>
            <Campo rotulo="PIN de quando o backup foi feito" ajuda="O banco dentro do backup também é cifrado com o PIN.">
              {(id, d) => (
                <Input
                  id={id}
                  aria-describedby={d}
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  autoComplete="off"
                  value={pinRestaurar}
                  onChange={(e) => setPinRestaurar(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="w-32 font-mono tracking-widest"
                />
              )}
            </Campo>
          </div>
        }
        aoConfirmar={async () => {
          await api("POST", "/backup/importar", { pasta, arquivo: restaurar, senha: senhaRestaurar, pin: pinRestaurar });
          window.location.reload();
        }}
      />
    </Card>
  );
}
