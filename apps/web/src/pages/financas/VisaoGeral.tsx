import { useMemo, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Wallet } from "lucide-react";
import { formatarDinheiro, type Dinheiro } from "@consultorio/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDados } from "@/app/dados";
import { usePreferencias } from "@/app/preferencias";
import { EstadoVazio, Valores } from "@/components/comuns";
import { capitalizar, fmt, noFuso } from "@/lib/datas";
import { agrupar, emMoeda, resumir, rotuloOrigem, somarMeses, useMovimentosNaExibicao } from "@/lib/financas";
import { AvisoConversao } from "./AvisoConversao";
import { cn } from "@/lib/utils";
import { AvisoFixos, type AbrirLancamento } from "./AvisoFixos";

/** Respeita "reduzir movimento" do sistema (e deixa as screenshots estáveis). */
const MOVIMENTO_REDUZIDO = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const compacto = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
const MESES_NA_TABELA = 6;
const rotuloMes = (mes: string, padrao: string) => capitalizar(fmt(new Date(mes + "-15T12:00:00"), padrao));

export function VisaoGeral({ abrir }: { abrir: AbrirLancamento }) {
  const { paciente } = useDados();
  const { fusoPrincipal } = usePreferencias();
  const { movimentos, alvo, base, semCotacao } = useMovimentosNaExibicao();
  const simbolo = { BRL: "R$", USD: "US$", EUR: "€" }[base];
  const mesAtual = fmt(noFuso(new Date(), fusoPrincipal), "yyyy-MM");

  const atual = useMemo(() => resumir(movimentos, mesAtual), [movimentos, mesAtual]);
  const meses = useMemo(
    () =>
      Array.from({ length: MESES_NA_TABELA }, (_, i) => somarMeses(mesAtual, -i))
        .map((m) => resumir(movimentos, m))
        // Some com os meses vazios antes do primeiro movimento.
        .filter((_, i, todos) => i === 0 || todos.slice(i).some((x) => x.entradas.length || x.saidas.length)),
    [movimentos, mesAtual],
  );
  const grafico = [...meses].reverse().map((r) => ({
    mes: r.mes,
    rotulo: rotuloMes(r.mes, "MMM"),
    rotuloLongo: rotuloMes(r.mes, "MMMM 'de' yyyy"),
    entradas: emMoeda(r.entradas, base) / 100,
    saidas: emMoeda(r.saidas, base) / 100,
  }));

  const doMes = movimentos.filter((m) => m.data.startsWith(mesAtual));
  const saidasPorCategoria = agrupar(doMes.filter((m) => m.tipo === "saida"), (m) => m.categoria, base);
  const entradasPorOrigem = agrupar(doMes.filter((m) => m.tipo === "entrada"), (m) => (m.pacienteId ? rotuloOrigem(paciente(m.pacienteId)?.origem) : m.categoria), base);

  if (movimentos.length === 0) {
    return (
      <Card className="py-0">
        <EstadoVazio
          icone={Wallet}
          titulo="Nada lançado ainda"
          descricao="Os pagamentos de pacientes aparecem aqui sozinhos. Lance também o aluguel da sala, a supervisão e o que mais for fixo."
          acao={<Button onClick={() => abrir(null)}>Novo lançamento</Button>}
        />
      </Card>
    );
  }

  const nomeMes = rotuloMes(mesAtual, "MMMM");

  return (
    <div className="flex flex-col gap-6">
      <AvisoFixos mes={mesAtual} />
      <AvisoConversao alvo={alvo} semCotacao={semCotacao} />

      {/* Mês atual */}
      <div className="grid gap-3 sm:grid-cols-3">
        <CartaoTotal titulo={`Entradas em ${nomeMes}`} valores={atual.entradas} detalhe={atual.pacientes.length ? <>Pacientes: <Valores valores={atual.pacientes} /></> : null} />
        <CartaoTotal titulo={`Saídas em ${nomeMes}`} valores={atual.saidas} />
        <CartaoTotal titulo="Resultado do mês" valores={atual.resultado} destaque />
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {/* Mês a mês */}
        <Card className="gap-0 py-0">
          <CardHeader className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-4">
            <CardTitle className="font-serif text-lg font-medium">Mês a mês</CardTitle>
            <div className="flex items-center gap-4 text-xs text-muted-foreground" aria-hidden>
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-[3px] bg-chart-entrada" />Entradas</span>
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-[3px] bg-chart-saida" />Saídas</span>
              <span>em {simbolo}</span>
            </div>
          </CardHeader>
          <CardContent className="px-2 pt-4 pb-2 sm:px-4">
            <div className="h-56" role="img" aria-label={`Gráfico de entradas e saídas por mês em ${simbolo}; os valores estão na tabela abaixo`}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={grafico} barGap={2} barCategoryGap="28%" margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="rotulo" tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                  <YAxis width={56} tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} tickFormatter={(v: number) => compacto.format(v)} />
                  <Tooltip
                    cursor={{ fill: "var(--muted)", opacity: 0.6 }}
                    content={({ active, payload }) => {
                      const d = payload?.[0]?.payload as (typeof grafico)[number] | undefined;
                      if (!active || !d) return null;
                      return (
                        <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
                          <p className="mb-1 font-medium">{d.rotuloLongo}{d.mes === mesAtual && " (parcial)"}</p>
                          <p className="flex items-center gap-1.5"><span className="size-2 rounded-[2px] bg-chart-entrada" />Entradas <span className="ml-auto pl-3 tabular">{formatarDinheiro({ centavos: Math.round(d.entradas * 100), moeda: base })}</span></p>
                          <p className="flex items-center gap-1.5"><span className="size-2 rounded-[2px] bg-chart-saida" />Saídas <span className="ml-auto pl-3 tabular">{formatarDinheiro({ centavos: Math.round(d.saidas * 100), moeda: base })}</span></p>
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
          <div className="overflow-x-auto border-t" tabIndex={0} role="region" aria-label="Tabela mês a mês">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="px-5 py-2 font-medium">Mês</th>
                  <th className="px-3 py-2 text-right font-medium">Pacientes</th>
                  <th className="px-3 py-2 text-right font-medium">Outras entradas</th>
                  <th className="px-3 py-2 text-right font-medium">Saídas</th>
                  <th className="px-5 py-2 text-right font-medium">Resultado</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {meses.map((r) => (
                  <tr key={r.mes}>
                    <td className="px-5 py-2 whitespace-nowrap">{rotuloMes(r.mes, "MMMM yyyy")}{r.mes === mesAtual && <span className="text-muted-foreground"> · parcial</span>}</td>
                    <td className="px-3 py-2 text-right"><Valores valores={r.pacientes} className="justify-end" /></td>
                    <td className="px-3 py-2 text-right"><Valores valores={r.outrasEntradas} className="justify-end" /></td>
                    <td className="px-3 py-2 text-right"><Valores valores={r.saidas} className="justify-end" /></td>
                    <td className="px-5 py-2 text-right font-medium"><ValoresComSinal valores={r.resultado} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="flex flex-col gap-6">
          <ListaBarras titulo={`Saídas de ${nomeMes} por categoria`} vazio="Nenhuma saída neste mês ainda." itens={saidasPorCategoria} cor="bg-chart-saida" />
          <ListaBarras titulo={`Entradas de ${nomeMes} por origem`} vazio="Nenhuma entrada neste mês ainda." itens={entradasPorOrigem} cor="bg-chart-entrada" />
        </div>
      </div>
    </div>
  );
}

function CartaoTotal({ titulo, valores, detalhe, destaque }: { titulo: string; valores: Dinheiro[]; detalhe?: ReactNode; destaque?: boolean }) {
  return (
    <Card className={cn("gap-1 py-4", destaque && "border-primary/30 bg-secondary/40")}>
      <CardContent className="px-5">
        <p className="text-sm text-muted-foreground">{titulo}</p>
        <p className="mt-1 font-serif text-2xl font-medium sm:text-3xl">
          {destaque ? <ValoresComSinal valores={valores} /> : <Valores valores={valores} />}
        </p>
        {detalhe && <p className="mt-1 text-xs text-muted-foreground">{detalhe}</p>}
      </CardContent>
    </Card>
  );
}

/** Resultado: verde se positivo, vermelho se negativo, com sinal. */
function ValoresComSinal({ valores }: { valores: Dinheiro[] }) {
  if (valores.length === 0) return <Valores valores={[]} />;
  return (
    <span className="inline-flex flex-wrap items-baseline justify-end gap-x-2">
      {valores.map((v, i) => (
        <span key={v.moeda} className="inline-flex items-baseline gap-2">
          {i > 0 && <span className="text-muted-foreground" aria-hidden>·</span>}
          <span className={cn("tabular whitespace-nowrap", v.centavos > 0 && "text-positivo", v.centavos < 0 && "text-negativo")}>{formatarDinheiro(v, { sinal: true })}</span>
        </span>
      ))}
    </span>
  );
}

function ListaBarras({ titulo, vazio, itens, cor }: { titulo: string; vazio: string; itens: ReturnType<typeof agrupar>; cor: string }) {
  const max = Math.max(1, ...itens.map((i) => i.brl));
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="flex items-center border-b px-5 py-4">
        <CardTitle className="font-serif text-lg font-medium">{titulo}</CardTitle>
      </CardHeader>
      <CardContent className="px-5 py-4">
        {itens.length === 0 ? (
          <p className="text-sm text-muted-foreground">{vazio}</p>
        ) : (
          <ul className="space-y-3">
            {itens.map((it) => (
              <li key={it.nome} className="text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate">{it.nome}</span>
                  <Valores valores={it.valores} className="text-muted-foreground" />
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-muted">
                  <div className={cn("h-full rounded-full", cor)} style={{ width: `${(it.brl / max) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
