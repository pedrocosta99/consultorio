import type { Page, Route } from "@playwright/test";
import { abrir, expect, test } from "./fixtures";

/**
 * Interações da agenda no estilo do Google. O banco de teste é compartilhado com os
 * screenshots, então as gravações (POST/PATCH) são interceptadas: o teste confere o
 * que a tela mandaria para a API, sem mudar os dados.
 */
test.beforeEach(({}, info) => {
  test.skip(info.project.name !== "desktop-claro", "Interação com mouse: um projeto basta.");
});

interface Chamada {
  metodo: string;
  caminho: string;
  corpo: unknown;
}

async function interceptarGravacoes(page: Page, resposta: Record<string, unknown> = {}): Promise<Chamada[]> {
  const chamadas: Chamada[] = [];
  await page.route("**/api/**", async (route: Route) => {
    const r = route.request();
    if (r.method() === "GET") return route.continue();
    chamadas.push({ metodo: r.method(), caminho: new URL(r.url()).pathname, corpo: r.postDataJSON() });
    await route.fulfill({ json: { ok: true, ...resposta } });
  });
  return chamadas;
}

/** Ponto (x, y) na coluna do dia, no minuto do dia indicado. */
async function ponto(page: Page, dia: string, minuto: number) {
  const coluna = await page.locator(`[data-dia="${dia}"]`).boundingBox();
  const h = Math.floor(minuto / 60);
  const rotulo = await page.locator(`[data-hora="${h}"]`).boundingBox();
  const proxima = await page.locator(`[data-hora="${h + 1}"]`).boundingBox();
  if (!coluna || !rotulo || !proxima) throw new Error("grade não encontrada");
  const pxPorHora = proxima.y - rotulo.y;
  return { x: coluna.x + coluna.width / 2, y: rotulo.y - 2 + ((minuto % 60) / 60) * pxPorHora + 4 };
}

test("clicar num horário vazio abre a sessão avulsa já com data e hora", async ({ page }) => {
  await interceptarGravacoes(page);
  await abrir(page, "/agenda?visao=dia&data=2026-11-07");
  const p = await ponto(page, "2026-11-07", 10 * 60);
  await page.mouse.click(p.x, p.y);
  const dialogo = page.getByRole("dialog", { name: "Sessão avulsa" });
  await expect(dialogo).toBeVisible();
  await expect(dialogo.getByLabel("Data")).toHaveValue("2026-11-07");
  await expect(dialogo.getByLabel(/^Hora/)).toHaveValue("10:00");
  await expect(dialogo.getByLabel("Duração (min)")).toHaveValue("50");
});

test("arrastar num horário vazio escolhe a duração", async ({ page }) => {
  await interceptarGravacoes(page);
  await abrir(page, "/agenda?visao=dia&data=2026-11-07");
  const a = await ponto(page, "2026-11-07", 10 * 60);
  const b = await ponto(page, "2026-11-07", 11 * 60 + 20);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 8 });
  await page.mouse.up();
  const dialogo = page.getByRole("dialog", { name: "Sessão avulsa" });
  await expect(dialogo.getByLabel(/^Hora/)).toHaveValue("10:00");
  await expect(dialogo.getByLabel("Duração (min)")).toHaveValue("90");
});

test("C cria uma sessão no dia aberto", async ({ page }) => {
  await interceptarGravacoes(page);
  await abrir(page, "/agenda?visao=dia&data=2026-11-07");
  await page.locator("main").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("c");
  await expect(page.getByRole("dialog", { name: "Sessão avulsa" }).getByLabel(/^Hora/)).toHaveValue("09:00");
});

async function sessaoDaGrade(page: Page) {
  // Uma sessão futura da grade fixa (arrastável), na semana do relógio fixo.
  const bloco = page.locator('[aria-roledescription="sessão arrastável"]').filter({ hasText: "Agendada" }).last();
  await expect(bloco).toBeVisible();
  return bloco;
}

test("arrastar uma sessão da grade pergunta o alcance; 'esta e as seguintes' chama a API", async ({ page }) => {
  const chamadas = await interceptarGravacoes(page, { mantidas: 0 });
  await abrir(page, "/agenda?visao=semana&data=2026-11-04");
  const bloco = await sessaoDaGrade(page);
  const caixa = (await bloco.boundingBox())!;
  await page.mouse.move(caixa.x + caixa.width / 2, caixa.y + 6);
  await page.mouse.down();
  await page.mouse.move(caixa.x + caixa.width / 2, caixa.y + 6 + 48, { steps: 10 }); // +1 h
  await page.mouse.up();
  // O dnd-kit bloqueia cliques por 50 ms depois de soltar; com o relógio pausado, isso não passaria.
  await page.clock.runFor(100);

  const pergunta = page.getByRole("dialog", { name: "Alterar sessão do horário fixo" });
  await expect(pergunta).toBeVisible();
  await expect(pergunta.getByRole("radio", { name: /Só esta sessão/ })).toHaveAttribute("aria-checked", "true");
  await pergunta.getByRole("radio", { name: /Esta e as seguintes/ }).click();
  await pergunta.getByRole("button", { name: "OK" }).click();

  await expect(page.getByRole("status").filter({ hasText: "Horário fixo" })).toBeVisible();
  const c = chamadas.find((x) => x.caminho.endsWith("/seguintes"));
  expect(c?.metodo).toBe("POST");
  expect(c?.corpo).toMatchObject({ duracaoMin: expect.any(Number), inicio: expect.any(String) });
});

test("puxar a borda muda a duração; 'só esta' vira remarcada", async ({ page }) => {
  const chamadas = await interceptarGravacoes(page);
  await abrir(page, "/agenda?visao=semana&data=2026-11-04");
  const bloco = await sessaoDaGrade(page);
  const caixa = (await bloco.boundingBox())!;
  const borda = { x: caixa.x + caixa.width / 2, y: caixa.y + caixa.height - 3 };
  await page.mouse.move(borda.x, borda.y);
  await page.mouse.down();
  await page.mouse.move(borda.x, borda.y + 12, { steps: 6 }); // +15 min (48 px/h)
  await page.mouse.up();

  const pergunta = page.getByRole("dialog", { name: "Alterar sessão do horário fixo" });
  await expect(pergunta).toBeVisible();
  await pergunta.getByRole("button", { name: "OK" }).click();
  await expect(page.getByRole("status").filter({ hasText: "agora com" })).toBeVisible();
  const c = chamadas.find((x) => x.metodo === "PATCH");
  expect(c?.corpo).toMatchObject({ estado: "remarcada" });
  expect(c?.corpo).toMatchObject({ duracaoMin: 60 }); // 50 + 15 → encaixa em 60
});
