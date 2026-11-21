import { afterEach, describe, expect, it, vi } from "vitest";
import type { PwaUpdateController } from "@/lib/pwaUpdate";
import {
  checkPwaUpdateNow,
  registerPwaUpdateController,
  unregisterPwaUpdateController,
} from "@/lib/pwaUpdateService";

function createController(ready: Promise<void>) {
  return {
    ready,
    checkForUpdate: vi.fn(async (): Promise<"latest" | "update"> => "latest"),
    showUpdatePrompt: vi.fn(() => true),
    updateServiceWorker: vi.fn(async () => {}),
    dispose: vi.fn(),
  } satisfies PwaUpdateController;
}

afterEach(() => {
  const cleanup = createController(Promise.resolve());
  registerPwaUpdateController(cleanup);
  unregisterPwaUpdateController(cleanup);
});

describe("PWA 手动检查", () => {
  it("等待 Service Worker 首次注册完成后再检查", async () => {
    let resolveReady!: () => void;
    const ready = new Promise<void>((resolve) => {
      resolveReady = resolve;
    });
    const controller = createController(ready);
    registerPwaUpdateController(controller);

    const pending = checkPwaUpdateNow();
    expect(controller.checkForUpdate).not.toHaveBeenCalled();

    resolveReady();
    await expect(pending).resolves.toBe("latest");
    expect(controller.checkForUpdate).toHaveBeenCalledTimes(1);
  });

  it("发现等待版本时重新唤起提示", async () => {
    const controller = createController(Promise.resolve());
    controller.checkForUpdate.mockResolvedValueOnce("update");
    registerPwaUpdateController(controller);

    await expect(checkPwaUpdateNow()).resolves.toBe("update");
    expect(controller.showUpdatePrompt).toHaveBeenCalledTimes(1);
  });
});
