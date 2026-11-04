import { useSearchParams } from "react-router";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDados } from "@/app/dados";
import { CabecalhoPagina } from "@/components/comuns";
import { Transacoes } from "./Transacoes";
import { VisaoGeral } from "./VisaoGeral";

const ABAS = ["visao", "transacoes"] as const;
type Aba = (typeof ABAS)[number];

export function PaginaFinancas() {
  const { carregando } = useDados();
  const [params, setParams] = useSearchParams();
  const aba = (ABAS as readonly string[]).includes(params.get("aba") ?? "") ? (params.get("aba") as Aba) : "visao";

  return (
    <>
      <CabecalhoPagina titulo="Finanças" descricao="Valores sempre na moeda original. BRL é a moeda principal." />
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
              <TabsTrigger value="visao">Visão geral</TabsTrigger>
              <TabsTrigger value="transacoes">Transações</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="visao" className="mt-4">
            <VisaoGeral />
          </TabsContent>
          <TabsContent value="transacoes" className="mt-4">
            <Transacoes />
          </TabsContent>
        </Tabs>
      )}
    </>
  );
}
