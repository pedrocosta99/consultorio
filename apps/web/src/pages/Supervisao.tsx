import { Link } from "react-router";
import { Bookmark, BookmarkCheck, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAvisos } from "@/app/avisos";
import { useDados } from "@/app/dados";
import { usePreferencias } from "@/app/preferencias";
import { CabecalhoPagina, EstadoVazio, PacienteAvatar } from "@/components/comuns";
import { capitalizar, fmt, noFuso } from "@/lib/datas";
import { Markdown } from "@/lib/markdown";

/** Reúne as notas marcadas "levar para supervisão", por paciente. */
export function PaginaSupervisao() {
  const { notas, sessoes, paciente, nomeExibicao, mutar, carregando } = useDados();
  const { fusoPrincipal } = usePreferencias();
  const { avisar, avisarErro } = useAvisos();
  const marcadas = notas.filter((n) => n.levarSupervisao);
  const porPaciente = new Map<string, typeof marcadas>();
  for (const n of [...marcadas].sort((a, b) => a.criadoEm.localeCompare(b.criadoEm))) {
    porPaciente.set(n.pacienteId, [...(porPaciente.get(n.pacienteId) ?? []), n]);
  }

  return (
    <>
      <CabecalhoPagina
        titulo="Supervisão"
        descricao={carregando ? "Carregando…" : `${marcadas.length} ${marcadas.length === 1 ? "nota" : "notas"} para levar · ${porPaciente.size} ${porPaciente.size === 1 ? "paciente" : "pacientes"}`}
      />
      {!carregando && marcadas.length === 0 ? (
        <Card className="py-0">
          <EstadoVazio
            icone={Bookmark}
            titulo="Nada para levar"
            descricao="Marque “Levar para supervisão” numa nota e ela aparece aqui, agrupada por paciente."
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {[...porPaciente.entries()].map(([pid, lista]) => {
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
                  {lista.map((n) => {
                    const s = n.sessaoId ? sessoes.find((x) => x.id === n.sessaoId) : undefined;
                    return (
                      <li key={n.id}>
                        <Card className="gap-2 px-4 py-3 shadow-none">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">{capitalizar(fmt(noFuso(s?.inicio ?? n.criadoEm, fusoPrincipal), "EEEE, d 'de' MMMM"))}</span>
                            {n.tags.map((t) => (
                              <span key={t}>#{t}</span>
                            ))}
                            <Button
                              variant="outline"
                              size="sm"
                              className="ml-auto h-7"
                              onClick={() =>
                                mutar("PATCH", `/notas/${n.id}`, { levarSupervisao: false })
                                  .then(() => avisar("Marcada como discutida."))
                                  .catch(avisarErro)
                              }
                            >
                              <BookmarkCheck aria-hidden /> Discutida
                            </Button>
                          </div>
                          <Markdown texto={n.texto} className="flex flex-col gap-1.5 text-sm leading-relaxed" />
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
