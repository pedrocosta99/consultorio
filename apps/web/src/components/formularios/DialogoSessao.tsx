import { useEffect, useState, type FormEvent } from "react";
import { lerCentavos, sessaoAvulsaSchema, type Moeda } from "@consultorio/shared";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAvisos } from "@/app/avisos";
import { useDados } from "@/app/dados";
import { usePreferencias } from "@/app/preferencias";
import { chaveDia, instanteEm, nomeFuso } from "@/lib/datas";
import { contratoVigente } from "@/lib/pacientes";
import { Campo, CampoDinheiro, SeletorSimples, textoDeDinheiro } from "./campos";

/**
 * Sessão fora da grade fixa: primeira entrevista, sessão extra, reposição.
 * Valor e duração vêm do contrato vigente, se houver.
 */
export interface SessaoInicial {
  /** "yyyy-MM-dd" */
  data: string;
  /** "HH:mm" no fuso principal */
  horario: string;
  /** Duração escolhida ao arrastar na agenda; sem ela, vale a do contrato. */
  duracaoMin?: number;
}

export function DialogoSessao({
  aberto,
  aoFechar,
  pacienteId: fixo,
  inicial,
}: {
  aberto: boolean;
  aoFechar: () => void;
  pacienteId?: string;
  inicial?: SessaoInicial | null;
}) {
  const { pacientes, contratos, mutar, nomeExibicao } = useDados();
  const { fusoPrincipal } = usePreferencias();
  const { avisar } = useAvisos();
  const [pacienteId, setPacienteId] = useState(fixo ?? "");
  const [data, setData] = useState("");
  const [horario, setHorario] = useState("");
  const [duracao, setDuracao] = useState("50");
  const [valor, setValor] = useState<{ texto: string; moeda: Moeda }>({ texto: "", moeda: "BRL" });
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const prepararPara = (id: string) => {
    const k = contratoVigente(contratos, id);
    setValor(textoDeDinheiro(k?.valor));
    setDuracao(String(inicial?.duracaoMin ?? k?.duracaoMin ?? 50));
  };

  useEffect(() => {
    if (!aberto) return;
    setPacienteId(fixo ?? "");
    setData(inicial?.data ?? chaveDia(new Date(), fusoPrincipal));
    setHorario(inicial?.horario ?? "");
    setErro(null);
    if (fixo) prepararPara(fixo);
    else {
      setValor({ texto: "", moeda: "BRL" });
      setDuracao(String(inicial?.duracaoMin ?? 50));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, fixo]);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    if (!pacienteId) return setErro("Escolha o paciente.");
    if (!data || !horario) return setErro("Informe data e hora.");
    const centavos = lerCentavos(valor.texto || "0");
    if (centavos === null) return setErro("Valor inválido.");
    const [a, m, d] = data.split("-").map(Number) as [number, number, number];
    const [h, min] = horario.split(":").map(Number) as [number, number];
    const r = sessaoAvulsaSchema.safeParse({
      pacienteId,
      inicio: instanteEm(new Date(a, m - 1, d), h * 60 + min, fusoPrincipal).toISOString(),
      duracaoMin: Number(duracao),
      valor: { centavos, moeda: valor.moeda },
    });
    if (!r.success) return setErro(r.error.issues[0]!.message);
    setEnviando(true);
    try {
      await mutar("POST", "/sessoes", r.data);
      avisar("Sessão marcada na agenda.");
      aoFechar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setEnviando(false);
    }
  };

  const opcoes = pacientes.filter((p) => p.status === "ativo" || p.status === "pausa" || p.id === fixo);

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl font-medium">Sessão avulsa</DialogTitle>
          <DialogDescription>Fora do horário fixo: primeira entrevista, sessão extra, reposição.</DialogDescription>
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
                  opcoes={opcoes.map((p) => [p.id, nomeExibicao(p)] as const)}
                />
              )}
            </Campo>
          )}
          <div className="grid grid-cols-[1fr_7.5rem] gap-3">
            <Campo rotulo="Data">{(id) => <Input id={id} type="date" value={data} onChange={(e) => setData(e.target.value)} />}</Campo>
            <Campo rotulo={`Hora (${nomeFuso(fusoPrincipal)})`}>
              {(id) => <Input id={id} type="time" step={900} value={horario} onChange={(e) => setHorario(e.target.value)} />}
            </Campo>
          </div>
          <div className="grid grid-cols-[1fr_7.5rem] gap-3">
            <Campo rotulo="Valor" ajuda="Zero para sessão sem cobrança.">
              {(id, d) => <CampoDinheiro id={id} descricaoId={d} valor={valor} aoMudar={setValor} />}
            </Campo>
            <Campo rotulo="Duração (min)">
              {(id) => <Input id={id} type="number" min={5} max={240} step={5} inputMode="numeric" value={duracao} onChange={(e) => setDuracao(e.target.value)} />}
            </Campo>
          </div>
          {erro && (
            <p className="text-sm text-destructive" role="alert">
              {erro}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={aoFechar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={enviando}>
              {enviando ? "Salvando…" : "Marcar sessão"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
