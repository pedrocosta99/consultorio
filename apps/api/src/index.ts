import { serve } from "@hono/node-server";
import { app } from "./app";

// SIGILO: o servidor escuta apenas no loopback. Nunca troque para 0.0.0.0.
const HOST = "127.0.0.1";
const PORT = Number(process.env.API_PORT ?? 8787);

serve({ fetch: app.fetch, hostname: HOST, port: PORT }, (info) => {
  console.log(`API local em http://${info.address}:${info.port}/api`);
});
