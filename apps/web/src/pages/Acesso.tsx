/**
 * Telas de acesso: entrar (Google ou e-mail e senha), código do autenticador, esqueci
 * a senha, convite e "sem acesso". O login por trás ainda é simulado (ver app/sessao).
 */
import { useState, type FormEvent, type ReactNode } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router";
import { ArrowLeft, KeyRound, Leaf, MailCheck, ShieldCheck, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Campo } from "@/components/formularios/campos";
import { useSessao, type ResultadoEntrada } from "@/app/sessao";
import { LogoGoogle } from "@/components/LogoGoogle";

function TelaAcesso({ titulo, descricao, icone, children, rodape }: { titulo: string; descricao?: ReactNode; icone?: ReactNode; children: ReactNode; rodape?: ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background px-4 py-10">
      <div className="flex items-center gap-2.5">
        <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Leaf className="size-4" aria-hidden />
        </span>
        <span className="font-serif text-xl font-medium tracking-tight">Consultório</span>
      </div>
      <Card className="w-full max-w-sm gap-0 py-0">
        <CardContent className="flex flex-col gap-5 p-6">
          <div className="flex flex-col gap-1.5">
            {icone && <span className="mb-1 flex size-10 items-center justify-center rounded-full bg-secondary text-secondary-foreground">{icone}</span>}
            <h1 className="font-serif text-2xl font-medium">{titulo}</h1>
            {descricao && <p className="text-sm text-muted-foreground">{descricao}</p>}
          </div>
          {children}
        </CardContent>
      </Card>
      {rodape && <div className="max-w-sm text-center text-xs text-muted-foreground">{rodape}</div>}
    </main>
  );
}

function useSeguir() {
  const navegar = useNavigate();
  const { atualizar } = useSessao();
  return async (r: ResultadoEntrada) => {
    if (r.tipo === "codigo") return navegar("/entrar/codigo");
    if (r.tipo === "sem_acesso") return navegar(`/sem-acesso?email=${encodeURIComponent(r.email)}`);
    await atualizar();
    navegar("/", { replace: true });
  };
}

function Erro({ texto }: { texto: string | null }) {
  return texto ? (
    <p className="text-sm text-destructive" role="alert">
      {texto}
    </p>
  ) : null;
}

const AVISO_SIMULADO = "Login simulado (versão local): qualquer e-mail e senha entram.";

export function PaginaEntrar() {
  const { estado, provedor, simulado } = useSessao();
  const seguir = useSeguir();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState<"google" | "senha" | null>(null);

  if (estado === "entrou") return <Navigate to="/" replace />;

  const comSenha = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    if (!email.includes("@")) return setErro("Informe o e-mail.");
    if (senha.length < 1) return setErro("Informe a senha.");
    setEnviando("senha");
    try {
      await seguir(await provedor.entrarComSenha(email.trim(), senha));
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível entrar.");
    } finally {
      setEnviando(null);
    }
  };

  return (
    <TelaAcesso titulo="Entrar" descricao="Use a conta Google ou o e-mail e a senha do consultório." rodape={simulado ? AVISO_SIMULADO : undefined}>
      <Button
        type="button"
        variant="outline"
        className="w-full gap-2"
        disabled={enviando !== null}
        onClick={async () => {
          setEnviando("google");
          try {
            await seguir(await provedor.entrarComGoogle());
          } finally {
            setEnviando(null);
          }
        }}
      >
        <LogoGoogle /> {enviando === "google" ? "Abrindo o Google…" : "Continuar com Google"}
      </Button>
      <div className="flex items-center gap-3 text-xs text-muted-foreground" aria-hidden>
        <span className="h-px flex-1 bg-border" /> ou <span className="h-px flex-1 bg-border" />
      </div>
      <form onSubmit={comSenha} className="flex flex-col gap-4" noValidate>
        <Campo rotulo="E-mail">{(id) => <Input id={id} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />}</Campo>
        <Campo rotulo="Senha">{(id) => <Input id={id} type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} />}</Campo>
        <Erro texto={erro} />
        <Button type="submit" disabled={enviando !== null}>
          {enviando === "senha" ? "Entrando…" : "Entrar"}
        </Button>
        <Link to="/entrar/esqueci" className="self-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
          Esqueci a senha
        </Link>
      </form>
    </TelaAcesso>
  );
}

