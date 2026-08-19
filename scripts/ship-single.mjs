import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

// 把单文件构建产物完善为真正自包含的 HTML：
//  1. 将 favicon（svg/ico）从外部文件替换为内联 data URI，下载单个文件后图标仍可用；
//  2. 复制到部署输出目录，设置页「关于 → 下载单文件版」按钮指向 /with-work-single.html
//     （单文件模式不启用 PWA，public 静态资源不会被内联，必须显式处理图标）。

const htmlPath = "dist-single/index.html";
const html = readFileSync(htmlPath, "utf8");

const svg = readFileSync("public/favicon.svg").toString("base64");
const ico = readFileSync("public/favicon.ico").toString("base64");

const inlined = html
  .replace(
    /<link rel="icon"[^>]*href="[^"]*favicon\.ico"[^>]*\/>/,
    `<link rel="icon" type="image/x-icon" href="data:image/x-icon;base64,${ico}" />`,
  )
  .replace(
    /<link rel="icon"[^>]*href="[^"]*favicon\.svg"[^>]*\/>/,
    `<link rel="icon" type="image/svg+xml" href="data:image/svg+xml;base64,${svg}" />`,
  );

writeFileSync(htmlPath, inlined);
mkdirSync("dist", { recursive: true });
copyFileSync(htmlPath, "dist/with-work-single.html");
console.log("inlined favicon and copied -> dist/with-work-single.html");