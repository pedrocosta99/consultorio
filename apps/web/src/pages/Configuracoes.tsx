import { Globe2, Monitor, Moon, ShieldCheck, Sun } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { usePreferencias, type TamanhoTexto, type Tema } from "@/app/preferencias";
import { useDados } from "@/app/dados";
import { CabecalhoPagina } from "@/components/comuns";
import { SeletorPaleta } from "@/components/SeletorPaleta";
import { SecaoMensagens } from "@/components/formularios/SecaoMensagens";
import { SecaoBackup, SecaoContas, SecaoFeriados, SecaoFicticios, SecaoHorarioAtendimento, SecaoConta, SecaoMoedas, SecaoRegistroAcesso } from "@/components/formularios/SecoesConfiguracao";
import { FUSOS_DISPONIVEIS, hora, nomeFuso, offsetFuso } from "@/lib/datas";

const TAMANHOS: Array<[TamanhoTexto, string, string]> = [
  ["normal", "Normal", "text-xs"],
  ["grande", "Grande", "text-sm"],
  ["maior", "Maior", "text-base"],
];

const TEMAS: Array<[Tema, string, typeof Sun]> = [
  ["claro", "Claro", Sun],
  ["escuro", "Escuro", Moon],
  ["sistema", "Sistema", Monitor],
];

function Linha({ id, titulo, descricao, children }: { id: string; titulo: string; descricao?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <Label htmlFor={id} className="text-sm font-medium">
          {titulo}
        </Label>
        {descricao && <p className="mt-0.5 text-xs text-muted-foreground">{descricao}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function PaginaConfiguracoes() {
  const prefs = usePreferencias();
  const { pacientes, nomeExibicao } = useDados();
  const agora = new Date();
  const exemplo = pacientes.find((p) => p.status === "ativo");

  return (
    <>
      <CabecalhoPagina titulo="Configurações" descricao="Aparência e fusos ficam neste navegador; feriados e contas ficam no banco." />

      <div className="grid max-w-3xl grid-cols-1 gap-4">
        <SecaoFicticios />
        <SecaoConta />
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="font-serif text-lg font-medium">Aparência</CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            <Linha id="tema" titulo="Tema" descricao="“Sistema” acompanha o claro/escuro do computador.">
              <ToggleGroup
                id="tema"
                type="single"
                variant="outline"
                value={prefs.tema}
                onValueChange={(v) => v && prefs.atualizar({ tema: v as Tema })}
                aria-label="Tema"
              >
                {TEMAS.map(([v, rotulo, Icone]) => (
                  <ToggleGroupItem key={v} value={v} aria-label={rotulo} className="gap-1.5 px-3">
                    <Icone aria-hidden className="size-4" /> {rotulo}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </Linha>
            <Linha id="tamanho-texto" titulo="Tamanho do texto" descricao="Aumenta texto e espaçamentos em todo o app.">
              <ToggleGroup
                id="tamanho-texto"
                type="single"
                variant="outline"
                value={prefs.tamanhoTexto}
                onValueChange={(v) => v && prefs.atualizar({ tamanhoTexto: v as TamanhoTexto })}
                aria-label="Tamanho do texto"
              >
                {TAMANHOS.map(([v, rotulo, classe]) => (
                  <ToggleGroupItem key={v} value={v} aria-label={rotulo} className="gap-1.5 px-3">
                    <span aria-hidden className={`font-serif ${classe}`}>A</span> {rotulo}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </Linha>
            <SeletorPaleta />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2 font-serif text-lg font-medium">
              <Globe2 className="size-4 text-muted-foreground" aria-hidden /> Fusos horários
            </CardTitle>
            <CardDescription>A agenda é exibida no fuso principal. O secundário aparece ao lado, na coluna de horas.</CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            <Linha id="fuso-principal" titulo="Fuso principal" descricao={`Agora: ${hora(agora, prefs.fusoPrincipal)} (${offsetFuso(prefs.fusoPrincipal, agora)})`}>
              <Select
                value={prefs.fusoPrincipal}
                onValueChange={(v) => prefs.atualizar({ fusoPrincipal: v, fusoSecundario: prefs.fusoSecundario === v ? null : prefs.fusoSecundario })}
              >
                <SelectTrigger id="fuso-principal" className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FUSOS_DISPONIVEIS.map((f) => (
                    <SelectItem key={f} value={f}>
                      {nomeFuso(f)} <span className="text-muted-foreground">{offsetFuso(f, agora)}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Linha>
            <Linha
              id="fuso-secundario"
              titulo="Fuso secundário"
              descricao={prefs.fusoSecundario ? `Agora: ${hora(agora, prefs.fusoSecundario)} (${offsetFuso(prefs.fusoSecundario, agora)})` : "Desligado"}
            >
              <Select value={prefs.fusoSecundario ?? "nenhum"} onValueChange={(v) => prefs.atualizar({ fusoSecundario: v === "nenhum" ? null : v })}>
                <SelectTrigger id="fuso-secundario" className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhum">Nenhum</SelectItem>
                  {FUSOS_DISPONIVEIS.filter((f) => f !== prefs.fusoPrincipal).map((f) => (
                    <SelectItem key={f} value={f}>
                      {nomeFuso(f)} <span className="text-muted-foreground">{offsetFuso(f, agora)}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Linha>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2 font-serif text-lg font-medium">
              <ShieldCheck className="size-4 text-muted-foreground" aria-hidden /> Sigilo
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            <Linha
              id="modo-discreto"
              titulo="Modo discreto"
              descricao={
                exemplo
                  ? `Troca nomes por iniciais/pseudônimo em todo o app. Ex.: ${prefs.modoDiscreto ? `aparece “${exemplo.apelido}”` : `“${nomeExibicao(exemplo)}” vira “${exemplo.apelido}”`}. Atalho no Cmd+K.`
                  : "Troca nomes por iniciais em todo o app. Atalho no Cmd+K."
              }
            >
              <Switch id="modo-discreto" checked={prefs.modoDiscreto} onCheckedChange={(v) => prefs.atualizar({ modoDiscreto: v })} />
            </Linha>
          </CardContent>
        </Card>
        <SecaoRegistroAcesso />
        <SecaoMensagens />
        <SecaoHorarioAtendimento />
        <SecaoFeriados />
        <SecaoMoedas />
        <SecaoContas />
        <SecaoBackup />
      </div>
    </>
  );
}