export function PaginaCodigo() {
  const { provedor } = useSessao();
  const seguir = useSeguir();
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await seguir(await provedor.confirmarCodigo(codigo.replace(/\s/g, "")));
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Código inválido.");
    } finally {
      setEnviando(false);
    }
  };
  return (
    <TelaAcesso titulo="Código de verificação" descricao="Abra o app autenticador e digite o código de 6 números do Consultório." icone={<ShieldCheck className="size-5" aria-hidden />}>
      <form onSubmit={enviar} className="flex flex-col gap-4" noValidate>
        <Campo rotulo="Código">
          {(id) => (
            <Input
              id={id}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={7}
              className="text-center font-mono text-lg tracking-[0.4em]"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              autoFocus
            />
          )}
        </Campo>
        <Erro texto={erro} />
        <Button type="submit" disabled={enviando}>
          {enviando ? "Verificando…" : "Confirmar"}
        </Button>
        <Link to="/entrar" className="flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3.5" aria-hidden /> Voltar
        </Link>
      </form>
    </TelaAcesso>
  );
}

export function PaginaEsqueci() {
  const { provedor } = useSessao();
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  if (enviado) {
    return (
      <TelaAcesso titulo="Confira seu e-mail" icone={<MailCheck className="size-5" aria-hidden />} descricao={`Se houver uma conta com ${email}, mandamos um link para criar uma senha nova. O link vale por 1 hora.`}>
        <Button asChild variant="outline">
          <Link to="/entrar">Voltar para entrar</Link>
        </Button>
      </TelaAcesso>
    );
  }
  return (
    <TelaAcesso titulo="Esqueci a senha" descricao="Informe o e-mail da sua conta. Se você entra com o Google, use o botão do Google na tela anterior." icone={<KeyRound className="size-5" aria-hidden />}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!email.includes("@")) return;
          setEnviando(true);
          await provedor.enviarRecuperacao(email.trim());
          setEnviando(false);
          setEnviado(true);
        }}
        className="flex flex-col gap-4"
        noValidate
      >
        <Campo rotulo="E-mail">{(id) => <Input id={id} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />}</Campo>
        <Button type="submit" disabled={enviando || !email.includes("@")}>
          {enviando ? "Enviando…" : "Mandar link"}
        </Button>
        <Link to="/entrar" className="flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3.5" aria-hidden /> Voltar
        </Link>
      </form>
    </TelaAcesso>
  );
}

export function PaginaConvite() {
  const { token = "" } = useParams();
  const { provedor } = useSessao();
  const seguir = useSeguir();
  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    if (!nome.trim()) return setErro("Como você quer ser chamada(o)?");
    if (senha.length < 10) return setErro("A senha precisa de pelo menos 10 caracteres.");
    if (senha !== confirmacao) return setErro("As senhas não são iguais.");
    try {
      await seguir(await provedor.aceitarConvite(token, { nome: nome.trim(), senha }));
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível aceitar o convite.");
    }
  };
  return (
    <TelaAcesso titulo="Você foi convidada(o)" descricao="Crie seu acesso ao consultório. Depois, no primeiro acesso, você configura o app autenticador.">
      <Button type="button" variant="outline" className="w-full gap-2" onClick={async () => seguir(await provedor.aceitarConvite(token, "google"))}>
        <LogoGoogle /> Aceitar com o Google
      </Button>
      <div className="flex items-center gap-3 text-xs text-muted-foreground" aria-hidden>
        <span className="h-px flex-1 bg-border" /> ou crie uma senha <span className="h-px flex-1 bg-border" />
      </div>
      <form onSubmit={enviar} className="flex flex-col gap-4" noValidate>
        <Campo rotulo="Seu nome">{(id) => <Input id={id} autoComplete="name" value={nome} onChange={(e) => setNome(e.target.value)} />}</Campo>
        <Campo rotulo="Senha" ajuda="Pelo menos 10 caracteres.">
          {(id, d) => <Input id={id} aria-describedby={d} type="password" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} />}
        </Campo>
        <Campo rotulo="Repita a senha">{(id) => <Input id={id} type="password" autoComplete="new-password" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} />}</Campo>
        <Erro texto={erro} />
        <Button type="submit">Criar acesso</Button>
      </form>
    </TelaAcesso>
  );
}

export function PaginaSemAcesso() {
  const { sair } = useSessao();
  const email = new URLSearchParams(window.location.search).get("email");
  return (
    <TelaAcesso
      titulo="Sem acesso a um consultório"
      icone={<UserX className="size-5" aria-hidden />}
      descricao={`A conta ${email ?? "que você usou"} ainda não faz parte de nenhum consultório. Peça um convite a quem administra o consultório, ou entre com outra conta.`}
    >
      <Button asChild variant="outline" onClick={() => void sair()}>
        <Link to="/entrar">Entrar com outra conta</Link>
      </Button>
    </TelaAcesso>
  );
}
