import AxeBuilder from "@axe-core/playwright";
import { expect, test as base, type Page } from "@playwright/test";

/** Instante fixo dos testes: quarta, 4 nov 2026, 14:30 em Brasília. */
export const AGORA = new Date("2026-11-04T14:30:00-03:00");

/** Garante os dados fictícios no banco de teste (409 = já carregados por outro teste). */
async function semear(page: Page) {
  const r = await page.request.post("/api/dados-ficticios", { headers: { "x-consultorio": "1" } });
  expect([200, 409], await r.text()).toContain(r.status());
}

export const test = base.extend<{ page: Page }>({
  page: async ({ page }, use) => {
    await page.clock.install({ time: AGORA });
    await page.clock.pauseAt(AGORA);
    await semear(page);
    await use(page);
  },
});

/** Abre a rota e espera fontes e rede assentarem. */
export async function abrir(page: Page, rota: string) {
  await page.goto(rota);
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  await page.locator("main").waitFor();
}

/** Roda o axe e falha com a lista legível das violações. */
export async function semViolacoesA11y(page: Page) {
  // O axe usa timers; com o relógio pausado ele nunca termina.
  await page.clock.resume();
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const resumo = r.violations.map((v) => `${v.id} (${v.impact}): ${v.help}\n  ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join("\n  ")}`);
  expect(resumo, resumo.join("\n")).toEqual([]);
}

export { expect };
