import { useMemo, useState } from "react";
import { Link } from "react-router";
import { ArrowDownLeft, ArrowUpRight, ChevronLeft, ChevronRight, Repeat, Search, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePreferencias } from "@/app/preferencias";
import { EstadoVazio, Valor, Valores } from "@/components/comuns";
import { capitalizar, fmt, noFuso } from "@/lib/datas";
import { converterItens, resumir, somarMeses, useMoedaExibicao, useMovimentos, type Movimento } from "@/lib/financas";
import { useDados } from "@/app/dados";
import { AvisoConversao } from "./AvisoConversao";
import { cn } from "@/lib/utils";
import { AvisoFixos, type AbrirLancamento } from "./AvisoFixos";

type FiltroTipo = "todos" | "entrada" | "saida";

export function Lancamentos({ abrir }: { abrir: AbrirLancamento }) {
  const { fusoPrincipal } = usePreferencias();
  const movimentos = useMovimentos();
  const alvo = useMoedaExibicao();
  const { cotacoes } = useDados();
  const mesAtual = fmt(noFuso(new Date(), fusoPrincipal), "yyyy-MM");
  const [mes, setMes] = useState(mesAtual);
  const [tipo, setTipo] = useState<FiltroTipo>("todos");
  const [categoria, setCategoria] = useState("todas");
  const [busca, setBusca] = useState("");

  const doMes = useMemo(() => movimentos.filter((m) => m.data.startsWith(mes)), [movimentos, mes]);
  const categorias = useMemo(() => [...new Set(doMes.map((m) => m.categoria))].sort(), [doMes]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return doMes.filter(
      (m) =>
        (tipo === "todos" || m.tipo === tipo) &&
        (categoria === "todas" || m.categoria === categoria) &&
        (!termo || m.descricao.toLowerCase().includes(termo) || m.categoria.toLowerCase().includes(termo)),
    );
  }, [doMes, tipo, categoria, busca]);

  const porDia = useMemo(() => {
    const grupos = new Map<string, Movimento[]>();
    for (const m of filtrados) grupos.set(m.data, [...(grupos.get(m.data) ?? []), m]);
    return [...grupos.entries()];
  }, [filtrados]);

  // A lista mostra a moeda original; os totais seguem a moeda de exibição.
  const convertidos = converterItens(filtrados, alvo, cotacoes);
  const totais = resumir(convertidos.itens, mes);
  const nomeMes = capitalizar(fmt(new Date(mes + "-15T12:00:00"), "MMMM yyyy"));

  return (
    <div className="flex flex-col gap-4">
      <AvisoConversao alvo={alvo} semCotacao={convertidos.semCotacao} />
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="bg-card" aria-label="Mês anterior" onClick={() => setMes((m) => somarMeses(m, -1))}>
            <ChevronLeft aria-hidden />
          </Button>
          <p className="min-w-36 text-center text-sm font-medium" aria-live="polite">
            {nomeMes}
          </p>
          <Button variant="outline" size="icon" className="bg-card" aria-label="Próximo mês" onClick={() => setMes((m) => somarMeses(m, 1))}>
            <ChevronRight aria-hidden />
          </Button>
          {mes !== mesAtual && (
            <Button variant="ghost" size="sm" onClick={() => setMes(mesAtual)}>
              Hoje
            </Button>
          )}
        </div>
        <div className="relative min-w-0 flex-1 lg:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar descrição" aria-label="Buscar lançamento" className="bg-card pl-8" />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Select value={tipo} onValueChange={(v) => setTipo(v as FiltroTipo)}>
            <SelectTrigger className="w-full min-w-0 bg-card sm:w-48" aria-label="Filtrar por tipo">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Entradas e saídas</SelectItem>
              <SelectItem value="entrada">Só entradas</SelectItem>
              <SelectItem value="saida">Só saídas</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoria} onValueChange={setCategoria}>
            <SelectTrigger className="w-full min-w-0 bg-card sm:w-52" aria-label="Filtrar por categoria">
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

      <AvisoFixos mes={mes} />

      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <span className="text-muted-foreground">
          Entradas: <Valores valores={totais.entradas} className="font-medium text-positivo" />
        </span>
        <span className="text-muted-foreground">
          Saídas: <Valores valores={totais.saidas} className="font-medium text-negativo" />
        </span>
      </div>

      {porDia.length === 0 ? (
        <Card className="py-0">
          {doMes.length === 0 ? (
            <EstadoVazio
              icone={SearchX}
              titulo={`Nada em ${nomeMes}`}
              descricao="Pagamentos de pacientes aparecem sozinhos. Lance aqui sala, supervisão e outros."
              acao={<Button onClick={() => abrir(null)}>Novo lançamento</Button>}
            />
          ) : (
            <EstadoVazio icone={SearchX} titulo="Nenhum lançamento" descricao="Ajuste os filtros ou a busca." />
          )}
        </Card>
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          {porDia.map(([dia, lista]) => (
            <section key={dia} aria-label={dia}>
              <h3 className="border-b bg-muted/60 px-5 py-1.5 font-sans text-xs font-medium tracking-normal text-muted-foreground">
                {capitalizar(fmt(new Date(dia + "T12:00:00"), "EEEE, d 'de' MMMM"))}
              </h3>
              <ul className="divide-y">
                {lista.map((m) => (
                  <li key={m.id}>
                    <Linha m={m} abrir={abrir} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </Card>
      )}
    </div>
  );
}

function Linha({ m, abrir }: { m: Movimento; abrir: AbrirLancamento }) {
  const Icone = m.tipo === "entrada" ? ArrowDownLeft : ArrowUpRight;
  const conteudo = (
    <>
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full",
          m.tipo === "entrada" ? "bg-[var(--st-realizada-bg)] text-[var(--st-realizada-fg)]" : "bg-muted text-muted-foreground",
        )}
      >
        <Icone className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{m.descricao}</p>
        <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
          {m.categoria}
          {m.lancamento?.fixo && (
            <>
              {" · "}
              <Repeat className="size-3" aria-hidden /> fixo mensal
            </>
          )}
        </p>
      </div>
      <Valor valor={m.tipo === "saida" ? { ...m.valor, centavos: -m.valor.centavos } : m.valor} colorir sinal className="text-sm font-medium" />
    </>
  );
  const classe = "flex w-full items-center gap-3 px-5 py-2.5 text-left hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none";
  if (m.pacienteId)
    return (
      <Link to={`/pacientes/${m.pacienteId}?aba=sessoes`} className={classe}>
        {conteudo}
      </Link>
    );
  return (
    <button type="button" className={classe} onClick={() => m.lancamento && abrir(m.lancamento)}>
      {conteudo}
    </button>
  );
}
