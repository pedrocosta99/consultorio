/**
 * Quem está usando e em qual consultório. Na versão local há um consultório e um
 * usuário fixos ("dono"); com o login (Fase 6.3) o contexto vem do token.
 */
import { z } from "zod";

export const PAPEIS = ["dono", "profissional", "suporte"] as const;
export type Papel = (typeof PAPEIS)[number];

export const ROTULO_PAPEL: Record<Papel, string> = {
  dono: "Dono",
  profissional: "Profissional",
  suporte: "Suporte",
};

/** Contexto de cada requisição na API. */
export interface Contexto {
  usuarioId: string;
  consultorioId: string;
  papel: Papel;
}

export const sessaoUsuarioSchema = z.object({
  usuario: z.object({ id: z.string(), nome: z.string(), email: z.string() }),
  consultorio: z.object({ id: z.string(), nome: z.string() }),
  papel: z.enum(PAPEIS),
});
export type SessaoUsuario = z.infer<typeof sessaoUsuarioSchema>;

/** Suporte ajuda com a conta, mas não lê notas clínicas nem prontuários. */
export function podeLerClinico(papel: Papel): boolean {
  return papel === "dono" || papel === "profissional";
}
