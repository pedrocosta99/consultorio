import { serve } from "@hono/node-server";
import { adaptadorGoogle, app } from "./app";
import { processarFila } from "./agendaGoogle";
import { bancoAtual } from "./estado";
import { agora } from "./infra/relogio";
import { contextoLocal } from "./servico";

// SIGILO: o servidor escuta apenas no loopback. Nunca troque para 0.0.0.0.
const HOST = "127.0.0.1";
const PORT = Number(process.env.API_PORT ?? 8787);

serve({ fetch: app.fetch, hostname: HOST, port: PORT }, (info) => {
  console.log(`API local em http://${info.address}:${info.port}/api`);
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
