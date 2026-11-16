/**
 * Gera os ícones do app (direção "Sálvia": a folha da marca sobre o verde principal).
 * Rode de novo se a cor principal padrão ou a marca mudarem:
 *
 *   pnpm --filter @consultorio/web exec node scripts/gerar-icones.mjs
 *
 * Saída em public/: favicon.svg, favicon.ico, apple-touch-icon.png, icon-192.png,
 * icon-512.png, icon-maskable-512.png (Android) e logo-120.png (tela de consentimento
 * do Google). As cores vêm dos tokens de index.css (oklch), convertidas pelo Chromium.
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const PUBLICO = path.resolve(import.meta.dirname, "../public");
// Tokens de index.css (tema claro, paleta Sálvia: matiz 152, croma 1).
const PRIMARIA = "oklch(0.47 0.065 152)";
const CLARO = "oklch(0.985 0.005 110)";
// A folha do lucide-react (a mesma da barra lateral).
const FOLHA = [
  "M11 20a10 10 0 0010-10 25.9 25.9 0 00-1.04-7.281 1 1 0 00-1.755-.325C15.833 5.5 13 5.5 9.8 6.1A7 7 0 0011 20",
  "M2 21a5 5 0 012.911-4.544C7.613 15.212 8.351 15.24 11 13",
];

/** SVG do ícone. `margem` = fração do lado reservada em volta da folha; `canto` = raio relativo. */
function svg(fundo, frente, { margem = 0.22, canto = 0.22 } = {}) {
  const lado = 24 / (1 - 2 * margem);
  const d = (lado - 24) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${lado} ${lado}">
  <rect width="${lado}" height="${lado}" rx="${lado * canto}" fill="${fundo}"/>
  <g transform="translate(${d} ${d})" fill="none" stroke="${frente}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    ${FOLHA.map((p) => `<path d="${p}"/>`).join("\n    ")}
  </g>
</svg>`;
}

/** ICO com uma imagem PNG dentro (formato aceito por todos os navegadores atuais). */
function ico(png, tamanho) {
  const h = Buffer.alloc(22);
  h.writeUInt16LE(0, 0); // reservado
  h.writeUInt16LE(1, 2); // tipo: ícone
  h.writeUInt16LE(1, 4); // 1 imagem
  h.writeUInt8(tamanho, 6);
  h.writeUInt8(tamanho, 7);
  h.writeUInt8(0, 8); // paleta
  h.writeUInt8(0, 9);
  h.writeUInt16LE(1, 10); // planos
  h.writeUInt16LE(32, 12); // bits
  h.writeUInt32LE(png.length, 14);
  h.writeUInt32LE(22, 18);
  return Buffer.concat([h, png]);
}

const navegador = await chromium.launch();
const pagina = await navegador.newPage({ deviceScaleFactor: 1 });

const hex = await pagina.evaluate((cores) => {
  const c = document.createElement("canvas").getContext("2d");
  return cores.map((cor) => {
    c.fillStyle = cor;
    c.fillRect(0, 0, 1, 1);
    const [r, g, b] = c.getImageData(0, 0, 1, 1).data;
    return `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
  });
}, [PRIMARIA, CLARO]);
const [verde, claro] = hex;
console.log("cores:", verde, claro);

async function png(arquivoSvg, tamanho) {
  await pagina.setViewportSize({ width: tamanho, height: tamanho });
  await pagina.setContent(`<html><body style="margin:0;background:transparent">${arquivoSvg.replace("<svg ", `<svg width="${tamanho}" height="${tamanho}" `)}</body></html>`);
  return pagina.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: tamanho, height: tamanho } });
}

const normal = svg(verde, claro);
// Maskable: fundo em tela cheia e folha dentro da zona segura (80% central).
const mascaravel = svg(verde, claro, { margem: 0.3, canto: 0 });
// iOS arredonda sozinho: quadrado cheio.
const apple = svg(verde, claro, { margem: 0.24, canto: 0 });

fs.writeFileSync(path.join(PUBLICO, "favicon.svg"), normal + "\n");
fs.writeFileSync(path.join(PUBLICO, "favicon.ico"), ico(await png(normal, 32), 32));
fs.writeFileSync(path.join(PUBLICO, "apple-touch-icon.png"), await png(apple, 180));
fs.writeFileSync(path.join(PUBLICO, "icon-192.png"), await png(normal, 192));
fs.writeFileSync(path.join(PUBLICO, "icon-512.png"), await png(normal, 512));
fs.writeFileSync(path.join(PUBLICO, "icon-maskable-512.png"), await png(mascaravel, 512));
fs.writeFileSync(path.join(PUBLICO, "logo-120.png"), await png(normal, 120));

await navegador.close();
console.log("ícones gerados em", PUBLICO);
