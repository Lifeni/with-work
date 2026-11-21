import { expect, test, type Page } from "@playwright/test";

async function waitForEditor(page: Page) {
  await page.goto("/");
  await expect(page.locator('[data-ww-editor="left"] .monaco-editor')).toBeVisible({
    timeout: 20_000,
  });
}

test.beforeEach(async ({ page }) => {
  await waitForEditor(page);
});

test("Monaco 聚焦时 Ctrl+K 仍能打开命令面板", async ({ page }) => {
  const editor = page.locator('[data-ww-editor="left"] .monaco-editor');
  await editor.click();

  await page.keyboard.press("ControlOrMeta+K");

  const dialog = page.getByRole("dialog", { name: "命令面板" });
  await expect(dialog).toBeVisible();
  await expect(page.getByLabel("搜索命令")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("Monaco 聚焦时 Ctrl+F 聚焦查找输入框", async ({ page }) => {
  await page.locator('[data-ww-editor="left"] .monaco-editor').click();

  await page.keyboard.press("ControlOrMeta+F");

  await expect(page.getByRole("textbox", { name: "查找文本" })).toBeFocused();
});

test("文本文件拖入编辑器后在落点插入", async ({ page }) => {
  await page.evaluate(() => {
    const target = document.querySelector('[data-ww-editor="left"]');
    if (!target) throw new Error("找不到左编辑器");
    const transfer = new DataTransfer();
    transfer.items.add(new File(["拖入的文件内容"], "拖入.txt", { type: "text/plain" }));
    target.dispatchEvent(
      new DragEvent("dragover", {
        bubbles: true,
        cancelable: true,
        dataTransfer: transfer,
      }),
    );
    target.dispatchEvent(
      new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
        dataTransfer: transfer,
      }),
    );
  });

  await expect(page.locator('[data-ww-editor="left"] .view-lines')).toContainText("拖入的文件内容");
});

test("剪贴板按钮粘贴到聚焦编辑器", async ({ page }) => {
  await page.locator('[data-ww-editor="left"] .monaco-editor').click();
  await page.evaluate(() => navigator.clipboard.writeText("来自系统剪贴板"));

  await page.getByRole("button", { name: "从剪贴板粘贴到聚焦编辑器" }).click();

  await expect(page.locator('[data-ww-editor="left"] .view-lines')).toContainText("来自系统剪贴板");
});

test("系统文件选择器打开后可 Ctrl+S 写回原文件", async ({ page }) => {
  await page.addInitScript(() => {
    const targetWindow = window as Window & { __savedFileText?: string };
    targetWindow.__savedFileText = "";
    const handle = {
      name: "e2e-notes.txt",
      kind: "file",
      async getFile() {
        return new File(["初始内容"], "e2e-notes.txt", { type: "text/plain" });
      },
      async isSameEntry(other: FileSystemHandle) {
        return other.name === "e2e-notes.txt";
      },
      async queryPermission() {
        return "granted" as const;
      },
      async requestPermission() {
        return "granted" as const;
      },
      async createWritable() {
        return {
          async write(value: string) {
            targetWindow.__savedFileText = value;
          },
          async close() {},
          async abort() {},
        };
      },
    } as unknown as FileSystemFileHandle;
    Object.defineProperty(window, "showOpenFilePicker", {
      configurable: true,
      value: async () => [handle],
    });
  });
  await page.reload();
  await expect(page.locator('[data-ww-editor="left"] .monaco-editor')).toBeVisible({
    timeout: 20_000,
  });

  await page.getByRole("button", { name: "打开文件与最近文件" }).click();
  await page.getByRole("menuitem", { name: "打开文本文件…" }).click();
  const left = page.locator('[data-ww-editor="left"] .view-lines');
  await expect(left).toContainText("初始内容");

  await page.locator('[data-ww-editor="left"] .monaco-editor').click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.insertText("写回内容");
  await page.keyboard.press("ControlOrMeta+S");

  await expect(page.getByText("已保存到「e2e-notes.txt」")).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => (window as Window & { __savedFileText?: string }).__savedFileText ?? ""),
    )
    .toBe("写回内容");
});

test("右栏另存为后 Ctrl+S 仍写回右栏", async ({ page }) => {
  await page.addInitScript(() => {
    const target = window as Window & { __savedRightText?: string };
    target.__savedRightText = "";
    const handle = {
      name: "right-save.txt",
      kind: "file",
      async queryPermission() {
        return "granted" as const;
      },
      async requestPermission() {
        return "granted" as const;
      },
      async createWritable() {
        return {
          async write(value: string) {
            target.__savedRightText = value;
          },
          async close() {},
          async abort() {},
        };
      },
    } as unknown as FileSystemFileHandle;
    Object.defineProperty(window, "showSaveFilePicker", {
      configurable: true,
      value: async () => handle,
    });
  });
  await page.reload();
  await expect(page.locator('[data-ww-editor="right"] .monaco-editor')).toBeVisible({
    timeout: 20_000,
  });

  const right = page.locator('[data-ww-editor="right"] .monaco-editor');
  await right.click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.insertText("右栏原文");
  await page.keyboard.press("ControlOrMeta+Shift+S");
  await expect(page.getByText("已保存到「right-save.txt」")).toBeVisible();

  await right.click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.insertText("右栏原文-更新");
  await page.keyboard.press("ControlOrMeta+S");
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as Window & { __savedRightText?: string }).__savedRightText ?? "",
      ),
    )
    .toBe("右栏原文-更新");
});

test("刷新后从 IndexedDB/localStorage 恢复最后一次编辑", async ({ page }) => {
  const content = `刷新恢复-${Date.now()}`;
  await page.locator('[data-ww-editor="left"] .monaco-editor').click();
  await page.keyboard.insertText(content);
  await expect(
    page.locator('footer [role="status"]').filter({ hasText: "已自动保存" }),
  ).toBeVisible({ timeout: 10_000 });

  const persistedKeys = await page.evaluate(
    () =>
      new Promise<string[]>((resolve, reject) => {
        const request = indexedDB.open("with-work");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const getAll = request.result
            .transaction("state", "readonly")
            .objectStore("state")
            .getAllKeys();
          getAll.onsuccess = () => resolve(getAll.result.map(String));
          getAll.onerror = () => reject(getAll.error);
        };
      }),
  );
  expect(persistedKeys).toContain("ww:workspaces");

  await page.reload();
  await expect(page.locator('[data-ww-editor="left"] .monaco-editor')).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.locator('[data-ww-editor="left"] .view-lines')).toContainText(content);
});
