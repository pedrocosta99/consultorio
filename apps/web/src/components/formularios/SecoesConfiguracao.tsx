import { useState, type FormEvent } from "react";
import { CalendarOff, Landmark, Plus, Trash2 } from "lucide-react";
import { feriadoEntradaSchema, MOEDAS, TIPOS_CONTA, type Conta, type Moeda } from "@consultorio/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAvisos } from "@/app/avisos";
import { useDados } from "@/app/dados";
import { fmt } from "@/lib/datas";
import { Campo, SeletorSimples } from "./campos";

const ROTULO_TIPO_CONTA: Record<Conta["tipo"], string> = {
  corrente: "Conta corrente",
  poupanca: "Poupança",
  cartao: "Cartão",
  investimento: "Investimentos",
  dinheiro: "Dinheiro vivo",
};

export function SecaoFeriados() {
  const { feriados, mutar } = useDados();
  const { avisar, avisarErro } = useAvisos();
  const [data, setData] = useState("");
  const [descricao, setDescricao] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const adicionar = async (e: FormEvent) => {
    e.preventDefault();
    const r = feriadoEntradaSchema.safeParse({ data, descricao });
    if (!r.success) return setErro(r.error.issues[0]!.message);
    setErro(null);
    try {
      await mutar("POST", "/feriados", r.data);
      setData("");
      setDescricao("");
      avisar("Folga adicionada. As sessões geradas nesse dia saíram da agenda.");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não deu certo.");
    }
  };

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2 font-serif text-lg font-medium">
          <CalendarOff className="size-4 text-muted-foreground" aria-hidden /> Feriados e folgas
        </CardTitle>
        <CardDescription>Nesses dias a grade fixa não gera sessão.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form onSubmit={adicionar} className="grid items-end gap-3 sm:grid-cols-[10rem_1fr_auto]" noValidate>
          <Campo rotulo="Data">{(id) => <Input id={id} type="date" value={data} onChange={(e) => setData(e.target.value)} />}</Campo>
          <Campo rotulo="Descrição">{(id) => <Input id={id} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Natal, férias, congresso…" />}</Campo>
          <Button type="submit" variant="outline">
            <Plus aria-hidden /> Adicionar
          </Button>
        </form>
        {erro && (
          <p className="text-sm text-destructive" role="alert">
            {erro}
          </p>
        )}
        {feriados.length > 0 && (
          <ul className="divide-y rounded-lg border">
            {feriados.map((f) => (
              <li key={f.data} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="w-28 tabular">{fmt(new Date(f.data + "T12:00:00"), "dd/MM/yyyy")}</span>
                <span className="flex-1 text-muted-foreground">{f.descricao}</span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remover ${f.descricao}`}
                  onClick={() =>
                    mutar("DELETE", `/feriados/${f.data}`)
                      .then(() => avisar("Folga removida; a grade voltou a gerar sessões nesse dia."))
                      .catch(avisarErro)
                  }
                >
                  <Trash2 aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function SecaoContas() {
  const { contas, mutar } = useDados();
  const { avisar } = useAvisos();
  const [nome, setNome] = useState("");
  const [instituicao, setInstituicao] = useState("");
  const [moeda, setMoeda] = useState<Moeda>("BRL");
  const [tipo, setTipo] = useState<Conta["tipo"]>("corrente");
  const [erro, setErro] = useState<string | null>(null);

  const adicionar = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    try {
      await mutar("POST", "/contas", { nome, instituicao, moeda, tipo, pais: moeda === "BRL" ? "BR" : moeda === "USD" ? "US" : "BE" });
      setNome("");
      setInstituicao("");
      avisar("Conta criada.");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não deu certo.");
    }
  };

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2 font-serif text-lg font-medium">
          <Landmark className="size-4 text-muted-foreground" aria-hidden /> Contas que recebem pagamentos
        </CardTitle>
        <CardDescription>Cada pagamento de paciente entra numa conta da mesma moeda. A gestão completa de contas vem com Finanças (Fase 3).</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ul className="divide-y rounded-lg border">
          {contas.map((c) => (
            <li key={c.id} className="flex items-center gap-3 px-3 py-2 text-sm">
              <span className="flex-1">
                {c.instituicao} · {c.nome}
              </span>
              <span className="text-xs text-muted-foreground">{ROTULO_TIPO_CONTA[c.tipo]}</span>
              <span className="w-10 text-right text-xs font-medium tabular">{c.moeda}</span>
            </li>
          ))}
        </ul>
        <form onSubmit={adicionar} className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_7rem_10rem_auto]" noValidate>
          <Campo rotulo="Nome">{(id) => <Input id={id} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Conta corrente" />}</Campo>
          <Campo rotulo="Instituição">{(id) => <Input id={id} value={instituicao} onChange={(e) => setInstituicao(e.target.value)} placeholder="Banco" />}</Campo>
          <Campo rotulo="Moeda">{(id) => <SeletorSimples id={id} valor={moeda} aoMudar={setMoeda} opcoes={MOEDAS.map((m) => [m, m] as const)} />}</Campo>
          <Campo rotulo="Tipo">{(id) => <SeletorSimples id={id} valor={tipo} aoMudar={setTipo} opcoes={TIPOS_CONTA.map((t) => [t, ROTULO_TIPO_CONTA[t]] as const)} />}</Campo>
          <Button type="submit" variant="outline">
            <Plus aria-hidden /> Criar
          </Button>
        </form>
        {erro && (
          <p className="text-sm text-destructive" role="alert">
            {erro}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
