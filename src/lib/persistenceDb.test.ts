import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  readWorkspaceFiles,
  resetPersistenceDbConnection,
  writeWorkspaceFile,
} from "@/lib/persistenceDb";

afterEach(() => {
  resetPersistenceDbConnection();
  vi.unstubAllGlobals();
});

beforeEach(async () => {
  resetPersistenceDbConnection();
  await deleteDatabase();
});

function createLegacyDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("with-work", 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore("state", { keyPath: "key" });
      db.createObjectStore("recent-files", { keyPath: "id" });
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      request.result.close();
      resolve();
    };
  });
}

function upgradeDatabase(version: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("with-work", version);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      request.result.close();
      resolve();
    };
  });
}

function deleteDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase("with-work");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

describe("persistenceDb 升级", () => {
  it("从 v1 打开时补建 workspace-files 存储", async () => {
    await createLegacyDatabase();

    await expect(readWorkspaceFiles()).resolves.toEqual([]);

    const handle = { name: "notes.txt", kind: "file" } as FileSystemFileHandle;
    await writeWorkspaceFile({
      workspaceId: "w1",
      name: "notes.txt",
      handle,
      boundAt: 1,
      side: "right",
    });

    await expect(readWorkspaceFiles()).resolves.toEqual([
      {
        workspaceId: "w1",
        name: "notes.txt",
        handle,
        boundAt: 1,
        side: "right",
      },
    ]);
  });

  it("其他标签页升级数据库关闭旧连接后会重新建立连接", async () => {
    await createLegacyDatabase();
    await readWorkspaceFiles();

    await upgradeDatabase(3);
    const open = vi.spyOn(indexedDB, "open").mockImplementation(() => {
      throw new DOMException("测试中不重新打开更高版本数据库", "VersionError");
    });

    await readWorkspaceFiles();

    expect(open).toHaveBeenCalledWith("with-work", 2);
    open.mockRestore();
  });

  it("数据库打开失败后短时间内不会为每个操作重复尝试", async () => {
    const open = vi.fn(() => {
      throw new DOMException("数据库被阻塞", "InvalidStateError");
    });
    vi.stubGlobal("indexedDB", { open });

    await readWorkspaceFiles();
    await readWorkspaceFiles();

    expect(open).toHaveBeenCalledTimes(1);
  });
});
