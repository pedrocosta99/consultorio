import { defineConfig, devices } from "@playwright/test";

/**
 * Testes visuais (screenshots) + acessibilidade (axe).
 * Relógio fixo em 2026-11-04 14:30 (Brasília); ver e2e/fixtures.ts.
 * Sobe um Vite próprio na porta 5174 para não brigar com o `pnpm dev`.
 */
const PORTA = 5174;

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
  webServer: {
    command: `pnpm exec vite --port ${PORTA} --strictPort`,
    url: `http://127.0.0.1:${PORTA}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
