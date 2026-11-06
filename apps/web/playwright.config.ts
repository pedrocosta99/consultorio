import { defineConfig, devices } from "@playwright/test";

import os from "node:os";
import path from "node:path";

/**
 * Testes visuais (screenshots) + acessibilidade (axe).
 * Sobe API + Vite próprios (portas 8798 e 5174), sem tocar no `pnpm dev` nem no
 * banco real: o banco de teste é temporário, recriado a cada execução, com os
 * dados fictícios e o relógio da API fixo no mesmo instante do navegador.
 */
const PORTA = 5174;
const PORTA_API = 8798;
export const AGORA_ISO = "2026-11-04T17:30:00.000Z"; // 14:30 em Brasília
const BANCO = path.join(os.tmpdir(), "consultorio-e2e", "teste.db");

const desktop = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };
const mobile = { ...devices["iPhone 13"], viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, defaultBrowserType: "chromium" as const };

export default defineConfig({
  testDir: "e2e",
  snapshotPathTemplate: "{testDir}/__screenshots__/{projectName}/{arg}{ext}",
  fullyParallel: true,
  reporter: [["list"]],
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.002, animations: "disabled", caret: "hide" } },
  use: {
    baseURL: `http://127.0.0.1:${PORTA}`,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    reducedMotion: "reduce",
  },
  projects: [
    { name: "desktop-claro", use: { ...desktop, colorScheme: "light" } },
    { name: "desktop-escuro", use: { ...desktop, colorScheme: "dark" } },
    { name: "mobile-claro", use: { ...mobile, colorScheme: "light" } },
    { name: "mobile-escuro", use: { ...mobile, colorScheme: "dark" } },
  ],
  webServer: [
    {
      command: `rm -rf "${path.dirname(BANCO)}" && pnpm --filter @consultorio/api exec tsx src/index.ts`,
      url: `http://127.0.0.1:${PORTA_API}/api/health`,
      env: { API_PORT: String(PORTA_API), CONSULTORIO_DB: BANCO, CONSULTORIO_AGORA: AGORA_ISO },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `pnpm exec vite --port ${PORTA} --strictPort`,
      url: `http://127.0.0.1:${PORTA}`,
      env: { API_PORT: String(PORTA_API), WEB_PORT: String(PORTA) },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
