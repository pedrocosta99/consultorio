import { useState, type FormEvent } from "react";
import {
  CATEGORIAS_COMPROMISSO,
  compromissoEntradaSchema,
  diaIso,
  escreverRegra,
  lerRegra,
  type TipoCompromisso,
} from "@consultorio/shared";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { usePreferencias } from "@/app/preferencias";
import { instanteEm, nomeFuso } from "@/lib/datas";
import { Campo, SeletorDias, SeletorSimples } from "./campos";

type Repeticao = "nao" | "dia" | "semana" | "quinzena" | "mes";
const REPETICOES: Array<readonly [Repeticao, string]> = [
  ["nao", "Não se repete"],
  ["dia", "Todo dia"],
  ["semana", "Toda semana"],
  ["quinzena", "A cada 2 semanas"],
  ["mes", "Todo mês"],
];

export interface ValoresCompromisso {
  tipo: TipoCompromisso;
  titulo: string;
  categoria: string;
  inicio: string;
  duracaoMin: number;
  recorrencia: string | null;
}

export interface CompromissoInicial {
  tipo: TipoCompromisso;
  titulo?: string;
  categoria?: string;
  /** "yyyy-MM-dd" */
  data: string;
  /** "HH:mm" no fuso principal */
  horario: string;
  duracaoMin: number;
  recorrencia?: string | null;
}

function lerRepeticao(rrule: string | null | undefined): { rep: Repeticao; dias: number[]; ate: string } {
  if (!rrule) return { rep: "nao", dias: [], ate: "" };
  const r = lerRegra(rrule);
  const rep: Repeticao = r.freq === "DAILY" ? "dia" : r.freq === "MONTHLY" ? "mes" : r.intervalo >= 2 ? "quinzena" : "semana";
  return { rep, dias: r.dias, ate: r.ate ?? "" };
}

/**
 * Compromisso (supervisão, análise, reunião…) ou bloqueio (folga, horário pessoal).
 * Não grava sozinho: entrega os valores para quem chamou (criar, ou perguntar o
 * alcance de uma edição).
 */
export function FormCompromisso({
  inicial,
  rotuloEnviar,
  aoEnviar,
  aoCancelar,
}: {
  inicial: CompromissoInicial;
  rotuloEnviar: string;
  aoEnviar: (v: ValoresCompromisso) => Promise<void>;
  aoCancelar: () => void;
}) {
  const { fusoPrincipal } = usePreferencias();
  const bloqueio = inicial.tipo === "bloqueio";
  const rep0 = lerRepeticao(inicial.recorrencia);
  const [titulo, setTitulo] = useState(inicial.titulo ?? (bloqueio ? "Ocupado" : ""));
  const [categoria, setCategoria] = useState(inicial.categoria ?? "");
  const [data, setData] = useState(inicial.data);
  const [horario, setHorario] = useState(inicial.horario);
  const [duracao, setDuracao] = useState(String(inicial.duracaoMin));
  const [repeticao, setRepeticao] = useState<Repeticao>(rep0.rep);
  const [dias, setDias] = useState<number[]>(rep0.dias.length ? rep0.dias : [diaIso(inicial.data)]);
  const [ate, setAte] = useState(rep0.ate);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const regra = (): string | null => {
    if (repeticao === "nao") return null;
    const freq = repeticao === "dia" ? "DAILY" : repeticao === "mes" ? "MONTHLY" : "WEEKLY";
    return escreverRegra({
      freq,
      intervalo: repeticao === "quinzena" ? 2 : 1,
      dias: freq === "WEEKLY" ? (dias.length ? dias : [diaIso(data)]) : [],
      ate: ate || null,
      vezes: null,
    });
  };

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    if (!data || !horario) return setErro("Informe data e hora.");
    if (ate && ate < data) return setErro("O fim da repetição não pode ser antes do início.");
    const [a, m, d] = data.split("-").map(Number) as [number, number, number];
    const [h, min] = horario.split(":").map(Number) as [number, number];
    const r = compromissoEntradaSchema.safeParse({
      tipo: inicial.tipo,
      titulo,
      categoria,
      inicio: instanteEm(new Date(a, m - 1, d), h * 60 + min, fusoPrincipal).toISOString(),
      duracaoMin: Number(duracao),
      recorrencia: regra(),
    });
    if (!r.success) return setErro(r.error.issues[0]!.message);
    setEnviando(true);
    try {
      await aoEnviar({ ...r.data, categoria: r.data.categoria ?? "" });
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4" noValidate>
      <Campo rotulo="Título">
        {(id) => <Input id={id} value={titulo} maxLength={80} onChange={(e) => setTitulo(e.target.value)} placeholder={bloqueio ? "Ocupado" : "Supervisão com…"} />}
      </Campo>
      {!bloqueio && (
        <Campo rotulo="Categoria" ajuda="Escolha uma sugestão ou escreva outra.">
          {(id, d) => (
            <>
              <Input id={id} aria-describedby={d} list={`${id}-sugestoes`} value={categoria} maxLength={40} onChange={(e) => setCategoria(e.target.value)} />
              <datalist id={`${id}-sugestoes`}>
                {CATEGORIAS_COMPROMISSO.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </>
          )}
        </Campo>
      )}
      <div className="grid grid-cols-[1fr_6.5rem_6rem] gap-3">
        <Campo rotulo="Data">{(id) => <Input id={id} type="date" value={data} onChange={(e) => setData(e.target.value)} />}</Campo>
        <Campo rotulo={`Hora (${nomeFuso(fusoPrincipal)})`}>
          {(id) => <Input id={id} type="time" step={900} value={horario} onChange={(e) => setHorario(e.target.value)} />}
        </Campo>
        <Campo rotulo="Duração (min)">
          {(id) => <Input id={id} type="number" min={5} max={1440} step={5} inputMode="numeric" value={duracao} onChange={(e) => setDuracao(e.target.value)} />}
        </Campo>
      </div>
      <Campo rotulo="Repetição">
        {(id) => <SeletorSimples id={id} valor={repeticao} aoMudar={(v) => setRepeticao(v as Repeticao)} opcoes={REPETICOES} />}
      </Campo>
      {(repeticao === "semana" || repeticao === "quinzena") && (
        <Campo rotulo="Nos dias">{(id) => <SeletorDias id={id} valor={dias} aoMudar={setDias} />}</Campo>
      )}
      {repeticao !== "nao" && (
        <Campo rotulo="Até" ajuda="Vazio = sem data para terminar.">
          {(id, d) => <Input id={id} aria-describedby={d} type="date" value={ate} min={data} onChange={(e) => setAte(e.target.value)} />}
        </Campo>
      )}
      {erro && (
        <p className="text-sm text-destructive" role="alert">
          {erro}
        </p>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={aoCancelar}>
          Cancelar
        </Button>
        <Button type="submit" disabled={enviando}>
          {enviando ? "Salvando…" : rotuloEnviar}
        </Button>
      </DialogFooter>
    </form>
  );
}
