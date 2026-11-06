/** Peças pequenas e reutilizáveis dos formulários. */
import { useId, useState, type ReactNode } from "react";
import { centavosParaTexto, lerCentavos, type Dinheiro, type Moeda } from "@consultorio/shared";
import { useDados } from "@/app/dados";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

/** Rótulo + controle + ajuda/erro. O controle recebe o id via render prop. */
export function Campo({
  rotulo,
  ajuda,
  erro,
  className,
  children,
}: {
  rotulo: string;
  ajuda?: string;
  erro?: string | null;
  className?: string;
  children: (id: string, descricaoId: string | undefined) => ReactNode;
}) {
  const id = useId();
  const descricaoId = erro || ajuda ? `${id}-d` : undefined;
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <Label htmlFor={id}>{rotulo}</Label>
      {children(id, descricaoId)}
      {erro ? (
        <p id={descricaoId} className="text-xs text-destructive">
          {erro}
        </p>
      ) : ajuda ? (
        <p id={descricaoId} className="text-xs text-muted-foreground">
          {ajuda}
        </p>
      ) : null}
    </div>
  );
}

export function SeletorSimples<T extends string>({
  id,
  valor,
  aoMudar,
  opcoes,
  className,
}: {
  id?: string;
  valor: T;
  aoMudar: (v: T) => void;
  opcoes: ReadonlyArray<readonly [T, string]>;
  className?: string;
}) {
  return (
    <Select value={valor} onValueChange={(v) => aoMudar(v as T)}>
      <SelectTrigger id={id} className={cn("w-full", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {opcoes.map(([v, r]) => (
          <SelectItem key={v} value={v}>
            {r}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const SIMBOLO: Record<Moeda, string> = { BRL: "R$", USD: "US$", EUR: "€" };

/** Valor + moeda. Guarda o texto digitado e devolve centavos (ou null se inválido). */
export function CampoDinheiro({
  id,
  valor,
  aoMudar,
  descricaoId,
  travarMoeda,
}: {
  id: string;
  valor: { texto: string; moeda: Moeda };
  aoMudar: (v: { texto: string; moeda: Moeda }) => void;
  descricaoId?: string;
  travarMoeda?: boolean;
}) {
  const { moedas } = useDados();
  const opcoes = moedas.includes(valor.moeda) ? moedas : [...moedas, valor.moeda];
  return (
    <div className="flex gap-2">
      <Select value={valor.moeda} onValueChange={(m) => aoMudar({ ...valor, moeda: m as Moeda })} disabled={travarMoeda || opcoes.length === 1}>
        <SelectTrigger className="w-24 shrink-0" aria-label="Moeda">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {opcoes.map((m) => (
            <SelectItem key={m} value={m}>
              {SIMBOLO[m]} {m}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        id={id}
        inputMode="decimal"
        placeholder="0,00"
        value={valor.texto}
        aria-describedby={descricaoId}
        onChange={(e) => aoMudar({ ...valor, texto: e.target.value })}
        onBlur={() => {
          const c = lerCentavos(valor.texto);
          if (c !== null) aoMudar({ ...valor, texto: centavosParaTexto(c) });
        }}
        className="tabular"
      />
    </div>
  );
}

export function textoDeDinheiro(d: Dinheiro | undefined, padrao: Moeda = "BRL") {
  return d ? { texto: centavosParaTexto(d.centavos), moeda: d.moeda } : { texto: "", moeda: padrao };
}

const DIAS: Array<[number, string, string]> = [
  [1, "S", "Segunda"],
  [2, "T", "Terça"],
  [3, "Q", "Quarta"],
  [4, "Q", "Quinta"],
  [5, "S", "Sexta"],
  [6, "S", "Sábado"],
  [7, "D", "Domingo"],
];

export function SeletorDias({ id, valor, aoMudar }: { id?: string; valor: number[]; aoMudar: (v: number[]) => void }) {
  return (
    <ToggleGroup
      id={id}
      type="multiple"
      variant="outline"
      value={valor.map(String)}
      onValueChange={(v) => aoMudar(v.map(Number).sort((a, b) => a - b))}
      className="w-full"
    >
      {DIAS.map(([n, curto, longo]) => (
        <ToggleGroupItem key={n} value={String(n)} aria-label={longo} title={longo} className="flex-1 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
          {curto}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

/** Confirmação dentro da página (o app não usa confirm() do navegador). */
export function DialogoConfirmacao({
  aberto,
  aoFechar,
  titulo,
  descricao,
  rotuloConfirmar,
  destrutivo,
  exigirTexto,
  aoConfirmar,
}: {
  aberto: boolean;
  aoFechar: () => void;
  titulo: string;
  descricao: ReactNode;
  rotuloConfirmar: string;
  destrutivo?: boolean;
  /** Se definido, o botão só libera depois de digitar este texto. */
  exigirTexto?: string;
  aoConfirmar: () => Promise<void> | void;
}) {
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const liberado = !exigirTexto || texto.trim() === exigirTexto;

  return (
    <Dialog
      open={aberto}
      onOpenChange={(v) => {
        if (!v) {
          setTexto("");
          setErro(null);
          aoFechar();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl font-medium">{titulo}</DialogTitle>
          <DialogDescription asChild>
            <div className="text-sm text-muted-foreground">{descricao}</div>
          </DialogDescription>
        </DialogHeader>
        {exigirTexto && (
          <Campo rotulo={`Digite “${exigirTexto}” para confirmar`}>
            {(id) => <Input id={id} value={texto} onChange={(e) => setTexto(e.target.value)} autoComplete="off" />}
          </Campo>
        )}
        {erro && (
          <p className="text-sm text-destructive" role="alert">
            {erro}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={aoFechar}>
            Cancelar
          </Button>
          <Button
            variant={destrutivo ? "destructive" : "default"}
            disabled={!liberado || enviando}
            onClick={async () => {
              setEnviando(true);
              setErro(null);
              try {
                await aoConfirmar();
                setTexto("");
                aoFechar();
              } catch (e) {
                setErro(e instanceof Error ? e.message : "Não deu certo.");
              } finally {
                setEnviando(false);
              }
            }}
          >
            {rotuloConfirmar}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
