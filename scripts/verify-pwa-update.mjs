import { chromium } from "@playwright/test";
import { build, preview } from "vite";
import { findChromiumExecutable } from "./find-chromium.mjs";

const PORT = 4199;
const ORIGIN = `http://127.0.0.1:${PORT}`;

let server;
let browser;

try {
  console.log("1/7 构建初始版本…");
  await build();

  server = await preview({
    preview: { host: "127.0.0.1", port: PORT, strictPort: true },
  });

  browser = await chromium.launch({
    executablePath: findChromiumExecutable(),
    headless: true,
  });
  const page = await browser.newPage();
  await page.goto(ORIGIN);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, {
    timeout: 15_000,
  });

  console.log("2/7 安装旧版 Service Worker 成功");
  console.log("3/7 模拟发布新版本…");
  await build();

  const prompt = page.locator('aside[role="status"]').filter({ hasText: "发现新版本" });

  console.log("4/7 从设置页手动检查更新…");
  await page.getByLabel("设置", { exact: true }).click();
  const settings = page.getByRole("dialog", { name: "设置" });
  await settings.waitFor({ state: "visible", timeout: 10_000 });
  await settings.getByRole("button", { name: "检查更新" }).click();
  await prompt.waitFor({ state: "visible", timeout: 20_000 });

  console.log("5/7 关闭提示后再次手动检查…");
  await prompt.getByRole("button", { name: "稍后" }).click();
  await prompt.waitFor({ state: "hidden", timeout: 5_000 });
  await settings.getByRole("button", { name: "检查更新" }).click();
  await prompt.waitFor({ state: "visible", timeout: 10_000 });
  await prompt.getByRole("button", { name: "稍后" }).click();
  await prompt.waitFor({ state: "hidden", timeout: 5_000 });

  console.log("6/7 刷新页面并等待启动检查提示…");
  await page.reload();
  await prompt.waitFor({ state: "visible", timeout: 20_000 });

  console.log("7/7 应用更新…");
  const navigation = page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15_000 });
  await prompt.getByRole("button", { name: "立即更新" }).click();
  await navigation;

  const registration = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    return {
      controller: navigator.serviceWorker.controller?.scriptURL ?? null,
      active: reg?.active?.state ?? null,
      waiting: reg?.waiting?.state ?? null,
    };
  });
  if (!registration.controller || registration.active !== "activated" || registration.waiting) {
    throw new Error(`更新后 Service Worker 状态异常：${JSON.stringify(registration)}`);
  }

  console.log("PWA 更新验证通过", registration);
} finally {
  await browser?.close().catch(() => {});
  await server?.close().catch(() => {});
}
