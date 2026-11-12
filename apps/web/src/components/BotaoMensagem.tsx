import { useState } from "react";
import { Copy, MessageCircle, Send } from "lucide-react";
import type { Paciente } from "@consultorio/shared";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAvisos } from "@/app/avisos";
import { copiarTexto, linkWhatsApp } from "@/lib/mensagens";

/**
 * Mostra a mensagem pronta (editável antes de enviar), copia e, se o contato for
 * um telefone, abre o WhatsApp com o texto.
 */
export function BotaoMensagem({
  paciente,
  titulo,
  gerar,
  rotulo = "Mensagem",
  size = "sm",
  variant = "outline",
  somenteIcone = false,
}: {
  paciente: Paciente;
  titulo: string;
  /** Gera o texto na hora de abrir (pega dados atuais). */
  gerar: () => string;
  rotulo?: string;
  size?: "sm" | "default";
  variant?: "outline" | "secondary" | "ghost";
  somenteIcone?: boolean;
}) {
  const { avisar } = useAvisos();
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const link = linkWhatsApp(paciente.contato, texto);

  const copiar = async () => {
    if (await copiarTexto(texto)) {
      avisar("Mensagem copiada.");
      setAberto(false);
    } else avisar("Não consegui copiar. Selecione o texto e copie manualmente.");
  };

  return (
    <>
      <Button
        size={somenteIcone ? (size === "sm" ? "icon-sm" : "icon") : size}
        variant={variant}
        aria-label={somenteIcone ? rotulo : undefined}
        title={somenteIcone ? rotulo : undefined}
        onClick={() => {
          setTexto(gerar());
          setAberto(true);
        }}
      >
        <MessageCircle aria-hidden />
        {!somenteIcone && rotulo}
      </Button>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl font-medium">{titulo}</DialogTitle>
            <DialogDescription>Revise antes de enviar. O modelo se ajusta em Configurações → Mensagens.</DialogDescription>
          </DialogHeader>
          <label htmlFor="texto-mensagem" className="sr-only">
            Texto da mensagem
          </label>
          <textarea
            id="texto-mensagem"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={Math.min(14, Math.max(4, texto.split("\n").length + 1))}
            className="w-full resize-y rounded-md border bg-transparent px-3 py-2 text-sm leading-relaxed outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
          <DialogFooter className="gap-2 sm:justify-between">
            <span className="self-center text-xs text-muted-foreground">
              {link ? "" : paciente.contato ? "O contato não parece um telefone." : "Sem contato cadastrado."}
            </span>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={() => void copiar()}>
                <Copy aria-hidden /> Copiar
              </Button>
              {link && (
                <Button asChild>
                  <a href={link} target="_blank" rel="noreferrer noopener" onClick={() => setAberto(false)}>
                    <Send aria-hidden /> Abrir no WhatsApp
                  </a>
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
