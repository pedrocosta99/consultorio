import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  FUSO_CONSULTORIO,
  lerCentavos,
  MEIOS_PAGAMENTO,
  pagamentoEntradaSchema,
  ROTULO_ESTADO,
  ROTULO_MEIO,
  sessaoCobravel,
  type Moeda,
  type Pagamento,
} from "@consultorio/shared";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAvisos } from "@/app/avisos";
import { useDados } from "@/app/dados";
import { usePreferencias } from "@/app/preferencias";
import { Valor } from "@/components/comuns";
import { capitalizar, chaveDia, fmt, hora, noFuso } from "@/lib/datas";
import { contratoVigente } from "@/lib/pacientes";
import { Campo, CampoDinheiro, SeletorSimples, textoDeDinheiro } from "./campos";

export function DialogoPagamento({ aberto, aoFechar, pacienteId: fixo }: { aberto: boolean; aoFechar: () => void; pacienteId?: string }) {
  const { pacientes, sessoes, contas, contratos, mutar, nomeExibicao, saldoPaciente } = useDados();
  const { fusoPrincipal } = usePreferencias();
  const { avisar } = useAvisos();
  const hoje = chaveDia(new Date(), FUSO_CONSULTORIO);

  const [pacienteId, setPacienteId] = useState(fixo ?? "");
  const [valor, setValor] = useState<{ texto: string; moeda: Moeda }>({ texto: "", moeda: "BRL" });
  const [data, setData] = useState(hoje);
  const [meio, setMeio] = useState<Pagamento["meio"]>("pix");
  const [contaId, setContaId] = useState("");
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const emAberto = useMemo(
    () =>
      sessoes
        .filter((s) => s.pacienteId === pacienteId && sessaoCobravel(s.estado) && !s.pago && s.valor.moeda === valor.moeda && Date.parse(s.inicio) <= Date.now())
        .sort((a, b) => a.inicio.localeCompare(b.inicio)),
    [sessoes, pacienteId, valor.moeda],
  );
  const contasDaMoeda = contas.filter((c) => c.ativa && c.moeda === valor.moeda);

  // Ao escolher o paciente: moeda do contrato e valor = saldo devido nessa moeda; marca as sessões em aberto.
  const prepararPara = (id: string) => {
    const k = contratoVigente(contratos, id);
    const moeda = k?.valor.moeda ?? "BRL";
    const devido = saldoPaciente(id).find((v) => v.moeda === moeda && v.centavos > 0);
    setValor(devido ? textoDeDinheiro(devido) : { texto: "", moeda });
    setMeio(moeda === "BRL" ? "pix" : "transferencia");
    const abertas = sessoes.filter((s) => s.pacienteId === id && sessaoCobravel(s.estado) && !s.pago && s.valor.moeda === moeda && Date.parse(s.inicio) <= Date.now());
    setMarcadas(new Set(abertas.map((s) => s.id)));
  };

  useEffect(() => {
    if (!aberto) return;
    setPacienteId(fixo ?? "");
    setData(hoje);
    setErro(null);
    if (fixo) prepararPara(fixo);
    else {
      setValor({ texto: "", moeda: "BRL" });
      setMarcadas(new Set());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, fixo]);

  useEffect(() => {
    if (!contasDaMoeda.some((c) => c.id === contaId)) setContaId(contasDaMoeda.find((c) => c.tipo === "corrente")?.id ?? contasDaMoeda[0]?.id ?? "");
  }, [contasDaMoeda, contaId]);

  const somaMarcadas = emAberto.filter((s) => marcadas.has(s.id)).reduce((t, s) => t + s.valor.centavos, 0);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    if (!pacienteId) return setErro("Escolha o paciente.");
    const centavos = lerCentavos(valor.texto);
    if (centavos === null) return setErro("Informe o valor.");
    const r = pagamentoEntradaSchema.safeParse({
      pacienteId,
      valor: { centavos, moeda: valor.moeda },
      data,
      meio,
      contaId,
      sessaoIds: emAberto.filter((s) => marcadas.has(s.id)).map((s) => s.id),
    });
    if (!r.success) return setErro(r.error.issues[0]!.message);
    setEnviando(true);
    try {
      await mutar("POST", "/pagamentos", r.data);
      avisar("Pagamento registrado.");
      aoFechar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl font-medium">Registrar pagamento</DialogTitle>
          <DialogDescription>Marque quais sessões ele quita. Valor diferente da soma vira crédito ou fica em aberto.</DialogDescription>
        </DialogHeader>
        <form onSubmit={enviar} className="flex flex-col gap-4" noValidate>
          {!fixo && (
            <Campo rotulo="Paciente">
              {(id) => (
                <SeletorSimples
                  id={id}
                  valor={pacienteId}
                  aoMudar={(v) => {
                    setPacienteId(v);
                    prepararPara(v);
                  }}
                  opcoes={pacientes.map((p) => [p.id, nomeExibicao(p)] as const)}
                />
              )}
            </Campo>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Valor" ajuda={somaMarcadas > 0 && lerCentavos(valor.texto) !== somaMarcadas ? "Diferente da soma das sessões marcadas." : undefined}>
              {(id, d) => <CampoDinheiro id={id} descricaoId={d} valor={valor} aoMudar={setValor} />}
            </Campo>
            <Campo rotulo="Data">{(id) => <Input id={id} type="date" value={data} onChange={(e) => setData(e.target.value)} />}</Campo>
            <Campo rotulo="Meio">{(id) => <SeletorSimples id={id} valor={meio} aoMudar={setMeio} opcoes={MEIOS_PAGAMENTO.map((m) => [m, ROTULO_MEIO[m]] as const)} />}</Campo>
            <Campo rotulo="Entrou na conta" erro={contasDaMoeda.length === 0 ? `Nenhuma conta em ${valor.moeda}. Crie uma em Configurações.` : null}>
              {(id) => (
                <SeletorSimples
                  id={id}
                  valor={contaId}
                  aoMudar={setContaId}
                  opcoes={contasDaMoeda.map((c) => [c.id, `${c.instituicao} · ${c.nome}`] as const)}
                />
              )}
            </Campo>
          </div>

          {pacienteId && (
            <fieldset className="rounded-lg border">
              <legend className="sr-only">Sessões em aberto</legend>
              <div className="flex items-center justify-between border-b px-3 py-2 text-xs text-muted-foreground">
                <span>Sessões em aberto em {valor.moeda}</span>
                {emAberto.length > 0 && (
                  <span>
                    Marcadas: <Valor valor={{ centavos: somaMarcadas, moeda: valor.moeda }} className="font-medium text-foreground" />
                  </span>
                )}
              </div>
              {emAberto.length === 0 ? (
                <p className="px-3 py-3 text-sm text-muted-foreground">Nenhuma. O pagamento fica como crédito.</p>
              ) : (
                <ul className="max-h-52 divide-y overflow-y-auto">
                  {emAberto.map((s) => (
                    <li key={s.id}>
                      <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-muted/50">
                        <input
                          type="checkbox"
                          className="size-4 accent-[var(--primary)]"
                          checked={marcadas.has(s.id)}
                          onChange={(e) =>
                            setMarcadas((m) => {
                              const n = new Set(m);
                              if (e.target.checked) n.add(s.id);
                              else n.delete(s.id);
                              return n;
                            })
                          }
                        />
                        <span className="flex-1">
                          {capitalizar(fmt(noFuso(s.inicio, fusoPrincipal), "EEE, d MMM"))} <span className="text-muted-foreground tabular">{hora(s.inicio, fusoPrincipal)}</span>
                          <span className="ml-2 text-xs text-muted-foreground">{ROTULO_ESTADO[s.estado]}</span>
                        </span>
                        <Valor valor={s.valor} />
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </fieldset>
          )}

          {erro && (
            <p className="text-sm text-destructive" role="alert">
              {erro}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={aoFechar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={enviando || contasDaMoeda.length === 0}>
              {enviando ? "Salvando…" : "Registrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
