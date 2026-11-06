import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";
import "./index.css";
import { AcessoProvider } from "@/app/acesso";
import { AvisosProvider } from "@/app/avisos";
import { DadosProvider } from "@/app/dados";
import { PreferenciasProvider } from "@/app/preferencias";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "@/components/layout/AppShell";
import { PaginaPainel } from "@/pages/Painel";
import { PaginaLab } from "@/pages/Lab";
import { PaginaPacientes } from "@/pages/Pacientes";
import { PaginaPacienteFicha } from "@/pages/PacienteFicha";
import { PaginaEmConstrucao } from "@/pages/EmConstrucao";
import { PaginaAgenda } from "@/pages/Agenda";
import { PaginaFinancas } from "@/pages/financas/Financas";
import { PaginaConfiguracoes } from "@/pages/Configuracoes";
import { PaginaSupervisao } from "@/pages/Supervisao";

const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, element: <PaginaPainel /> },
      { path: "agenda", element: <PaginaAgenda /> },
      { path: "pacientes", element: <PaginaPacientes /> },
      { path: "pacientes/:id", element: <PaginaPacienteFicha /> },
      { path: "financas", element: <PaginaFinancas /> },
      { path: "supervisao", element: <PaginaSupervisao /> },
      { path: "configuracoes", element: <PaginaConfiguracoes /> },
      { path: "lab", element: <PaginaLab /> },
      { path: "*", element: <PaginaEmConstrucao titulo="Página não encontrada" /> },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PreferenciasProvider>
      <AvisosProvider>
        <AcessoProvider>
          <DadosProvider>
            <TooltipProvider delayDuration={300}>
              <RouterProvider router={router} />
            </TooltipProvider>
          </DadosProvider>
        </AcessoProvider>
      </AvisosProvider>
    </PreferenciasProvider>
  </StrictMode>,
);
