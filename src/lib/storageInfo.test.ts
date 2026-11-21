import { afterEach, describe, expect, it, vi } from "vitest";
import { formatStorageBytes, readStorageInfo, requestPersistentStorage } from "./storageInfo";

afterEach(() => vi.unstubAllGlobals());

describe("本地存储信息", () => {
  it("读取浏览器估算用量与持久化状态", async () => {
    vi.stubGlobal("navigator", {
      storage: {
        estimate: async () => ({ usage: 2048, quota: 4096 }),
        persisted: async () => true,
      },
    });

    await expect(readStorageInfo()).resolves.toEqual({
      usage: 2048,
      quota: 4096,
      persisted: true,
    });
  });

  it("API 不可用或失败时返回未知而不是抛错", async () => {
    vi.stubGlobal("navigator", {
      storage: {
        estimate: async () => {
          throw new Error("denied");
        },
      },
    });

    await expect(readStorageInfo()).resolves.toEqual({
      usage: null,
      quota: null,
      persisted: null,
    });
  });

  it("按量级格式化容量", () => {
    expect(formatStorageBytes(512)).toBe("512 B");
    expect(formatStorageBytes(2048)).toBe("2.0 KB");
    expect(formatStorageBytes(3 * 1024 ** 2)).toBe("3.0 MB");
    expect(formatStorageBytes(2 * 1024 ** 3)).toBe("2.00 GB");
    expect(formatStorageBytes(null)).toBe("未知");
  });

  it("在用户手势中申请持久化存储并返回结果", async () => {
    const persist = vi.fn(async () => true);
    vi.stubGlobal("navigator", { storage: { persist } });

    await expect(requestPersistentStorage()).resolves.toBe(true);
    expect(persist).toHaveBeenCalledTimes(1);
  });
});
