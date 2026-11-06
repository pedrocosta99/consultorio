/**
 * Relógio da API. CONSULTORIO_AGORA (ISO) fixa o instante — usado pelos testes
 * visuais para que o banco e o navegador concordem sobre "hoje".
 */
export function agora(): Date {
  const fixo = process.env.CONSULTORIO_AGORA;
  return fixo ? new Date(fixo) : new Date();
}
