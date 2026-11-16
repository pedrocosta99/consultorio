import { abrir, expect, semViolacoesA11y, test } from "./fixtures";

const TELAS: Array<[nome: string, rota: string]> = [
  ["painel", "/"],
  ["agenda-semana", "/agenda?visao=semana"],
  ["agenda-dia", "/agenda?visao=dia"],
  ["agenda-mes", "/agenda?visao=mes"],
  ["pacientes", "/pacientes"],
  ["ficha", "/pacientes/p07"],
  ["ficha-sessoes", "/pacientes/p07?aba=sessoes"],
  ["financas", "/financas"],
  ["lancamentos", "/financas?aba=lancamentos"],
  ["divulgacao", "/financas?aba=divulgacao"],
  ["ficha-notas", "/pacientes/p07?aba=notas"],
  ["supervisao", "/supervisao"],
  ["a-receber", "/a-receber"],
  ["configuracoes", "/configuracoes"],
  ["lab", "/lab"],
  ["painel-vazio", "/?mock=vazio"],
  ["pacientes-vazio", "/pacientes?mock=vazio"],
  ["financas-vazio", "/financas?mock=vazio"],
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


test("finanças: diálogo de novo lançamento", async ({ page }) => {
  await abrir(page, "/financas?aba=lancamentos");
  await page.getByRole("button", { name: "Novo lançamento" }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page).toHaveScreenshot("lancamento-dialogo.png");
  await semViolacoesA11y(page);
});

test("finanças: tudo em reais (convertido)", async ({ page }) => {
  await abrir(page, "/configuracoes");
  await page.getByLabel("Em Finanças, mostrar").click();
  await page.getByRole("option", { name: "Tudo em Real (R$)" }).click();
  await abrir(page, "/financas");
  await expect(page.getByText(/convertidos para reais/)).toBeVisible();
  await expect(page).toHaveScreenshot("financas-convertido.png", { fullPage: true });
  await semViolacoesA11y(page);
});

test("registro de acesso: abrir a ficha fica anotado", async ({ page }) => {
  await abrir(page, "/pacientes/p07");
  await abrir(page, "/configuracoes");
  await page.getByRole("button", { name: "Ver os últimos acessos" }).click();
  await expect(page.getByText(/Abriu a ficha/).first()).toBeVisible();
});
