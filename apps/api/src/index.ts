import path from "node:path";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { lerConfig } from "./infra/config";
import { log } from "./infra/log";
import { adaptadorGoogle, app } from "./app";
import { processarFila } from "./agendaGoogle";
import { bancoAtual } from "./estado";
import { agora } from "./infra/relogio";
import { contextoLocal } from "./servico";

// SIGILO: fora do container, só loopback (lerConfig recusa outro HOST).
const config = lerConfig();

/** A API em /api; com CONSULTORIO_WEB, também o web compilado (SPA: rotas desconhecidas → index.html). */
const raiz = new Hono();
raiz.route("/", app);
if (config.web) {
  raiz.use("/*", serveStatic({ root: path.relative(process.cwd(), config.web) }));
  raiz.get("*", serveStatic({ path: path.relative(process.cwd(), path.join(config.web, "index.html")) }));
}

serve({ fetch: raiz.fetch, hostname: config.host, port: config.porta }, (info) => {
  log("info", "api_no_ar", { endereco: info.address, porta: info.port, web: !!config.web, container: config.container });
});

// Worker da fila do Google Agenda: a cada 15 s, se houver agenda conectada. Na nuvem,
// quem faz isso é o Cloud Tasks.
setInterval(() => {
  try {
    const { db } = bancoAtual();
    processarFila(db, contextoLocal(db), adaptadorGoogle, agora()).catch(() => {});
  } catch {
    // banco ainda não aberto: tenta na próxima
  }
}, 15_000).unref();
