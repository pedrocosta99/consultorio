import { Hammer } from "lucide-react";
import { CabecalhoPagina, EstadoVazio } from "@/components/comuns";

export function PaginaEmConstrucao({ titulo }: { titulo: string }) {
  return (
    <>
      <CabecalhoPagina titulo={titulo} />
      <EstadoVazio icone={Hammer} titulo="Em construção" descricao="Esta tela vem nos próximos passos da Etapa 0." />
    </>
  );
}
