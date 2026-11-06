import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import {
  contratoEntradaSchema,
  FUSO_CONSULTORIO,
  lerCentavos,
  MODALIDADES,
  ORIGENS,
  pacienteEntradaSchema,
  ROTULO_MODALIDADE,
  ROTULO_ORIGEM,
  ROTULO_STATUS,
  STATUS_PACIENTE,
  type ContratoEntrada,
  type Moeda,
  type Paciente,
} from "@consultorio/shared";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useAvisos } from "@/app/avisos";
import { useDados } from "@/app/dados";
import { chaveDia, FUSOS_DISPONIVEIS, nomeFuso, offsetFuso } from "@/lib/datas";
import { Campo, CampoDinheiro, SeletorDias, SeletorSimples } from "./campos";

/** "Maria Clara Souza" → "M.C.S." */
export function iniciais(nome: string): string {
  const partes = nome
    .trim()
    .split(/\s+/)
    .filter((p) => p.length > 2 || /^[A-ZÀ-Ú]/.test(p))
    .filter((p) => !/^(da|de|do|das|dos|e)$/i.test(p));
  return partes
    .slice(0, 3)
    .map((p) => p.charAt(0).toUpperCase() + ".")
    .join("");
}

export interface GradeForm {
  diasSemana: number[];
  horario: string;
  duracaoMin: string;
  valor: { texto: string; moeda: Moeda };
  cobranca: "sessao" | "mensal";
}

export const GRADE_PADRAO: GradeForm = { diasSemana: [], horario: "", duracaoMin: "50", valor: { texto: "", moeda: "BRL" }, cobranca: "sessao" };

/** Valida a grade do formulário e devolve a entrada da API (ou o primeiro erro). */
export function validarGrade(g: GradeForm, vigenteDe: string): { ok: true; dados: ContratoEntrada } | { ok: false; erro: string } {
  const centavos = lerCentavos(g.valor.texto);
  if (centavos === null) return { ok: false, erro: "Informe o valor da sessão." };
  const r = contratoEntradaSchema.safeParse({
    diasSemana: g.diasSemana,
    horario: g.horario,
    duracaoMin: Number(g.duracaoMin),
    valor: { centavos, moeda: g.valor.moeda },
    cobranca: g.cobranca,
    vigenteDe,
  });
  return r.success ? { ok: true, dados: r.data } : { ok: false, erro: r.error.issues[0]!.message };
}

export function CamposGrade({ grade, aoMudar }: { grade: GradeForm; aoMudar: (g: GradeForm) => void }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Campo rotulo="Dias da semana" className="sm:col-span-2">
        {(id) => <SeletorDias id={id} valor={grade.diasSemana} aoMudar={(diasSemana) => aoMudar({ ...grade, diasSemana })} />}
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Horário">{(id) => <Input id={id} type="time" step={300} value={grade.horario} onChange={(e) => aoMudar({ ...grade, horario: e.target.value })} />}</Campo>
        <Campo rotulo="Duração (min)">
          {(id) => <Input id={id} type="number" min={5} max={240} value={grade.duracaoMin} onChange={(e) => aoMudar({ ...grade, duracaoMin: e.target.value })} />}
        </Campo>
      </div>
      <Campo rotulo="Valor por sessão">{(id, d) => <CampoDinheiro id={id} descricaoId={d} valor={grade.valor} aoMudar={(valor) => aoMudar({ ...grade, valor })} />}</Campo>
      <Campo rotulo="Cobrança" className="sm:col-span-2">
        {(id) => (
          <SeletorSimples
            id={id}
            valor={grade.cobranca}
            aoMudar={(cobranca) => aoMudar({ ...grade, cobranca })}
            opcoes={[
              ["sessao", "Por sessão"],
              ["mensal", "Fechamento mensal"],
            ]}
          />
        )}
      </Campo>
    </div>
  );
}

export function opcoesFuso(atual?: string): Array<readonly [string, string]> {
  const lista = FUSOS_DISPONIVEIS.includes(atual ?? "") || !atual ? FUSOS_DISPONIVEIS : [...FUSOS_DISPONIVEIS, atual];
  return lista.map((f) => [f, `${nomeFuso(f)} (${offsetFuso(f)})`] as const);
}

