import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Landmark, PiggyBank, CreditCard, LineChart, Banknote, Wallet } from "lucide-react";
import { formatarDinheiro, type Conta, type Moeda, MOEDAS } from "@consultorio/shared";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDados } from "@/app/dados";
import { usePreferencias } from "@/app/preferencias";
import { EstadoVazio, Valor } from "@/components/comuns";
import { capitalizar, fmt, noFuso } from "@/lib/datas";
import { cn } from "@/lib/utils";

/** Respeita "reduzir movimento" do sistema (e deixa as screenshots estáveis). */
const MOVIMENTO_REDUZIDO = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const ICONE_CONTA: Record<Conta["tipo"], typeof Landmark> = {
  corrente: Landmark,
  poupanca: PiggyBank,
  cartao: CreditCard,
  investimento: LineChart,
  dinheiro: Banknote,
};
const ROTULO_TIPO: Record<Conta["tipo"], string> = {
  corrente: "Corrente",
  poupanca: "Poupança",
  cartao: "Cartão",
  investimento: "Investimento",
  dinheiro: "Dinheiro",
};
const NOME_MOEDA: Record<Moeda, string> = { BRL: "Real", USD: "Dólar", EUR: "Euro" };

/** Saldo de cada conta = soma das transações (centavos, moeda da conta). */
export function useSaldos() {
  const { contas, transacoes } = useDados();
  return useMemo(() => {
    const mapa = new Map<string, number>();
    for (const t of transacoes) mapa.set(t.contaId, (mapa.get(t.contaId) ?? 0) + t.valor.centavos);
    return contas.map((c) => ({ conta: c, saldo: { centavos: mapa.get(c.id) ?? 0, moeda: c.moeda } }));
  }, [contas, transacoes]);
}

const compacto = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

