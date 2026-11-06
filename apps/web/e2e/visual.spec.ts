import { abrir, entrar, expect, semViolacoesA11y, test } from "./fixtures";

const TELAS: Array<[nome: string, rota: string]> = [
  ["painel", "/"],
  ["agenda-semana", "/agenda?visao=semana"],
  ["agenda-dia", "/agenda?visao=dia"],
  ["agenda-mes", "/agenda?visao=mes"],
  ["pacientes", "/pacientes"],
  ["ficha", "/pacientes/p07"],
  ["ficha-sessoes", "/pacientes/p07?aba=sessoes"],
  ["financas", "/financas"],
  ["transacoes", "/financas?aba=transacoes"],
  ["divulgacao", "/financas?aba=divulgacao"],
  ["ficha-notas", "/pacientes/p07?aba=notas"],
  ["supervisao", "/supervisao"],
  ["configuracoes", "/configuracoes"],
  ["lab", "/lab"],
  ["painel-vazio", "/?mock=vazio"],
  ["pacientes-vazio", "/pacientes?mock=vazio"],
  ["agenda-carregando", "/agenda?mock=carregando"],
];

for (const [nome, rota] of TELAS) {
  test(`${nome}: screenshot e acessibilidade`, async ({ page }) => {
    await abrir(page, rota);
    await expect(page).toHaveScreenshot(`${nome}.png`, { fullPage: true });
    await semViolacoesA11y(page);
  });
}

test("agenda: painel lateral da sessão", async ({ page }) => {
  await abrir(page, "/agenda?visao=semana");
  await page.getByRole("button", { name: /16:00\s*Lírio/ }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page).toHaveScreenshot("agenda-painel.png");
  await semViolacoesA11y(page);
});

test("Cmd+K abre a busca global", async ({ page }) => {
  await abrir(page, "/");
  await page.keyboard.press("ControlOrMeta+k");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page).toHaveScreenshot("busca-global.png");
});

test.describe("tela de PIN", () => {
  test.use({ semLogin: true });
  test("pede o PIN", async ({ page }) => {
    await entrar(page); // garante que o PIN já existe
    await page.context().clearCookies(); // …mas esta aba não tem sessão
    await abrir(page, "/");
    await expect(page.getByText("Digite seu PIN")).toBeVisible();
    await expect(page).toHaveScreenshot("acesso.png");
    await semViolacoesA11y(page);
  });
});
