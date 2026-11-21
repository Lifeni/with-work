import { expect, test, type Page } from "@playwright/test";

async function openSettings(page: Page) {
  await page.goto("/");
  await expect(page.locator('[data-ww-editor="left"] .monaco-editor')).toBeVisible({
    timeout: 20_000,
  });
  await page.getByRole("button", { name: "设置" }).click();
  const dialog = page.getByRole("dialog", { name: "设置" });
  await expect(dialog).toBeVisible();
  return dialog;
}

test("设置页窄屏保留边距、按钮间距一致且无横向溢出", async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 800 });
  const dialog = await openSettings(page);

  const box = await dialog.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(15);
  expect(600 - (box!.x + box!.width)).toBeGreaterThanOrEqual(15);

  const exportButton = page.getByRole("button", { name: "导出全部备份" });
  await expect(exportButton).toBeVisible();
  await expect(exportButton).toHaveCSS("height", "28px");
  await expect(exportButton.locator(".n-button__content")).toHaveCSS("gap", "6px");

  await page.getByText("深色", { exact: true }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(exportButton.locator(".n-button__content")).toHaveCSS("gap", "6px");

  await page.getByRole("button", { name: "检查更新" }).click();
  const toast = page.locator(".ww-toast").last();
  await expect(toast).toBeVisible();
  expect(
    await toast.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const topmost = document.elementFromPoint(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
      );
      return topmost === element || element.contains(topmost);
    }),
  ).toBe(true);

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test("设置页在 360px 下卡片内容不会被横向裁切", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  const dialog = await openSettings(page);

  const box = await dialog.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(15);
  expect(360 - (box!.x + box!.width)).toBeGreaterThanOrEqual(15);

  const widths = await dialog.evaluate((element) => {
    const settings = element.querySelector<HTMLElement>(".ww-settings-actions");
    return {
      dialog: {
        client: element.clientWidth,
        scroll: element.scrollWidth,
      },
      settings: settings
        ? {
            client: settings.clientWidth,
            scroll: settings.scrollWidth,
          }
        : null,
    };
  });

  expect(widths.dialog.scroll).toBeLessThanOrEqual(widths.dialog.client + 1);
  expect(widths.settings).not.toBeNull();
  expect(widths.settings!.scroll).toBeLessThanOrEqual(widths.settings!.client + 1);
});
