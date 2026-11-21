import { beforeEach, describe, expect, it, vi } from "vitest";

describe("PWA 安装提示", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("捕获 beforeinstallprompt 并返回用户选择", async () => {
    const { canInstall, initPwaInstall, promptInstall } = await import("./pwaInstall");
    initPwaInstall();
    const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
      prompt: vi.fn(async () => {}),
      userChoice: Promise.resolve({ outcome: "accepted", platform: "web" }),
    });
    window.dispatchEvent(event);

    expect(canInstall.value).toBe(true);
    await expect(promptInstall()).resolves.toBe("accepted");
    expect(canInstall.value).toBe(false);
  });
});
