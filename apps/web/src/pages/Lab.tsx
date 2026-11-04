import { CalendarDays, Wallet } from "lucide-react";
import { dinheiro, ESTADOS_SESSAO } from "@consultorio/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { CabecalhoPagina, EstadoBadge, Valor } from "@/components/comuns";
import { cn } from "@/lib/utils";

const TOKENS = [
  ["background", "Fundo"],
  ["card", "Cartão"],
  ["muted", "Suave"],
  ["secondary", "Secundária"],
  ["accent", "Destaque"],
  ["border", "Borda"],
  ["primary", "Sálvia"],
  ["foreground", "Texto"],
  ["muted-foreground", "Texto suave"],
  ["positivo", "Entrada"],
  ["negativo", "Saída"],
  ["destructive", "Perigo"],
] as const;

function Amostra({ escuro }: { escuro: boolean }) {
  return (
    <section
      aria-label={escuro ? "Tema escuro" : "Tema claro"}
      className={cn("rounded-xl border bg-background p-5 text-foreground", escuro && "dark")}
    >
      <p className="mb-4 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {escuro ? "Tema escuro" : "Tema claro"}
      </p>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {TOKENS.map(([token, nome]) => (
          <div key={token} className="min-w-0">
            <div className="h-10 rounded-md border" style={{ background: `var(--${token})` }} />
            <p className="mt-1 truncate text-[11px] text-muted-foreground">{nome}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 space-y-1">
        <h2 className="text-3xl font-medium">Boa tarde</h2>
        <h3 className="text-xl">Fraunces nos títulos</h3>
        <p className="text-sm">Inter no texto corrido, nas tabelas e nos números: <span className="tabular">R$ 1.234,50</span>.</p>
        <p className="text-sm text-muted-foreground">Texto secundário para legendas e metadados.</p>
      </div>

      <div className="mt-6 flex flex-wrap gap-1.5">
        {ESTADOS_SESSAO.map((e) => (
          <EstadoBadge key={e} estado={e} />
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Button>Principal</Button>
        <Button variant="secondary">Secundário</Button>
        <Button variant="outline">Contorno</Button>
        <Button variant="ghost">Discreto</Button>
        <Badge variant="secondary">Online</Badge>
        <Badge variant="outline">Particular</Badge>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Card className="gap-3 py-4">
          <CardHeader className="px-4">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Wallet className="size-4" aria-hidden /> A receber
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4">
            <p className="font-serif text-2xl"><Valor valor={dinheiro(184000)} /></p>
            <p className="text-xs text-muted-foreground">5 pacientes</p>
          </CardContent>
        </Card>
        <Card className="gap-3 py-4">
          <CardHeader className="px-4">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <CalendarDays className="size-4" aria-hidden /> Próxima sessão
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 px-4">
            <div className="rounded-md border-l-[3px] border-[var(--st-agendada-bd)] bg-[var(--st-agendada-bg)] px-2.5 py-1.5 text-[var(--st-agendada-fg)]">
              <p className="text-xs font-semibold">14:00 · M.T.</p>
              <p className="text-[11px] opacity-80">Online · 50 min</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <Input placeholder="Buscar paciente…" className="max-w-56" aria-label={`Exemplo de campo (${escuro ? "escuro" : "claro"})`} />
        <div className="flex items-center gap-2">
          <Switch id={`sw-${escuro}`} defaultChecked />
          <Label htmlFor={`sw-${escuro}`}>Modo discreto</Label>
        </div>
      </div>
    </section>
  );
}

export function PaginaLab() {
  return (
    <>
      <CabecalhoPagina
        titulo="Laboratório visual"
        descricao="Direção Sálvia: neutros quentes, verde-sálvia, serifa nos títulos, cantos suaves e densidade média. A cor forte fica só para os estados."
      />
      <div className="grid gap-4 xl:grid-cols-2">
        <Amostra escuro={false} />
        <Amostra escuro />
      </div>
    </>
  );
}
