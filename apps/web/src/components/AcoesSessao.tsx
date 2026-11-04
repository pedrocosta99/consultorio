import { Check, CircleDollarSign, UserX } from "lucide-react";
import { sessaoCobravel, type Sessao } from "@consultorio/shared";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDados } from "@/app/dados";
import { cn } from "@/lib/utils";

/** Ações rápidas de uma sessão: marcar realizada, falta e pago (no máximo 2 cliques). */
export function AcoesSessao({
  sessao,
  compacto = false,
  className,
}: {
  sessao: Sessao;
  compacto?: boolean;
  className?: string;
}) {
  const { atualizarSessao } = useDados();
  const realizada = sessao.estado === "realizada";
  const falta = sessao.estado === "falta_cobrada" || sessao.estado === "falta_nao_cobrada";
  const podePagar = sessaoCobravel(sessao.estado);
  const tamanho = compacto ? "sm" : "default";

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <Button
        size={tamanho}
        variant={realizada ? "default" : "outline"}
        aria-pressed={realizada}
        title={realizada ? "Clique para desfazer" : "Marcar como realizada"}
        onClick={() => atualizarSessao(sessao.id, { estado: realizada ? "agendada" : "realizada" })}
      >
        <Check aria-hidden />
        Realizada
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size={tamanho} variant={falta ? "secondary" : "outline"} aria-pressed={falta}>
            <UserX aria-hidden />
            Falta
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onSelect={() => atualizarSessao(sessao.id, { estado: "falta_cobrada" })}>
            Falta cobrada
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => atualizarSessao(sessao.id, { estado: "falta_nao_cobrada" })}>
            Falta não cobrada
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => atualizarSessao(sessao.id, { estado: "cancelada" })}>
            Cancelada
          </DropdownMenuItem>
          {sessao.estado !== "agendada" && (
            <DropdownMenuItem onSelect={() => atualizarSessao(sessao.id, { estado: "agendada" })}>
              Voltar para agendada
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        size={tamanho}
        variant={sessao.pago ? "secondary" : "outline"}
        aria-pressed={sessao.pago}
        disabled={!podePagar}
        title={podePagar ? undefined : "Marque como realizada ou falta cobrada para registrar pagamento"}
        onClick={() => atualizarSessao(sessao.id, { pago: !sessao.pago })}
      >
        <CircleDollarSign aria-hidden />
        Pago
      </Button>
    </div>
  );
}
