import { useState } from "react";
import { ArrowLeftRight, CalendarPlus, CircleDollarSign, Plus, StickyNote, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DialogoPagamento } from "@/components/formularios/DialogoPagamento";
import { DialogoPaciente } from "@/components/formularios/DialogoPaciente";
import { DialogoSessao } from "@/components/formularios/DialogoSessao";
import { SheetNota } from "@/components/notas/SheetNota";

export function MenuNovo() {
  const [emBreve, setEmBreve] = useState<string | null>(null);
  const [dialogo, setDialogo] = useState<null | "paciente" | "pagamento" | "sessao" | "nota">(null);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" className="gap-1.5" aria-label="Novo">
            <Plus aria-hidden />
            <span className="hidden sm:inline">Novo</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onSelect={() => setDialogo("sessao")}>
            <CalendarPlus aria-hidden /> Sessão avulsa
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setDialogo("paciente")}>
            <UserPlus aria-hidden /> Paciente
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setDialogo("pagamento")}>
            <CircleDollarSign aria-hidden /> Pagamento
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setDialogo("nota")}>
            <StickyNote aria-hidden /> Nota
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setEmBreve("Nova transação")}>
            <ArrowLeftRight aria-hidden /> Transação
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DialogoPaciente aberto={dialogo === "paciente"} aoFechar={() => setDialogo(null)} />
      <DialogoPagamento aberto={dialogo === "pagamento"} aoFechar={() => setDialogo(null)} />
      <DialogoSessao aberto={dialogo === "sessao"} aoFechar={() => setDialogo(null)} />
      <SheetNota aberto={dialogo === "nota"} aoFechar={() => setDialogo(null)} />

      <Dialog open={emBreve !== null} onOpenChange={(v) => !v && setEmBreve(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl font-medium">{emBreve}</DialogTitle>
            <DialogDescription>
              Transações de verdade chegam na Fase 3 (Finanças). Por enquanto, Finanças mostra dados fictícios.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmBreve(null)}>
              Entendi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
