/**
 * Porta de entrada: senha ao abrir o app e bloqueio após 15 min sem uso.
 * Enquanto bloqueado, nada do consultório é carregado (a API também recusa).
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Eye, EyeOff, Leaf, LockKeyhole } from "lucide-react";
import { pinSchema, type EstadoAuth } from "@consultorio/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { api, ErroApi, EVENTO_BLOQUEIO } from "@/lib/api";

interface Ctx {
  bloquear: () => void;
}
const AcessoCtx = createContext<Ctx | null>(null);

type Situacao = { tipo: "verificando" } | { tipo: "erro"; mensagem: string } | { tipo: "bloqueado"; configurado: boolean } | { tipo: "liberado" };

const EVENTOS_ATIVIDADE = ["pointerdown", "keydown", "wheel", "touchstart", "mousemove"] as const;

export function AcessoProvider({ children }: { children: ReactNode }) {
  const [situacao, setSituacao] = useState<Situacao>({ tipo: "verificando" });
  const [inatividadeMs, setInatividadeMs] = useState(15 * 60_000);
  const ultimaAtividade = useRef(Date.now());
  const ultimoManter = useRef(Date.now());

  const verificar = useCallback(async () => {
    try {
      const e = await api<EstadoAuth & { inatividadeMin: number }>("GET", "/auth/estado");
      setInatividadeMs(e.inatividadeMin * 60_000);
      setSituacao(e.desbloqueado && e.sessaoValida ? { tipo: "liberado" } : { tipo: "bloqueado", configurado: e.configurado });
    } catch (e) {
      if (e instanceof ErroApi && e.status === 401) setSituacao({ tipo: "bloqueado", configurado: true });
      else setSituacao({ tipo: "erro", mensagem: e instanceof Error ? e.message : "Erro ao abrir" });
    }
  }, []);

  useEffect(() => {
    void verificar();
  }, [verificar]);

  const bloquear = useCallback(() => {
    api("POST", "/auth/bloquear").catch(() => {});
    setSituacao({ tipo: "bloqueado", configurado: true });
  }, []);

  // 401 em qualquer chamada → tela de senha.
  useEffect(() => {
    const aoBloquear = () => setSituacao((s) => (s.tipo === "liberado" ? { tipo: "bloqueado", configurado: true } : s));
    window.addEventListener(EVENTO_BLOQUEIO, aoBloquear);
    return () => window.removeEventListener(EVENTO_BLOQUEIO, aoBloquear);
  }, []);

  // Inatividade: sem mexer por 15 min → bloqueia. Mexendo, mantém a sessão da API viva.
  useEffect(() => {
    if (situacao.tipo !== "liberado") return;
    ultimaAtividade.current = Date.now();
    const marcar = () => {
      ultimaAtividade.current = Date.now();
      if (Date.now() - ultimoManter.current > 2 * 60_000) {
        ultimoManter.current = Date.now();
        api("POST", "/sessao/manter").catch(() => {});
      }
    };
    for (const ev of EVENTOS_ATIVIDADE) window.addEventListener(ev, marcar, { passive: true });
    const t = window.setInterval(() => {
      if (Date.now() - ultimaAtividade.current > inatividadeMs) bloquear();
    }, 15_000);
    return () => {
      for (const ev of EVENTOS_ATIVIDADE) window.removeEventListener(ev, marcar);
      window.clearInterval(t);
    };
  }, [situacao.tipo, inatividadeMs, bloquear]);

  if (situacao.tipo === "liberado") return <AcessoCtx.Provider value={{ bloquear }}>{children}</AcessoCtx.Provider>;
  return (
    <TelaAcesso
      situacao={situacao}
      aoEntrar={() => {
        ultimoManter.current = Date.now();
        setSituacao({ tipo: "liberado" });
      }}
      aoTentarDeNovo={verificar}
    />
  );
}

export function useAcesso(): Ctx {
  const ctx = useContext(AcessoCtx);
  if (!ctx) throw new Error("useAcesso fora do AcessoProvider");
  return ctx;
}

function CampoPin({ id, rotulo, valor, aoMudar, autoFocus, aoCompletar }: { id: string; rotulo: string; valor: string; aoMudar: (v: string) => void; autoFocus?: boolean; aoCompletar?: (pin: string) => void }) {
  const [ver, setVer] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{rotulo}</Label>
      <div className="relative">
        <Input
          id={id}
          type={ver ? "text" : "password"}
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          autoComplete="off"
          value={valor}
          autoFocus={autoFocus}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "").slice(0, 6);
            aoMudar(v);
            if (v.length === 6) aoCompletar?.(v);
          }}
          className="h-12 pr-10 text-center font-mono text-2xl tracking-[0.6em]"
        />
        <button
          type="button"
          onClick={() => setVer((v) => !v)}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
          aria-label={ver ? "Esconder PIN" : "Mostrar PIN"}
        >
          {ver ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
        </button>
      </div>
    </div>
  );
}

function TelaAcesso({ situacao, aoEntrar, aoTentarDeNovo }: { situacao: Exclude<Situacao, { tipo: "liberado" }>; aoEntrar: () => void; aoTentarDeNovo: () => void }) {
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [ficticio, setFicticio] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const novo = situacao.tipo === "bloqueado" && !situacao.configurado;

  const enviar = async (e?: FormEvent, pin = senha) => {
    e?.preventDefault();
    setErro(null);
    if (novo) {
      const r = pinSchema.safeParse(pin);
      if (!r.success) return setErro(r.error.issues[0]!.message);
      if (pin !== confirmar) return setErro("Os PINs não conferem.");
    }
    setEnviando(true);
    try {
      await api("POST", novo ? "/auth/configurar" : "/auth/desbloquear", novo ? { senha: pin, ficticio } : { senha: pin });
      aoEntrar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível entrar.");
      setConfirmar("");
      setSenha("");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Leaf className="size-6" aria-hidden />
          </span>
          <h1 className="font-serif text-3xl font-medium">Consultório</h1>
        </div>

        {situacao.tipo === "verificando" ? (
          <p className="text-center text-sm text-muted-foreground" role="status">
            Abrindo…
          </p>
        ) : situacao.tipo === "erro" ? (
          <div className="flex flex-col items-center gap-4 rounded-xl border bg-card p-6 text-center" role="alert">
            <p className="text-sm">{situacao.mensagem}</p>
            <Button variant="outline" onClick={aoTentarDeNovo}>
              Tentar de novo
            </Button>
          </div>
        ) : (
          <form onSubmit={enviar} className="flex flex-col gap-4 rounded-xl border bg-card p-6 shadow-xs">
            <div>
              <h2 className="flex items-center gap-2 font-sans text-base font-semibold tracking-normal">
                <LockKeyhole className="size-4 text-muted-foreground" aria-hidden />
                {novo ? "Crie um PIN de 6 dígitos" : "Digite seu PIN"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {novo
                  ? "Ele abre o app neste computador. Guarde-o fora do app: sem ele não há como abrir os dados."
                  : "O app foi bloqueado por segurança."}
              </p>
            </div>

            <CampoPin id="senha" rotulo="PIN" valor={senha} aoMudar={setSenha} autoFocus aoCompletar={novo ? undefined : (pin) => void enviar(undefined, pin)} />
            {novo && <CampoPin id="confirmar" rotulo="Confirme o PIN" valor={confirmar} aoMudar={setConfirmar} />}

            {novo && (
              <div className="flex items-start justify-between gap-3 rounded-lg bg-muted/60 p-3">
                <div>
                  <Label htmlFor="ficticio" className="text-sm">
                    Começar com dados fictícios
                  </Label>
                  <p className="mt-0.5 text-xs text-muted-foreground">Para testar. Deixe desligado para começar vazio.</p>
                </div>
                <Switch id="ficticio" checked={ficticio} onCheckedChange={setFicticio} />
              </div>
            )}

            {erro && (
              <p className="text-sm text-destructive" role="alert">
                {erro}
              </p>
            )}

            <Button type="submit" disabled={enviando || senha.length !== 6}>
              {enviando ? "Verificando…" : novo ? "Criar e entrar" : "Desbloquear"}
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