export function VisaoGeral() {
  const { transacoes, contas } = useDados();
  const { fusoPrincipal } = usePreferencias();
  const saldos = useSaldos();
  const mesAtual = fmt(noFuso(new Date(), fusoPrincipal), "yyyy-MM");

  const porMoeda = MOEDAS.map((m) => ({
    moeda: m,
    total: saldos.filter((s) => s.conta.moeda === m).reduce((acc, s) => acc + s.saldo.centavos, 0),
    contas: saldos.filter((s) => s.conta.moeda === m).length,
  })).filter((x) => x.contas > 0);

  // Fluxo de caixa mensal em BRL (sem transferências e ajustes).
  const fluxo = useMemo(() => {
    const meses = new Map<string, { entradas: number; saidas: number }>();
    for (const t of transacoes) {
      if (t.valor.moeda !== "BRL" || t.tipo === "transferencia" || t.categoria === "Ajuste") continue;
      const m = t.data.slice(0, 7);
      const v = meses.get(m) ?? { entradas: 0, saidas: 0 };
      if (t.valor.centavos > 0) v.entradas += t.valor.centavos;
      else v.saidas += -t.valor.centavos;
      meses.set(m, v);
    }
    return [...meses.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-4)
      .map(([m, v]) => ({
        mes: m,
        rotulo: capitalizar(fmt(new Date(m + "-15T12:00:00"), "MMM")),
        rotuloLongo: capitalizar(fmt(new Date(m + "-15T12:00:00"), "MMMM 'de' yyyy")),
        entradas: v.entradas / 100,
        saidas: v.saidas / 100,
        resultado: v.entradas - v.saidas,
        parcial: m === mesAtual,
      }));
  }, [transacoes, mesAtual]);

  // Gastos do mês por categoria (BRL).
  const gastos = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const t of transacoes) {
      if (t.tipo !== "despesa" || t.valor.moeda !== "BRL" || !t.data.startsWith(mesAtual)) continue;
      mapa.set(t.categoria, (mapa.get(t.categoria) ?? 0) - t.valor.centavos);
    }
    return [...mapa.entries()].sort((a, b) => b[1] - a[1]);
  }, [transacoes, mesAtual]);
  const maxGasto = Math.max(1, ...gastos.map(([, v]) => v));

  if (contas.length === 0) {
    return (
      <Card className="py-0">
        <EstadoVazio icone={Wallet} titulo="Nenhuma conta cadastrada" descricao="Cadastre bancos, cartões e corretoras para ver saldos e fluxo de caixa." />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Totais por moeda */}
      <div className="grid gap-3 sm:grid-cols-3">
        {porMoeda.map(({ moeda, total, contas: n }) => (
          <Card key={moeda} className={cn("gap-1 py-4", moeda === "BRL" && "border-primary/30 bg-secondary/40")}>
            <CardContent className="px-5">
              <p className="text-sm text-muted-foreground">
                {NOME_MOEDA[moeda]} · {n} {n === 1 ? "conta" : "contas"}
              </p>
              <p className={cn("mt-1 font-serif font-medium", moeda === "BRL" ? "text-3xl" : "text-2xl")}>
                <Valor valor={{ centavos: total, moeda }} />
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {/* Fluxo de caixa */}
        <Card className="gap-0 py-0">
          <CardHeader className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-4">
            <CardTitle className="font-serif text-lg font-medium">Fluxo de caixa · R$</CardTitle>
            <div className="flex items-center gap-4 text-xs text-muted-foreground" aria-hidden>
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-[3px] bg-chart-entrada" />Entradas</span>
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-[3px] bg-chart-saida" />Saídas</span>
            </div>
          </CardHeader>
          <CardContent className="px-2 pt-4 pb-2 sm:px-4">
            <div className="h-60" role="img" aria-label="Gráfico de entradas e saídas por mês; os valores estão na tabela abaixo">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={fluxo} barGap={2} barCategoryGap="28%" margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="rotulo" tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                  <YAxis
                    width={44}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                    tickFormatter={(v: number) => compacto.format(v)}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--muted)", opacity: 0.6 }}
                    content={({ active, payload }) => {
                      const d = payload?.[0]?.payload as (typeof fluxo)[number] | undefined;
                      if (!active || !d) return null;
                      return (
                        <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
                          <p className="mb-1 font-medium">{d.rotuloLongo}{d.parcial && " (parcial)"}</p>
                          <p className="flex items-center gap-1.5"><span className="size-2 rounded-[2px] bg-chart-entrada" />Entradas <span className="ml-auto pl-3 tabular">{formatarDinheiro({ centavos: Math.round(d.entradas * 100), moeda: "BRL" })}</span></p>
                          <p className="flex items-center gap-1.5"><span className="size-2 rounded-[2px] bg-chart-saida" />Saídas <span className="ml-auto pl-3 tabular">{formatarDinheiro({ centavos: Math.round(d.saidas * 100), moeda: "BRL" })}</span></p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="entradas" name="Entradas" fill="var(--chart-entrada)" radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={!MOVIMENTO_REDUZIDO} />
                  <Bar dataKey="saidas" name="Saídas" fill="var(--chart-saida)" radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={!MOVIMENTO_REDUZIDO} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
          <div className="overflow-x-auto border-t" tabIndex={0} role="region" aria-label="Tabela do fluxo de caixa">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="px-5 py-2 font-medium">Mês</th>
                  <th className="px-3 py-2 text-right font-medium">Entradas</th>
                  <th className="px-3 py-2 text-right font-medium">Saídas</th>
                  <th className="px-5 py-2 text-right font-medium">Resultado</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {fluxo.map((f) => (
                  <tr key={f.mes}>
                    <td className="px-5 py-2">{f.rotuloLongo}{f.parcial && <span className="text-muted-foreground"> · parcial</span>}</td>
                    <td className="px-3 py-2 text-right"><Valor valor={{ centavos: Math.round(f.entradas * 100), moeda: "BRL" }} /></td>
                    <td className="px-3 py-2 text-right"><Valor valor={{ centavos: Math.round(f.saidas * 100), moeda: "BRL" }} /></td>
                    <td className="px-5 py-2 text-right font-medium"><Valor valor={{ centavos: f.resultado, moeda: "BRL" }} colorir sinal /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Gastos por categoria */}
        <Card className="gap-0 py-0">
          <CardHeader className="flex items-center border-b px-5 py-4">
            <CardTitle className="font-serif text-lg font-medium">Gastos do mês por categoria</CardTitle>
          </CardHeader>
          <CardContent className="px-5 py-4">
            {gastos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum gasto neste mês ainda.</p>
            ) : (
              <ul className="space-y-3">
                {gastos.map(([cat, v]) => (
                  <li key={cat} className="text-sm">
                    <div className="flex items-baseline justify-between gap-3">
                      <span>{cat}</span>
                      <Valor valor={{ centavos: v, moeda: "BRL" }} className="text-muted-foreground" />
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-muted">
                      <div className="h-full rounded-full bg-chart-saida" style={{ width: `${(v / maxGasto) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Contas */}
      <section aria-labelledby="titulo-contas">
        <h2 id="titulo-contas" className="mb-3 text-lg font-medium">Contas</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {saldos.map(({ conta, saldo }) => {
            const Icone = ICONE_CONTA[conta.tipo];
            return (
              <Card key={conta.id} className="flex-row items-center gap-3 px-4 py-3.5">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                  <Icone className="size-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{conta.instituicao} · {conta.nome}</p>
                  <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Badge variant="outline" className="px-1.5 py-0 font-normal">{ROTULO_TIPO[conta.tipo]}</Badge>
                    {conta.pais} · {conta.moeda}
                  </div>
                </div>
                <Valor valor={saldo} colorir={saldo.centavos < 0} className="font-medium" />
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
