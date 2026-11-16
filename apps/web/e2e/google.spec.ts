import type { Page } from "@playwright/test";
import { abrir, expect, semViolacoesA11y, test } from "./fixtures";

/**
 * Configurações → Google Agenda. As rotas da integração são simuladas aqui (estado em
 * memória do teste): conectar de verdade no banco compartilhado mudaria a tela de
 * Configurações dos outros testes.
 */
async function integracaoFalsa(page: Page) {
  let estado: Record<string, unknown> = { conectada: false };
  const chamadas: string[] = [];
  await page.route("**/api/integracoes/google**", async (route) => {
    const r = route.request();
    const caminho = new URL(r.url()).pathname.replace("/api/integracoes/google", "") || "/";
    chamadas.push(`${r.method()} ${caminho}`);
    if (caminho === "/calendarios") return route.fulfill({ json: [{ id: "consultorio", nome: "Consultório (criada pelo app)" }, { id: "primary", nome: "Agenda principal" }] });
    if (caminho === "/conectar") estado = { conectada: true, simulada: true, email: "conta.google@exemplo.com", calendarioId: "consultorio", calendarioNome: "Consultório (criada pelo app)", tituloSessao: "iniciais", ultimoSyncEm: null, erro: null, pendentes: 12, sincronizados: 0 };
    if (caminho === "/" && r.method() === "PUT") estado = { ...estado, ...r.postDataJSON() };
    if (caminho === "/sincronizar") {
      estado = { ...estado, pendentes: 0, sincronizados: 12, ultimoSyncEm: "2026-11-04T17:30:00.000Z" };
      return route.fulfill({ json: { ok: true, enviados: 12, falhas: 0 } });
    }
    if (caminho === "/desconectar") estado = { conectada: false };
    return route.fulfill({ json: r.method() === "GET" ? estado : { ok: true } });
  });
  return chamadas;
}

test("conectar, escolher o título, sincronizar e desconectar", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop-claro", "Fluxo: um projeto basta.");
  const chamadas = await integracaoFalsa(page);
  await abrir(page, "/configuracoes");
  const card = page.locator("#google-agenda");
  await card.getByRole("button", { name: "Conectar Google Agenda" }).click();
  await expect(card).toContainText("conta.google@exemplo.com");
  await expect(card).toContainText("Sessão ·");
  await expect(card).toContainText("12 mudanças na fila");

  await card.getByRole("radio", { name: "Só “Sessão”" }).click();
  await expect.poll(() => chamadas).toContain("PUT /");
  await card.getByRole("button", { name: "Sincronizar agora" }).click();
  await expect(card).toContainText("12 eventos no Google");

  await card.getByRole("button", { name: "Desconectar" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Desconectar" }).click();
  await expect(card.getByRole("button", { name: "Conectar Google Agenda" })).toBeVisible();
});

test("card conectado: screenshot e acessibilidade", async ({ page }) => {
  await integracaoFalsa(page);
  await abrir(page, "/configuracoes");
  const card = page.locator("#google-agenda");
  await card.getByRole("button", { name: "Conectar Google Agenda" }).click();
  await expect(card).toContainText("conta.google@exemplo.com");
  await expect(card).toHaveScreenshot("google-agenda-conectado.png");
  await semViolacoesA11y(page);
});
