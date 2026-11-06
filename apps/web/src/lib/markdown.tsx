/**
 * Markdown mínimo e seguro para notas: títulos (#), listas (- / 1.), **negrito**,
 * *itálico*, `código` e parágrafos. Gera elementos React — nunca HTML cru — então
 * o texto da nota não consegue injetar nada na página.
 */
import { Fragment, type ReactNode } from "react";

function inline(texto: string, chave: string, destacar?: boolean): ReactNode[] {
  // [[termo]] = destaque de busca; **x**; *x* ou _x_; `x`
  const re = destacar ? /(\[\[[^\]]+\]\]|\*\*[^*]+\*\*|\*[^*\s][^*]*\*|_[^_\s][^_]*_|`[^`]+`)/g : /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|_[^_\s][^_]*_|`[^`]+`)/g;
  return texto.split(re).map((parte, i) => {
    const k = `${chave}-${i}`;
    if (destacar && parte.startsWith("[[") && parte.endsWith("]]")) return <mark key={k} className="rounded-sm bg-[var(--st-falta-bg)] px-0.5 text-foreground">{parte.slice(2, -2)}</mark>;
    if (parte.startsWith("**") && parte.endsWith("**") && parte.length > 4) return <strong key={k}>{parte.slice(2, -2)}</strong>;
    if ((parte.startsWith("*") && parte.endsWith("*")) || (parte.startsWith("_") && parte.endsWith("_"))) return parte.length > 2 ? <em key={k}>{parte.slice(1, -1)}</em> : parte;
    if (parte.startsWith("`") && parte.endsWith("`") && parte.length > 2) return <code key={k} className="rounded bg-muted px-1 text-[0.9em]">{parte.slice(1, -1)}</code>;
    return <Fragment key={k}>{parte}</Fragment>;
  });
}

/** Só o inline (para trechos de busca com [[destaque]]). */
export function TextoInline({ texto, destacar }: { texto: string; destacar?: boolean }) {
  return <>{inline(texto, "t", destacar)}</>;
}

export function Markdown({ texto, className }: { texto: string; className?: string }) {
  const linhas = texto.replace(/\r\n/g, "\n").split("\n");
  const blocos: ReactNode[] = [];
  let i = 0;
  while (i < linhas.length) {
    const l = linhas[i]!;
    if (!l.trim()) {
      i++;
      continue;
    }
    const titulo = /^(#{1,3})\s+(.*)$/.exec(l);
    if (titulo) {
      blocos.push(
        <p key={i} className="font-semibold">
          {inline(titulo[2]!, `h${i}`)}
        </p>,
      );
      i++;
      continue;
    }
    if (/^\s*([-*]|\d+[.)])\s+/.test(l)) {
      const numerada = /^\s*\d/.test(l);
      const itens: ReactNode[] = [];
      while (i < linhas.length && /^\s*([-*]|\d+[.)])\s+/.test(linhas[i]!)) {
        itens.push(<li key={i}>{inline(linhas[i]!.replace(/^\s*([-*]|\d+[.)])\s+/, ""), `li${i}`)}</li>);
        i++;
      }
      blocos.push(
        numerada ? (
          <ol key={`l${i}`} className="list-decimal pl-5">
            {itens}
          </ol>
        ) : (
          <ul key={`l${i}`} className="list-disc pl-5">
            {itens}
          </ul>
        ),
      );
      continue;
    }
    const par: string[] = [];
    while (i < linhas.length && linhas[i]!.trim() && !/^(#{1,3}\s|\s*([-*]|\d+[.)])\s+)/.test(linhas[i]!)) par.push(linhas[i++]!);
    blocos.push(
      <p key={`p${i}`}>
        {par.map((linha, j) => (
          <Fragment key={j}>
            {j > 0 && <br />}
            {inline(linha, `p${i}-${j}`)}
          </Fragment>
        ))}
      </p>,
    );
  }
  return <div className={className ?? "flex flex-col gap-2"}>{blocos}</div>;
}
