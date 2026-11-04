import { Link } from "react-router";
import { Megaphone } from "lucide-react";
import { ROTULO_PLATAFORMA, type Campanha, type Dinheiro } from "@consultorio/shared";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useDados } from "@/app/dados";
import { usePreferencias } from "@/app/preferencias";
import { EstadoVazio, PacienteAvatar, Valor } from "@/components/comuns";
import { chaveDia, fmt } from "@/lib/datas";
import { cn } from "@/lib/utils";

const numero = new Intl.NumberFormat("pt-BR");
const pct = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 });

function dividir(valor: Dinheiro, por: number): Dinheiro | null {
  return por > 0 ? { centavos: Math.round(valor.centavos / por), moeda: valor.moeda } : null;
}

function dataCurta(d: string): string {
  return fmt(new Date(d + "T12:00:00"), "d MMM");
}

function Indicador({ titulo, children, rodape }: { titulo: string; children: React.ReactNode; rodape?: string }) {
  return (
    <Card className="gap-1 py-4">
      <CardContent className="px-4">
        <p className="text-sm text-muted-foreground">{titulo}</p>
        <p className="mt-1 font-serif text-2xl font-medium">{children}</p>
        {rodape && <p className="mt-0.5 text-xs text-muted-foreground">{rodape}</p>}
      </CardContent>
    </Card>
  );
}

function Metrica({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{rotulo}</dt>
      <dd className="text-sm font-medium tabular">{children}</dd>
    </div>
  );
}

function CartaoCampanha({ c, hoje }: { c: Campanha; hoje: string }) {
  const { paciente, nomeExibicao } = useDados();
  const ativa = c.fim === null || c.fim >= hoje;
  const uso = c.orcamento.centavos > 0 ? Math.min(1, c.gasto.centavos / c.orcamento.centavos) : 0;
  const custoContato = dividir(c.gasto, c.contatos);
  const custoPaciente = dividir(c.gasto, c.pacientesIds.length);

  return (
    <Card className="gap-4 px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium">{c.nome}</p>
          <p className="text-xs text-muted-foreground">
            {dataCurta(c.inicio)} – {c.fim ? dataCurta(c.fim) : "em andamento"}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge variant="outline">{ROTULO_PLATAFORMA[c.plataforma]}</Badge>
          <Badge
            variant="outline"
            className={cn(
              ativa
                ? "border-[var(--st-realizada-bd)] bg-[var(--st-realizada-bg)] text-[var(--st-realizada-fg)]"
                : "border-[var(--st-cancelada-bd)] bg-[var(--st-cancelada-bg)] text-[var(--st-cancelada-fg)]",
            )}
          >
            {ativa ? "Ativa" : "Encerrada"}
          </Badge>
        </div>
      </div>

      <div>
        <div className="mb-1 flex items-baseline justify-between text-sm">
          <span>
            <Valor valor={c.gasto} className="font-medium" />
            <span className="text-muted-foreground"> de <Valor valor={c.orcamento} /></span>
          </span>
          <span className="text-xs text-muted-foreground tabular">{pct.format(uso)}</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted" role="progressbar" aria-label="Orçamento usado" aria-valuenow={Math.round(uso * 100)} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-primary" style={{ width: `${uso * 100}%` }} />
        </div>
      </div>

      <dl className="grid grid-cols-3 gap-x-4 gap-y-3 sm:grid-cols-6">
        <Metrica rotulo="Impressões">{numero.format(c.impressoes)}</Metrica>
        <Metrica rotulo="Cliques">{numero.format(c.cliques)}</Metrica>
        <Metrica rotulo="CTR">{c.impressoes ? pct.format(c.cliques / c.impressoes) : "—"}</Metrica>
        <Metrica rotulo="Contatos">{c.contatos}</Metrica>
        <Metrica rotulo="Custo/contato">{custoContato ? <Valor valor={custoContato} /> : "—"}</Metrica>
        <Metrica rotulo="Custo/paciente">{custoPaciente ? <Valor valor={custoPaciente} /> : "—"}</Metrica>
      </dl>

      <div className="flex flex-wrap items-center gap-2 border-t pt-3 text-sm">
        <span className="text-muted-foreground">Pacientes captados:</span>
        {c.pacientesIds.length === 0 ? (
          <span className="text-muted-foreground">nenhum ainda</span>
        ) : (
          c.pacientesIds.map((id) => {
            const p = paciente(id);
            return (
              <Link key={id} to={`/pacientes/${id}`} className="inline-flex items-center gap-1.5 rounded-full border py-0.5 pr-2.5 pl-0.5 hover:bg-muted">
                <PacienteAvatar paciente={p} className="size-6 text-[10px]" />
                {nomeExibicao(p, "curto")}
              </Link>
            );
          })
        )}
      </div>
    </Card>
  );
}

export function Divulgacao() {
  const { campanhas } = useDados();
  const { fusoPrincipal } = usePreferencias();
  const hoje = chaveDia(new Date(), fusoPrincipal);
  const mes = hoje.slice(0, 7);

  if (campanhas.length === 0) {
    return (
      <Card className="py-0">
        <EstadoVazio icone={Megaphone} titulo="Nenhuma campanha" descricao="Registre seus anúncios do Instagram, Google e outros para acompanhar gasto, contatos e pacientes captados." />
      </Card>
    );
  }

  // Indicadores agregados em BRL (campanhas em outra moeda ficam de fora).
  const brl = campanhas.filter((c) => c.gasto.moeda === "BRL");
  const gastoTotal: Dinheiro = { centavos: brl.reduce((a, c) => a + c.gasto.centavos, 0), moeda: "BRL" };
  const contatos = brl.reduce((a, c) => a + c.contatos, 0);
  const captados = brl.reduce((a, c) => a + c.pacientesIds.length, 0);
  const ativasNoMes = campanhas.filter((c) => c.inicio.slice(0, 7) <= mes && (c.fim === null || c.fim.slice(0, 7) >= mes));
  const ordenadas = [...campanhas].sort((a, b) => b.inicio.localeCompare(a.inicio));

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador titulo="Gasto total" rodape={`${campanhas.length} campanhas`}>
          <Valor valor={gastoTotal} />
        </Indicador>
        <Indicador titulo="Contatos" rodape={`${ativasNoMes.length} campanha(s) neste mês`}>
          {contatos}
        </Indicador>
        <Indicador titulo="Custo por contato">
          {dividir(gastoTotal, contatos) ? <Valor valor={dividir(gastoTotal, contatos)!} /> : "—"}
        </Indicador>
        <Indicador titulo="Custo por paciente" rodape={`${captados} paciente(s) captado(s)`}>
          {dividir(gastoTotal, captados) ? <Valor valor={dividir(gastoTotal, captados)!} /> : "—"}
        </Indicador>
      </div>

      <section aria-labelledby="titulo-campanhas" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="titulo-campanhas" className="text-lg font-medium">Campanhas</h2>
          <p className="text-xs text-muted-foreground">O gasto entra em Transações como despesa na categoria Divulgação.</p>
        </div>
        {ordenadas.map((c) => (
          <CartaoCampanha key={c.id} c={c} hoje={hoje} />
        ))}
      </section>
    </div>
  );
}
