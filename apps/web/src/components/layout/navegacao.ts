import { CalendarDays, LayoutDashboard, Settings, Users, Wallet, type LucideIcon } from "lucide-react";

export interface ItemNav {
  rota: string;
  rotulo: string;
  icone: LucideIcon;
}

export const NAVEGACAO: ItemNav[] = [
  { rota: "/", rotulo: "Painel", icone: LayoutDashboard },
  { rota: "/agenda", rotulo: "Agenda", icone: CalendarDays },
  { rota: "/pacientes", rotulo: "Pacientes", icone: Users },
  { rota: "/financas", rotulo: "Finanças", icone: Wallet },
  { rota: "/configuracoes", rotulo: "Configurações", icone: Settings },
];
