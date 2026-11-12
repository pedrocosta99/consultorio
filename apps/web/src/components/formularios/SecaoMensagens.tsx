import { useEffect, useState } from "react";
import { MessageSquareText, RotateCcw } from "lucide-react";
import { MENSAGENS_PADRAO, mensagensSchema, type Mensagens } from "@consultorio/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAvisos } from "@/app/avisos";
import { useDados } from "@/app/dados";
import { Campo } from "./campos";

const CLASSE_AREA =
  "w-full resize-y rounded-md border bg-transparent px-3 py-2 text-sm leading-relaxed outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

/** Chave Pix e modelos: cobrança, lembrete e modelo de nota. Ficam no banco. */
export function SecaoMensagens() {
  const { mensagens, mutar } = useDados();
  const { avisar } = useAvisos();
  const [rascunho, setRascunho] = useState<Mensagens>(mensagens);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => setRascunho(mensagens), [mensagens]);

  const mudou = JSON.stringify(rascunho) !== JSON.stringify(mensagens);
  const campo = (k: keyof Mensagens) => ({
    value: rascunho[k],
    onChange: (e: { target: { value: string } }) => setRascunho((r) => ({ ...r, [k]: e.target.value })),
  });

  const salvar = async () => {
    const r = mensagensSchema.safeParse(rascunho);
    if (!r.success) return setErro(r.error.issues[0]!.message);
    setErro(null);
    setSalvando(true);
    try {
      await mutar("PUT", "/configuracoes/mensagens", r.data);
      avisar("Mensagens salvas.");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não salvou.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2 font-serif text-lg font-medium">
          <MessageSquareText className="size-4 text-muted-foreground" aria-hidden /> Mensagens e modelos
        </CardTitle>
        <CardDescription>Textos prontos para cobrança e lembrete (você revisa antes de enviar) e o modelo de nota documental.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Campo rotulo="Chave Pix" ajuda="Entra na mensagem de cobrança como “Pix: …”. Deixe vazio para não incluir.">
          {(id, d) => <Input id={id} aria-describedby={d} placeholder="CPF, e-mail, telefone ou chave aleatória" autoComplete="off" {...campo("chavePix")} />}
        </Campo>
        <Campo rotulo="Cobrança do mês" ajuda="Variáveis: {nome} {mes} {qtd} {lista} {total} {pix}">
          {(id, d) => <textarea id={id} aria-describedby={d} rows={6} className={CLASSE_AREA} {...campo("modeloCobranca")} />}
        </Campo>
        <Campo rotulo="Lembrete de sessão" ajuda="Variáveis: {nome} {dia} {hora}. A hora sai no fuso do paciente.">
          {(id, d) => <textarea id={id} aria-describedby={d} rows={3} className={CLASSE_AREA} {...campo("modeloLembrete")} />}
        </Campo>
        <Campo rotulo="Modelo de nota (registro documental)" ajuda="Inserido pelo botão “Usar modelo” no editor de notas. Base: Resolução CFP 001/2009.">
          {(id, d) => <textarea id={id} aria-describedby={d} rows={5} className={CLASSE_AREA} {...campo("modeloNota")} />}
        </Campo>
        {erro && (
          <p className="text-sm text-destructive" role="alert">
            {erro}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={() => setRascunho({ ...MENSAGENS_PADRAO, chavePix: rascunho.chavePix })}>
            <RotateCcw aria-hidden /> Textos padrão
          </Button>
          <Button onClick={() => void salvar()} disabled={!mudou || salvando}>
            {salvando ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
