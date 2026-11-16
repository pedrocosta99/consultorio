import { abrir, expect, semViolacoesA11y, test } from "./fixtures";

/**
 * Telas de acesso (login simulado). A simulação espera alguns ms com setTimeout, então
 * o relógio volta a andar antes de cada interação.
 */

test("?mock=deslogado leva à tela de entrar", async ({ page }) => {
  await page.goto("/?mock=deslogado");
  await expect(page).toHaveURL(/\/entrar/);
  await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await expect(page).toHaveScreenshot("entrar.png", { fullPage: true });
  await semViolacoesA11y(page);
});

test("entrar com e-mail que pede código do autenticador", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop-claro", "Fluxo: um projeto basta.");
  await page.goto("/entrar?mock=deslogado");
  await page.clock.resume();
  await page.getByLabel("E-mail").fill("ana.mfa@exemplo.com");
  await page.getByLabel("Senha").fill("qualquer");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Código de verificação" })).toBeVisible();
  await page.getByLabel("Código").fill("12345");
  await page.getByRole("button", { name: "Confirmar" }).click();
  await expect(page.getByRole("alert")).toContainText("6 números");
  await page.getByLabel("Código").fill("123456");
  await page.getByRole("button", { name: "Confirmar" }).click();
  await expect(page.getByRole("heading", { name: /Boa (tarde|noite|dia)/ })).toBeVisible();
});

test("menu da conta: sair volta para entrar; Google entra de novo", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop-claro", "Fluxo: um projeto basta.");
  await abrir(page, "/");
  await page.clock.resume();
  await page.getByRole("button", { name: /Conta de/ }).click();
  await expect(page.getByRole("menu")).toContainText("Dono");
  await page.getByRole("menuitem", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/entrar$/);
  await page.getByRole("button", { name: "Continuar com Google" }).click();
  await expect(page).toHaveURL(/\/$/);
});

for (const [nome, rota] of [
  ["esqueci", "/entrar/esqueci"],
  ["convite", "/convite/abc123"],
  ["sem-acesso", "/sem-acesso?email=fulana@exemplo.com"],
  ["codigo", "/entrar/codigo"],
] as const) {
  test(`${nome}: screenshot e acessibilidade`, async ({ page }) => {
    await page.goto(rota);
    await page.evaluate(() => document.fonts.ready);
    await page.locator("main").waitFor();
    await expect(page).toHaveScreenshot(`acesso-${nome}.png`, { fullPage: true });
    await semViolacoesA11y(page);
  });
}
