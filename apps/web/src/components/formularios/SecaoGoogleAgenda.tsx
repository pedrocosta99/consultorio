import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarSync, Info, RefreshCw, TriangleAlert } from "lucide-react";
import { tituloDaSessao, type TituloSessao } from "@consultorio/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useAvisos } from "@/app/avisos";
import { useDados } from "@/app/dados";
import { usePreferencias } from "@/app/preferencias";
import { LogoGoogle } from "@/components/LogoGoogle";
import { api } from "@/lib/api";
import { capitalizar, fmt, hora, noFuso } from "@/lib/datas";
import { SeletorSimples } from "./campos";

interface Estado {
  conectada: boolean;
  simulada?: boolean;
  email?: string;
  calendarioId?: string;
  calendarioNome?: string;
  tituloSessao?: TituloSessao;
  ultimoSyncEm?: string | null;
  erro?: string | null;
  pendentes?: number;
  sincronizados?: number;
}

const CHAVE = ["integracao-google"];

/**
 * Configurações → Google Agenda. As sessões vão para o Google só com "Sessão" (e, se
 * escolhido, as iniciais/pseudônimo), nunca com nome ou nada clínico.
 */
export function SecaoGoogleAgenda() {
  const qc = useQueryClient();
  const { sessoes, paciente } = useDados();
  const { fusoPrincipal } = usePreferencias();
  const { avisar, avisarErro } = useAvisos();
  const estado = useQuery({ queryKey: CHAVE, queryFn: () => api<Estado>("GET", "/integracoes/google") });
  const calendarios = useQuery({
    queryKey: ["integracao-google-calendarios"],
    queryFn: () => api<Array<{ id: string; nome: string }>>("GET", "/integracoes/google/calendarios"),
    enabled: !!estado.data?.conectada,
  });
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [desconectando, setDesconectando] = useState(false);
  const [apagarEventos, setApagarEventos] = useState(false);

  const executar = async (rotulo: string, fn: () => Promise<unknown>, mensagem?: string) => {
    setOcupado(rotulo);
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: CHAVE });
      if (mensagem) avisar(mensagem);
    } catch (e) {
      avisarErro(e);
    } finally {
      setOcupado(null);
    }
  };

  const e = estado.data;
  const proxima = sessoes.find((s) => Date.parse(s.inicio) > Date.now() && s.estado === "agendada");
  const previa = proxima ? tituloDaSessao(paciente(proxima.pacienteId), e?.tituloSessao ?? "iniciais") : "Sessão · A.M.";

  return (
    <Card id="google-agenda">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2 font-serif text-lg font-medium">
          <CalendarSync className="size-4 text-muted-foreground" aria-hidden /> Google Agenda
        </CardTitle>
        <CardDescription>As sessões e os compromissos aparecem na sua agenda do Google, como eventos privados. Do paciente, vão só as iniciais (ou nem isso).</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!e ? (
          <p className="text-sm text-muted-foreground">{estado.isError ? "Não foi possível ver a integração." : "Carregando…"}</p>
        ) : !e.conectada ? (
          <div className="flex flex-col items-start gap-3">
            <Button variant="outline" className="gap-2" disabled={ocupado !== null} onClick={() => executar("conectar", () => api("POST", "/integracoes/google/conectar"), "Google Agenda conectado.")}>
              <LogoGoogle /> {ocupado === "conectar" ? "Conectando…" : "Conectar Google Agenda"}
            </Button>
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <Info className="mt-px size-3.5 shrink-0" aria-hidden />
              Versão local: a conexão é simulada e nada sai do computador. A conexão de verdade chega com o app na nuvem.
            </p>
          </div>
        ) : (
          <>
            <dl className="grid grid-cols-[8rem_1fr] items-center gap-x-3 gap-y-3 text-sm">
              <dt className="text-muted-foreground">Conta</dt>
              <dd className="truncate">
                {e.email}
                {e.simulada && <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">simulada</span>}
              </dd>
              <dt>
                <Label htmlFor="google-agenda-cal" className="font-normal text-muted-foreground">
                  Agenda
                </Label>
              </dt>
              <dd>
                <SeletorSimples
                  id="google-agenda-cal"
                  valor={e.calendarioId ?? ""}
                  aoMudar={(v) => executar("agenda", () => api("PUT", "/integracoes/google", { calendarioId: v }), "Agenda trocada; os eventos serão recriados lá.")}
                  opcoes={(calendarios.data ?? (e.calendarioId ? [{ id: e.calendarioId, nome: e.calendarioNome ?? e.calendarioId }] : [])).map((c) => [c.id, c.nome] as const)}
                />
              </dd>
              <dt className="text-muted-foreground">Título da sessão</dt>
              <dd>
                <ToggleGroup
                  type="single"
                  variant="outline"
                  size="sm"
                  value={e.tituloSessao}
                  onValueChange={(v) => v && executar("titulo", () => api("PUT", "/integracoes/google", { tituloSessao: v }))}
                  aria-label="Título da sessão no Google"
                >
                  <ToggleGroupItem value="iniciais" className="px-3">
                    Sessão · iniciais
                  </ToggleGroupItem>
                  <ToggleGroupItem value="so_sessao" className="px-3">
                    Só “Sessão”
                  </ToggleGroupItem>
                </ToggleGroup>
              </dd>
            </dl>

            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              <p className="mb-1.5 text-xs text-muted-foreground">Como a próxima sessão aparece no Google</p>
              <div className="flex items-center gap-2 rounded-md border-l-[3px] border-l-primary bg-card px-2.5 py-1.5">
                <span className="font-medium">{previa}</span>
                {proxima && (
                  <span className="text-xs text-muted-foreground">
                    {capitalizar(fmt(noFuso(proxima.inicio, fusoPrincipal), "EEE, d MMM"))} · {hora(proxima.inicio, fusoPrincipal)}
                  </span>
                )}
                <span className="ml-auto text-[11px] text-muted-foreground">privado</span>
              </div>
            </div>

            {e.erro && (
              <p className="flex items-start gap-1.5 text-sm text-destructive" role="alert">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> Último envio falhou: {e.erro}
              </p>
            )}
            <p className="text-xs text-muted-foreground" role="status">
              {e.sincronizados ?? 0} eventos no Google
              {e.ultimoSyncEm ? ` · último envio ${fmt(noFuso(e.ultimoSyncEm, fusoPrincipal), "dd/MM 'às' HH:mm")}` : " · ainda não enviado"}
              {e.pendentes ? ` · ${e.pendentes} mudança${e.pendentes === 1 ? "" : "s"} na fila` : ""}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={ocupado !== null}
                onClick={() =>
                  executar("sync", async () => {
                    const r = await api<{ enviados: number; falhas: number }>("POST", "/integracoes/google/sincronizar");
                    avisar(r.falhas ? `${r.enviados} enviados, ${r.falhas} com falha.` : r.enviados ? `${r.enviados} mudanças enviadas ao Google.` : "Nada novo para enviar.");
                  })
                }
              >
                <RefreshCw aria-hidden className={ocupado === "sync" ? "animate-spin" : undefined} /> Sincronizar agora
              </Button>
              <Button variant="outline" size="sm" onClick={() => setDesconectando(true)}>
                Desconectar
              </Button>
            </div>
          </>
        )}
      </CardContent>

      <Dialog open={desconectando} onOpenChange={setDesconectando}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl font-medium">Desconectar o Google Agenda?</DialogTitle>
            <DialogDescription>O app para de mandar as sessões e os compromissos para o Google.</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-3">
            <Switch id="apagar-eventos" checked={apagarEventos} onCheckedChange={setApagarEventos} />
            <Label htmlFor="apagar-eventos" className="text-sm font-normal">
              Apagar do Google os eventos que o app criou
            </Label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDesconectando(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                executar(
                  "desconectar",
                  async () => {
                    await api("POST", "/integracoes/google/desconectar", { apagarEventos });
                    setDesconectando(false);
                  },
                  "Google Agenda desconectado.",
                )
              }
            >
              Desconectar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
