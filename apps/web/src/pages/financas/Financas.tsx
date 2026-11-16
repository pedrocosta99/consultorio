import { useState } from "react";
import { useSearchParams } from "react-router";
import { Plus } from "lucide-react";
import type { Lancamento } from "@consultorio/shared";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDados } from "@/app/dados";
import { CabecalhoPagina } from "@/components/comuns";
import { DialogoLancamento } from "@/components/formularios/DialogoLancamento";
import { useMoedaExibicao } from "@/lib/financas";
import type { AbrirLancamento } from "./AvisoFixos";
import { Divulgacao } from "./Divulgacao";
import { Lancamentos } from "./Lancamentos";
import { VisaoGeral } from "./VisaoGeral";

const ABAS = ["visao", "lancamentos", "divulgacao"] as const;
type Aba = (typeof ABAS)[number];

export function PaginaFinancas() {
  const { carregando } = useDados();
  const alvo = useMoedaExibicao();
  const [params, setParams] = useSearchParams();
  const aba = (ABAS as readonly string[]).includes(params.get("aba") ?? "") ? (params.get("aba") as Aba) : "visao";
  const [dialogo, setDialogo] = useState<{ aberto: boolean; atual?: Lancamento }>({ aberto: false });
  const abrir: AbrirLancamento = (l) => setDialogo({ aberto: true, ...(l ? { atual: l } : {}) });

  return (
    <>
      <CabecalhoPagina
        titulo="Finanças"
        descricao={
          alvo
            ? `O que entra (pacientes e outros) e o que sai. Totais em ${{ BRL: "R$", USD: "US$", EUR: "€" }[alvo]}, convertidos.`
            : "O que entra (pacientes e outros) e o que sai. Valores sempre na moeda original."
        }
        acoes={
          !carregando && (
            <Button onClick={() => abrir(null)}>
              <Plus aria-hidden /> Novo lançamento
            </Button>
          )
        }
      />
      {carregando ? (
        <div aria-busy="true" aria-label="Carregando finanças" className="flex flex-col gap-4">
          <Skeleton className="h-9 w-72 rounded-lg" />
          <div className="grid gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
          <Skeleton className="h-80 rounded-xl" />
        </div>
      ) : (
        <Tabs
          value={aba}
          onValueChange={(v) =>
            setParams(
              (p) => {
                if (v === "visao") p.delete("aba");
                else p.set("aba", v);
                return p;
              },
              { replace: true },
            )
          }
        >
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <TabsList>
              <TabsTrigger value="visao">Resumo</TabsTrigger>
              <TabsTrigger value="lancamentos">Lançamentos</TabsTrigger>
              <TabsTrigger value="divulgacao">Divulgação</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="visao" className="mt-4">
            <VisaoGeral abrir={abrir} />
          </TabsContent>
          <TabsContent value="lancamentos" className="mt-4">
            <Lancamentos abrir={abrir} />
          </TabsContent>
          <TabsContent value="divulgacao" className="mt-4">
            <Divulgacao />
          </TabsContent>
        </Tabs>
      )}
      <DialogoLancamento aberto={dialogo.aberto} atual={dialogo.atual} aoFechar={() => setDialogo({ aberto: false })} />
    </>
  );
}
