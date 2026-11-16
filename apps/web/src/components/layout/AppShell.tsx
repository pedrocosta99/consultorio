import { useEffect, useState } from "react";
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { Leaf, LogOut, Menu, Moon, Search, Settings, Sun } from "lucide-react";
import { ROTULO_PAPEL } from "@consultorio/shared";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useSessao } from "@/app/sessao";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { usePreferencias } from "@/app/preferencias";
import { cn } from "@/lib/utils";
import { BuscaGlobal } from "./BuscaGlobal";
import { MenuNovo } from "./MenuNovo";
import { NAVEGACAO } from "./navegacao";

function Marca() {
  return (
    <div className="flex items-center gap-2.5 px-3 py-1">
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Leaf className="size-4" aria-hidden />
      </span>
      <span className="font-serif text-lg font-medium tracking-tight">Consultório</span>
    </div>
  );
}

function ListaNav({ aoNavegar }: { aoNavegar?: () => void }) {
  return (
    <nav aria-label="Principal" className="flex flex-col gap-0.5">
      {NAVEGACAO.map(({ rota, rotulo, icone: Icone }) => (
        <NavLink
          key={rota}
          to={rota}
          end={rota === "/"}
          onClick={aoNavegar}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              isActive && "bg-sidebar-accent text-sidebar-accent-foreground",
            )
          }
        >
          <Icone className="size-4" aria-hidden />
          {rotulo}
        </NavLink>
      ))}
    </nav>
  );
}

function BotaoTema() {
  const { temaEfetivo, atualizar } = usePreferencias();
  const escuro = temaEfetivo === "escuro";
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={escuro ? "Usar tema claro" : "Usar tema escuro"}
      onClick={() => atualizar({ tema: escuro ? "claro" : "escuro" })}
    >
      {escuro ? <Sun aria-hidden /> : <Moon aria-hidden />}
    </Button>
  );
}

function iniciaisDe(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes.length > 1 ? (partes.at(-1)?.[0] ?? "") : "")).toUpperCase() || "?";
}

/** Quem está usando: nome, consultório, papel; atalho para a conta e sair. */
function MenuConta() {
  const { sessao, sair } = useSessao();
  const navegar = useNavigate();
  if (!sessao) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full" aria-label={`Conta de ${sessao.usuario.nome}`}>
          <span className="flex size-7 items-center justify-center rounded-full bg-secondary text-[11px] font-semibold text-secondary-foreground">{iniciaisDe(sessao.usuario.nome)}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="flex flex-col gap-0.5 font-normal">
          <span className="truncate text-sm font-medium">{sessao.usuario.nome}</span>
          <span className="truncate text-xs text-muted-foreground">{sessao.consultorio.nome} · {ROTULO_PAPEL[sessao.papel]}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/configuracoes#conta">
            <Settings aria-hidden /> Minha conta
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={async () => {
            await sair();
            navegar("/entrar", { replace: true });
          }}
        >
          <LogOut aria-hidden /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppShell() {
  const { estado } = useSessao();
  const [menuAberto, setMenuAberto] = useState(false);
  const [buscaAberta, setBuscaAberta] = useState(false);
  const local = useLocation();

  useEffect(() => {
    const atalho = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setBuscaAberta((v) => !v);
      }
    };
    window.addEventListener("keydown", atalho);
    return () => window.removeEventListener("keydown", atalho);
  }, []);

  useEffect(() => setMenuAberto(false), [local.pathname]);

  // Quem saiu (ou abriu com ?mock=deslogado) vai para a tela de entrar.
  if (estado === "saiu") return <Navigate to="/entrar" replace />;

  return (
    <div className="flex min-h-dvh">
      {/* Sidebar fixa (desktop) */}
      <aside className="hidden w-60 shrink-0 border-r border-sidebar-border bg-sidebar lg:block">
        <div className="sticky top-0 flex h-dvh flex-col gap-6 px-3 py-5">
          <Marca />
          <ListaNav />
          <p className="mt-auto px-3 text-xs text-muted-foreground">Dados só neste computador</p>
        </div>
      </aside>

      {/* Gaveta (mobile/tablet) */}
      <Sheet open={menuAberto} onOpenChange={setMenuAberto}>
        <SheetContent side="left" className="w-64 gap-6 bg-sidebar px-3 py-5">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <SheetDescription className="sr-only">Navegação principal</SheetDescription>
          <Marca />
          <ListaNav aoNavegar={() => setMenuAberto(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label="Abrir menu"
            onClick={() => setMenuAberto(true)}
          >
            <Menu aria-hidden />
          </Button>

          <button
            type="button"
            onClick={() => setBuscaAberta(true)}
            className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border bg-card px-3 text-sm text-muted-foreground shadow-xs transition-colors hover:bg-muted sm:max-w-sm"
          >
            <Search className="size-4 shrink-0" aria-hidden />
            <span className="truncate">Buscar pacientes, telas…</span>
            <kbd className="ml-auto hidden rounded border bg-muted px-1.5 font-sans text-[11px] font-medium sm:inline">⌘K</kbd>
          </button>

          <div className="ml-auto flex items-center gap-1">
            <BotaoTema />
            <MenuNovo />
            <MenuConta />
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>

      <BuscaGlobal aberta={buscaAberta} aoMudar={setBuscaAberta} />
    </div>
  );
}
