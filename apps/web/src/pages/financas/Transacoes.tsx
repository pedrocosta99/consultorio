import { useMemo, useState } from "react";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Search, SearchX } from "lucide-react";
import type { Transacao } from "@consultorio/shared";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { somarPorMoeda, useDados } from "@/app/dados";
import { EstadoVazio, Valor, Valores } from "@/components/comuns";
import { capitalizar, fmt } from "@/lib/datas";
import { cn } from "@/lib/utils";

const ICONE: Record<Transacao["tipo"], typeof ArrowUpRight> = {
  receita: ArrowDownLeft,
  despesa: ArrowUpRight,
  transferencia: ArrowLeftRight,
};

export function Transacoes() {
  const { transacoes, contas } = useDados();
  const meses = useMemo(() => [...new Set(transacoes.map((t) => t.data.slice(0, 7)))].sort().reverse(), [transacoes]);
  const [mes, setMes] = useState(() => meses[0] ?? "todos");
  const [conta, setConta] = useState("todas");
  const [categoria, setCategoria] = useState("todas");
  const [busca, setBusca] = useState("");

  const categorias = useMemo(() => [...new Set(transacoes.map((t) => t.categoria))].sort(), [transacoes]);
  const contaPorId = useMemo(() => new Map(contas.map((c) => [c.id, c])), [contas]);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return transacoes.filter(
      (t) =>
        (mes === "todos" || t.data.startsWith(mes)) &&
        (conta === "todas" || t.contaId === conta) &&
        (categoria === "todas" || t.categoria === categoria) &&
        (!termo || t.descricao.toLowerCase().includes(termo) || (t.subcategoria ?? "").toLowerCase().includes(termo)),
    );
  }, [transacoes, mes, conta, categoria, busca]);

  const porDia = useMemo(() => {
    const grupos = new Map<string, Transacao[]>();
    for (const t of filtradas) grupos.set(t.data, [...(grupos.get(t.data) ?? []), t]);
    return [...grupos.entries()];
  }, [filtradas]);

  const entradas = somarPorMoeda(filtradas.filter((t) => t.valor.centavos > 0 && t.tipo !== "transferencia").map((t) => t.valor));
  const saidas = somarPorMoeda(filtradas.filter((t) => t.valor.centavos < 0 && t.tipo !== "transferencia").map((t) => t.valor));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar descrição" aria-label="Buscar transação" className="bg-card pl-8" />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Select value={mes} onValueChange={setMes}>
            <SelectTrigger className="col-span-2 w-full bg-card sm:w-40" aria-label="Filtrar por mês">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {meses.map((m) => (
                <SelectItem key={m} value={m}>
                  {capitalizar(fmt(new Date(m + "-15T12:00:00"), "MMMM yyyy"))}
                </SelectItem>
              ))}
              <SelectItem value="todos">Todos os meses</SelectItem>
            </SelectContent>
          </Select>
          <Select value={conta} onValueChange={setConta}>
            <SelectTrigger className="w-full min-w-0 bg-card sm:w-48" aria-label="Filtrar por conta">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as contas</SelectItem>
              {contas.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.instituicao} · {c.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={categoria} onValueChange={setCategoria}>
            <SelectTrigger className="w-full min-w-0 bg-card sm:w-44" aria-label="Filtrar por categoria">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as categorias</SelectItem>
              {categorias.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <span className="text-muted-foreground">
          Entradas: <Valores valores={entradas} className="font-medium text-positivo" />
        </span>
        <span className="text-muted-foreground">
          Saídas: <Valores valores={saidas} className="font-medium text-negativo" />
        </span>
      </div>

      {porDia.length === 0 ? (
        <Card className="py-0">
          <EstadoVazio icone={SearchX} titulo="Nenhuma transação" descricao="Ajuste os filtros ou a busca." />
        </Card>
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          {porDia.map(([dia, lista]) => (
            <section key={dia} aria-label={dia}>
              <h3 className="border-b bg-muted/60 px-5 py-1.5 font-sans text-xs font-medium tracking-normal text-muted-foreground">
                {capitalizar(fmt(new Date(dia + "T12:00:00"), "EEEE, d 'de' MMMM"))}
              </h3>
              <ul className="divide-y">
                {lista.map((t) => {
                  const Icone = ICONE[t.tipo];
                  const c = contaPorId.get(t.contaId);
                  return (
                    <li key={t.id} className="flex items-center gap-3 px-5 py-2.5">
                      <span
                        className={cn(
                          "flex size-8 shrink-0 items-center justify-center rounded-full",
                          t.tipo === "receita" && "bg-[var(--st-realizada-bg)] text-[var(--st-realizada-fg)]",
                          t.tipo === "despesa" && "bg-muted text-muted-foreground",
                          t.tipo === "transferencia" && "bg-[var(--st-agendada-bg)] text-[var(--st-agendada-fg)]",
                        )}
                      >
                        <Icone className="size-4" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{t.descricao}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {t.categoria}
                          {t.subcategoria && ` › ${t.subcategoria}`} · {c?.instituicao}
                        </p>
                      </div>
                      <Valor valor={t.valor} colorir sinal className="text-sm font-medium" />
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </Card>
      )}
    </div>
  );
}
