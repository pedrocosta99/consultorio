import { useState } from "react";
import { useNavigate } from "react-router";
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

export function MenuNovo() {
  const navegar = useNavigate();
  const [emBreve, setEmBreve] = useState<string | null>(null);
  const [dialogo, setDialogo] = useState<null | "paciente" | "pagamento">(null);

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
          <DropdownMenuItem onSelect={() => navegar("/agenda")}>
            <CalendarPlus aria-hidden /> Sessão
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setDialogo("paciente")}>
            <UserPlus aria-hidden /> Paciente
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setDialogo("pagamento")}>
            <CircleDollarSign aria-hidden /> Pagamento
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setEmBreve("Nova nota")}>
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

      <Dialog open={emBreve !== null} onOpenChange={(v) => !v && setEmBreve(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl font-medium">{emBreve}</DialogTitle>
            <DialogDescription>
              {emBreve === "Nova nota"
                ? "O editor de notas chega na Etapa 2 (notas clínicas)."
                : "Transações de verdade chegam na Fase 3 (Finanças). Por enquanto, Finanças mostra dados fictícios."}
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
