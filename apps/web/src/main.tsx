import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";
import "./index.css";
import { DadosProvider } from "@/app/dados";
import { PreferenciasProvider } from "@/app/preferencias";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "@/components/layout/AppShell";
import { PaginaPainel } from "@/pages/Painel";
import { PaginaLab } from "@/pages/Lab";
import { PaginaEmConstrucao } from "@/pages/EmConstrucao";

const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, element: <PaginaPainel /> },
      { path: "agenda", element: <PaginaEmConstrucao titulo="Agenda" /> },
      { path: "pacientes", element: <PaginaEmConstrucao titulo="Pacientes" /> },
      { path: "pacientes/:id", element: <PaginaEmConstrucao titulo="Paciente" /> },
      { path: "financas", element: <PaginaEmConstrucao titulo="Finanças" /> },
      { path: "configuracoes", element: <PaginaEmConstrucao titulo="Configurações" /> },
      { path: "lab", element: <PaginaLab /> },
      { path: "*", element: <PaginaEmConstrucao titulo="Página não encontrada" /> },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PreferenciasProvider>
      <DadosProvider>
        <TooltipProvider delayDuration={300}>
          <RouterProvider router={router} />
        </TooltipProvider>
      </DadosProvider>
    </PreferenciasProvider>
  </StrictMode>,
);
