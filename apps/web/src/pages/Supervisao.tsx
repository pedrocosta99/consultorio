import { useState } from "react";
import { Link } from "react-router";
import { Bookmark, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useDados } from "@/app/dados";
import { usePreferencias } from "@/app/preferencias";
import { CabecalhoPagina, EstadoVazio, PacienteAvatar } from "@/components/comuns";
import { DiscussaoSupervisao } from "@/components/notas/DiscussaoSupervisao";
import { capitalizar, fmt, noFuso } from "@/lib/datas";
import { Markdown } from "@/lib/markdown";

type Aba = "levar" | "discutidas";

/**
 * Notas marcadas "levar para supervisão", por paciente. Cada uma tem a parte
 * "Discutido em supervisão"; marcada como discutida, passa para a outra aba.
 */
export function PaginaSupervisao() {
  const { notas, sessoes, paciente, nomeExibicao, carregando } = useDados();
  const { fusoPrincipal } = usePreferencias();
  const [aba, setAba] = useState<Aba>("levar");
  const marcadas = notas.filter((n) => n.levarSupervisao);
  const aLevar = marcadas.filter((n) => !n.supervisaoEm);
  const discutidas = marcadas.filter((n) => n.supervisaoEm);
  const lista = aba === "levar" ? aLevar : discutidas;

  // A levar: mais antigas primeiro. Discutidas: discussão mais recente primeiro.
  const ordenadas = [...lista].sort((a, b) => (aba === "levar" ? a.criadoEm.localeCompare(b.criadoEm) : (b.supervisaoEm ?? "").localeCompare(a.supervisaoEm ?? "")));
  const porPaciente = new Map<string, typeof lista>();
  for (const n of ordenadas) porPaciente.set(n.pacienteId, [...(porPaciente.get(n.pacienteId) ?? []), n]);

  return (
    <>
      <CabecalhoPagina
        titulo="Supervisão"
        descricao={
          carregando
            ? "Carregando…"
            : `${aLevar.length} ${aLevar.length === 1 ? "nota" : "notas"} para levar · ${discutidas.length} ${discutidas.length === 1 ? "discutida" : "discutidas"}`
        }
        acoes={
          <ToggleGroup type="single" variant="outline" value={aba} onValueChange={(v) => v && setAba(v as Aba)} aria-label="Notas de supervisão">
            <ToggleGroupItem value="levar" className="px-3">
              A levar <span className="ml-1 tabular text-muted-foreground">{aLevar.length}</span>
            </ToggleGroupItem>
            <ToggleGroupItem value="discutidas" className="px-3">
              Discutidas <span className="ml-1 tabular text-muted-foreground">{discutidas.length}</span>
            </ToggleGroupItem>
          </ToggleGroup>
        }
      />
      {!carregando && lista.length === 0 ? (
        <Card className="py-0">
          <EstadoVazio
            icone={Bookmark}
            titulo={aba === "levar" ? "Nada para levar" : "Nenhuma discutida ainda"}
            descricao={
              aba === "levar"
                ? "Marque “Levar para supervisão” numa nota e ela aparece aqui, agrupada por paciente."
                : "Depois da supervisão, anote o que foi discutido e clique em “Discutida”."
            }
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {[...porPaciente.entries()].map(([pid, doPaciente]) => {
            const p = paciente(pid);
            return (
              <section key={pid} aria-labelledby={`sup-${pid}`}>
                <div className="mb-2 flex items-center gap-3">
                  {p && <PacienteAvatar paciente={p} className="size-8 text-xs" />}
                  <h2 id={`sup-${pid}`} className="font-serif text-xl font-medium">
                    {nomeExibicao(p)}
                  </h2>
                  <Button asChild variant="ghost" size="sm" className="ml-auto">
                    <Link to={`/pacientes/${pid}?aba=notas`}>
                      Ver ficha <ExternalLink aria-hidden />
                    </Link>
                  </Button>
                </div>
                <ul className="flex flex-col gap-3">
                  {doPaciente.map((n) => {
                    const s = n.sessaoId ? sessoes.find((x) => x.id === n.sessaoId) : undefined;
                    return (
                      <li key={n.id}>
                        <Card className="gap-3 px-4 py-3 shadow-none">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">{capitalizar(fmt(noFuso(s?.inicio ?? n.criadoEm, fusoPrincipal), "EEEE, d 'de' MMMM"))}</span>
                            {n.tags.map((t) => (
                              <span key={t}>#{t}</span>
                            ))}
                          </div>
                          <Markdown texto={n.texto} className="flex flex-col gap-1.5 text-sm leading-relaxed" />
                          <DiscussaoSupervisao nota={n} />
                        </Card>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
