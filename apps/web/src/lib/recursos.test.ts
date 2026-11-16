import { describe, expect, it } from "vitest";
import { recursosAfetados } from "./recursos";

describe("recarga por recurso", () => {
  it("cada gravação recarrega só o que afeta", () => {
    expect(recursosAfetados("/notas/n_1")).toEqual(["notas"]);
    expect(recursosAfetados("/sessoes/s_1")).toEqual(["sessoes", "pagamentos", "contratos"]);
    expect(recursosAfetados("/pacientes/p_1/contratos")).toEqual(["contratos", "sessoes"]);
    expect(recursosAfetados("/pacientes/p_1")).toContain("pacientes");
    expect(recursosAfetados("/compromissos/c_1/excluir")).toEqual(["compromissos"]);
  });
  it("rota desconhecida (backup, dados fictícios) recarrega tudo", () => {
    expect(recursosAfetados("/backup/importar")).toHaveLength(11);
  });
});
