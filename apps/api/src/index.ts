import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { MOEDA_PRINCIPAL } from "@consultorio/shared";

// SIGILO: o servidor escuta apenas no loopback. Nunca troque para 0.0.0.0.
const HOST = "127.0.0.1";
const PORT = Number(process.env.API_PORT ?? 8787);

export const app = new Hono().basePath("/api");

app.get("/health", (c) =>
  c.json({ ok: true, versao: "0.0.0", moedaPrincipal: MOEDA_PRINCIPAL }),
);

serve({ fetch: app.fetch, hostname: HOST, port: PORT }, (info) => {
  console.log(`API local em http://${info.address}:${info.port}/api`);
});