export function DialogoPaciente({ aberto, aoFechar, paciente }: { aberto: boolean; aoFechar: () => void; paciente?: Paciente }) {
  const { mutar } = useDados();
  const { avisar } = useAvisos();
  const navegar = useNavigate();
  const editando = !!paciente;
  const hoje = chaveDia(new Date(), FUSO_CONSULTORIO);

  const inicial = () => ({
    nome: paciente?.nome ?? "",
    apelido: paciente?.apelido ?? "",
    contato: paciente?.contato ?? "",
    origem: paciente?.origem ?? ("particular" as Paciente["origem"]),
    modalidade: paciente?.modalidade ?? ("presencial" as Paciente["modalidade"]),
    status: paciente?.status ?? ("ativo" as Paciente["status"]),
    inicioEm: paciente?.inicioEm ?? hoje,
    fuso: paciente?.fuso ?? FUSO_CONSULTORIO,
  });
  const [f, setF] = useState(inicial);
  const [apelidoManual, setApelidoManual] = useState(editando);
  const [comGrade, setComGrade] = useState(true);
  const [grade, setGrade] = useState<GradeForm>(GRADE_PADRAO);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (aberto) {
      setF(inicial());
      setApelidoManual(editando);
      setGrade(GRADE_PADRAO);
      setComGrade(true);
      setErro(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  const mudar = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) =>
    setF((atual) => ({ ...atual, [k]: v, ...(k === "nome" && !apelidoManual ? { apelido: iniciais(String(v)) } : {}) }));

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    const r = pacienteEntradaSchema.safeParse(f);
    if (!r.success) return setErro(r.error.issues[0]!.message);
    const g = !editando && comGrade ? validarGrade(grade, r.data.inicioEm > hoje ? r.data.inicioEm : hoje) : null;
    if (g && !g.ok) return setErro(g.erro);
    setEnviando(true);
    try {
      if (editando) {
        await mutar("PATCH", `/pacientes/${paciente.id}`, r.data);
        avisar("Cadastro atualizado.");
      } else {
        const { id } = await mutar<{ id: string }>("POST", "/pacientes", r.data);
        if (g?.ok) await mutar("POST", `/pacientes/${id}/contratos`, g.dados);
        avisar(g?.ok ? "Paciente cadastrado e sessões geradas pela grade." : "Paciente cadastrado.");
        navegar(`/pacientes/${id}`);
      }
      aoFechar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl font-medium">{editando ? "Editar cadastro" : "Novo paciente"}</DialogTitle>
          <DialogDescription>Use só o necessário. Um pseudônimo serve como nome.</DialogDescription>
        </DialogHeader>
        <form onSubmit={enviar} className="flex flex-col gap-5" noValidate>
          <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
            <Campo rotulo="Nome (ou pseudônimo)">{(id) => <Input id={id} value={f.nome} onChange={(e) => mudar("nome", e.target.value)} autoFocus autoComplete="off" />}</Campo>
            <Campo rotulo="Iniciais" ajuda="Modo discreto">
              {(id, d) => (
                <Input
                  id={id}
                  aria-describedby={d}
                  value={f.apelido}
                  maxLength={24}
                  onChange={(e) => {
                    setApelidoManual(true);
                    mudar("apelido", e.target.value);
                  }}
                  autoComplete="off"
                />
              )}
            </Campo>
            <Campo rotulo="Contato" ajuda="Telefone, e-mail… (opcional)" className="sm:col-span-2">
              {(id, d) => <Input id={id} aria-describedby={d} value={f.contato} onChange={(e) => mudar("contato", e.target.value)} autoComplete="off" />}
            </Campo>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Origem">{(id) => <SeletorSimples id={id} valor={f.origem} aoMudar={(v) => mudar("origem", v)} opcoes={ORIGENS.map((o) => [o, ROTULO_ORIGEM[o]] as const)} />}</Campo>
            <Campo rotulo="Modalidade">
              {(id) => <SeletorSimples id={id} valor={f.modalidade} aoMudar={(v) => mudar("modalidade", v)} opcoes={MODALIDADES.map((o) => [o, ROTULO_MODALIDADE[o]] as const)} />}
            </Campo>
            <Campo rotulo="Início">{(id) => <Input id={id} type="date" value={f.inicioEm} onChange={(e) => mudar("inicioEm", e.target.value)} />}</Campo>
            <Campo rotulo="Fuso do paciente">{(id) => <SeletorSimples id={id} valor={f.fuso} aoMudar={(v) => mudar("fuso", v)} opcoes={opcoesFuso(f.fuso)} />}</Campo>
            {editando && (
              <Campo rotulo="Status" ajuda={f.status !== "ativo" && paciente?.status === "ativo" ? "As sessões futuras agendadas serão removidas." : undefined}>
                {(id, d) => (
                  <div aria-describedby={d}>
                    <SeletorSimples id={id} valor={f.status} aoMudar={(v) => mudar("status", v)} opcoes={STATUS_PACIENTE.map((o) => [o, ROTULO_STATUS[o]] as const)} />
                  </div>
                )}
              </Campo>
            )}
          </div>

          {!editando && (
            <fieldset className="flex flex-col gap-4 rounded-lg border p-4">
              <div className="flex items-center justify-between gap-3">
                <legend className="contents">
                  <Label htmlFor="com-grade" className="text-sm font-medium">
                    Horário fixo
                  </Label>
                </legend>
                <Switch id="com-grade" checked={comGrade} onCheckedChange={setComGrade} />
              </div>
              {comGrade && <CamposGrade grade={grade} aoMudar={setGrade} />}
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
            <Button type="submit" disabled={enviando}>
              {enviando ? "Salvando…" : editando ? "Salvar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
