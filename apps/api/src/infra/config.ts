/**
 * Configuração da API por variáveis de ambiente (as mesmas local, em Docker e, depois,
 * no Cloud Run).
 *
 *   HOST                  endereço de escuta (padrão 127.0.0.1)
 *   PORT / API_PORT       porta (Cloud Run define PORT; padrão 8787)
 *   CONSULTORIO_DB        arquivo do banco (padrão data/consultorio.db)
 *   CONSULTORIO_WEB       pasta do web compilado: se definida, a API também serve o web
 *   CONSULTORIO_CONTAINER "1" dentro do container: única situação em que HOST pode não
 *                         ser loopback (o container só é publicado em 127.0.0.1)
 *   CONSULTORIO_AGORA     fixa o relógio (testes)
 *
 * SIGILO: fora do container, o servidor só escuta no loopback (regra do CLAUDE.md até
 * a Fase 6.3).
 */
const LOOPBACK = new Set(["127.0.0.1", "::1", "localhost"]);

export interface Config {
  host: string;
  porta: number;
  web: string | null;
  container: boolean;
}

export function lerConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const container = env.CONSULTORIO_CONTAINER === "1";
  const host = env.HOST ?? "127.0.0.1";
  if (!LOOPBACK.has(host) && !container) {
    throw new Error(`HOST=${host} não é loopback. Fora do container a API só escuta em 127.0.0.1 (regra de sigilo).`);
  }
  const porta = Number(env.PORT ?? env.API_PORT ?? 8787);
  if (!Number.isInteger(porta) || porta <= 0 || porta > 65535) throw new Error(`Porta inválida: ${env.PORT ?? env.API_PORT}`);
  return { host, porta, web: env.CONSULTORIO_WEB || null, container };
}
