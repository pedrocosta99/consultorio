import { Link } from "react-router";
import { ArrowLeftRight, TriangleAlert } from "lucide-react";
import type { Moeda } from "@consultorio/shared";

const NOME: Record<Moeda, string> = { BRL: "reais", USD: "dólares", EUR: "euros" };

/** Linha que explica a conversão (e avisa quando falta cotação). */
export function AvisoConversao({ alvo, semCotacao }: { alvo: Moeda | null; semCotacao: Moeda[] }) {
  if (!alvo) return null;
  return (
    <p className="flex flex-wrap items-start gap-x-2 gap-y-1 text-xs text-muted-foreground">
      <span className="flex items-start gap-2">
        <ArrowLeftRight className="mt-px size-3.5 shrink-0" aria-hidden />
        <span>Totais e gráficos convertidos para {NOME[alvo]} pela cotação do dia de cada movimento. Cada lançamento continua na moeda original.</span>
      </span>
      {semCotacao.length > 0 && (
        <span className="flex items-center gap-1 text-foreground">
          <TriangleAlert className="size-3.5" aria-hidden />
          Sem cotação para {semCotacao.join(" e ")}: esses valores aparecem à parte.{" "}
          <Link to="/configuracoes#moedas" className="underline underline-offset-2">
            Atualizar cotações
          </Link>
        </span>
      )}
    </p>
  );
}
