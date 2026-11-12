import { useEffect, useId, useMemo, useState, type FormEvent } from "react";
import { CATEGORIAS_ENTRADA, CATEGORIAS_SAIDA, FUSO_CONSULTORIO, lancamentoEntradaSchema, lerCentavos, type Lancamento, type Moeda } from "@consultorio/shared";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useAvisos } from "@/app/avisos";
import { useDados } from "@/app/dados";
import { chaveDia } from "@/lib/datas";
import { Campo, CampoDinheiro, DialogoConfirmacao, textoDeDinheiro } from "./campos";

/** Novo lançamento (sem `atual`) ou edição. */
export function DialogoLancamento({ aberto, aoFechar, atual }: { aberto: boolean; aoFechar: () => void; atual?: Lancamento }) {
  const { lancamentos, mutar } = useDados();
  const { avisar } = useAvisos();
  const listaId = useId();

  const [tipo, setTipo] = useState<Lancamento["tipo"]>("saida");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState<{ texto: string; moeda: Moeda }>({ texto: "", moeda: "BRL" });
  const [data, setData] = useState("");
  const [categoria, setCategoria] = useState("");
  const [fixo, setFixo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setTipo(atual?.tipo ?? "saida");
    setDescricao(atual?.descricao ?? "");
    setValor(textoDeDinheiro(atual?.valor));
    setData(atual?.data ?? chaveDia(new Date(), FUSO_CONSULTORIO));
    setCategoria(atual?.categoria ?? "");
    setFixo(atual?.fixo ?? false);
    setErro(null);
  }, [aberto, atual]);

  // Sugestões: as padrão + as que você já usou nesse sentido.
  const sugestoes = useMemo(() => {
    const padrao: readonly string[] = tipo === "saida" ? CATEGORIAS_SAIDA : CATEGORIAS_ENTRADA;
    return [...new Set([...padrao, ...lancamentos.filter((l) => l.tipo === tipo).map((l) => l.categoria)])];
  }, [tipo, lancamentos]);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    const centavos = lerCentavos(valor.texto);
    if (centavos === null) return setErro("Informe o valor.");
    const r = lancamentoEntradaSchema.safeParse({ tipo, descricao, valor: { centavos, moeda: valor.moeda }, data, categoria, fixo });
    if (!r.success) return setErro(r.error.issues[0]!.message);
    setEnviando(true);
    try {
      if (atual) await mutar("PATCH", `/lancamentos/${atual.id}`, r.data);
      else await mutar("POST", "/lancamentos", r.data);
      avisar(atual ? "Lançamento atualizado." : "Lançamento criado.");
      aoFechar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <Dialog open={aberto && !confirmarExclusao} onOpenChange={(v) => !v && aoFechar()}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl font-medium">{atual ? "Editar lançamento" : "Novo lançamento"}</DialogTitle>
            <DialogDescription>Os pagamentos de pacientes já entram sozinhos. Aqui vai o resto: sala, supervisão, um repasse…</DialogDescription>
          </DialogHeader>
          <form onSubmit={enviar} className="flex flex-col gap-4" noValidate>
            <ToggleGroup
              type="single"
              variant="outline"
              value={tipo}
              onValueChange={(v) => v && setTipo(v as Lancamento["tipo"])}
              className="w-full"
              aria-label="Tipo de lançamento"
            >
              <ToggleGroupItem value="saida" className="flex-1 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                Saída
              </ToggleGroupItem>
              <ToggleGroupItem value="entrada" className="flex-1 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                Entrada
              </ToggleGroupItem>
            </ToggleGroup>
            <Campo rotulo="Descrição">
              {(id) => <Input id={id} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder={tipo === "saida" ? "Aluguel da sala" : "Palestra, repasse…"} />}
            </Campo>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo rotulo="Valor">{(id, d) => <CampoDinheiro id={id} descricaoId={d} valor={valor} aoMudar={setValor} />}</Campo>
              <Campo rotulo="Data">{(id) => <Input id={id} type="date" value={data} onChange={(e) => setData(e.target.value)} />}</Campo>
            </div>
            <Campo rotulo="Categoria" ajuda="Escolha uma sugestão ou digite outra.">
              {(id, d) => (
                <>
                  <Input id={id} list={listaId} aria-describedby={d} value={categoria} onChange={(e) => setCategoria(e.target.value)} autoComplete="off" />
                  <datalist id={listaId}>
                    {sugestoes.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                </>
              )}
            </Campo>
            <div className="flex items-start justify-between gap-3 rounded-lg border px-3 py-2.5">
              <div>
                <Label htmlFor="lancamento-fixo">Fixo mensal</Label>
                <p className="mt-0.5 text-xs text-muted-foreground">Aparece em “Lançar fixos” nos meses seguintes. Desmarque para encerrar.</p>
              </div>
              <Switch id="lancamento-fixo" checked={fixo} onCheckedChange={setFixo} />
            </div>
            {erro && (
              <p className="text-sm text-destructive" role="alert">
                {erro}
              </p>
            )}
            <DialogFooter className="gap-2 sm:justify-between">
              {atual ? (
                <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setConfirmarExclusao(true)}>
                  Excluir
                </Button>
              ) : (
                <span className="hidden sm:block" />
              )}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={aoFechar}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={enviando}>
                  {enviando ? "Salvando…" : atual ? "Salvar" : "Lançar"}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {atual && (
        <DialogoConfirmacao
          aberto={confirmarExclusao}
          aoFechar={() => setConfirmarExclusao(false)}
          titulo="Excluir lançamento?"
          descricao={`“${atual.descricao}” some das finanças. Não dá para desfazer.`}
          rotuloConfirmar="Excluir"
          destrutivo
          aoConfirmar={async () => {
            await mutar("DELETE", `/lancamentos/${atual.id}`);
            avisar("Lançamento excluído.");
            aoFechar();
          }}
        />
      )}
    </>
  );
}
