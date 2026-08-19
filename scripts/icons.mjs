/**
 * 从 src/assets/favicon.svg 生成各平台图标（favicon.ico + PWA PNG）。
 * 用法：pnpm icons（修改 SVG 后重新执行即可）
 */
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";
import pngToIco from "png-to-ico";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcSvg = path.join(root, "..", "src", "assets", "favicon.svg");
const publicDir = path.join(root, "..", "public");

async function renderPng(size, { pad = 0 } = {}) {
  const svg = await readFile(srcSvg);
  let img = sharp(svg, { density: 96 }).resize(size, size);
  if (pad > 0) {
    // maskable 安全区：四周留白
    img = img.extend({
      top: Math.round(size * pad),
      bottom: Math.round(size * pad),
      left: Math.round(size * pad),
      right: Math.round(size * pad),
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    });
  }
  return img.png().toBuffer();
}

async function main() {
  // 1. favicon.ico：多尺寸打包
  const icoSizes = [16, 32, 48, 256];
  const icoPngs = await Promise.all(icoSizes.map((s) => renderPng(s)));
  const ico = await pngToIco(icoPngs);
  await writeFile(path.join(publicDir, "favicon.ico"), ico);
  console.log("generated public/favicon.ico");

  // 2. PWA 图标
  const pwa192 = await renderPng(192);
  await writeFile(path.join(publicDir, "pwa-192x192.png"), pwa192);
  console.log("generated public/pwa-192x192.png");

  const pwa512 = await renderPng(512);
  await writeFile(path.join(publicDir, "pwa-512x512.png"), pwa512);
  console.log("generated public/pwa-512x512.png");

  // 3. maskable 图标（安全区留白 10%）
  const maskable = await renderPng(512, { pad: 0.1 });
  await writeFile(path.join(publicDir, "maskable-512x512.png"), maskable);
  console.log("generated public/maskable-512x512.png");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
