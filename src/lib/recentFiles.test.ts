import { beforeEach, describe, expect, it, vi } from "vitest";

const recentDb = vi.hoisted(() => ({
  files: [] as Array<{
    id: string;
    name: string;
    handle: FileSystemFileHandle;
    lastOpenedAt: number;
    workspaceId?: string;
  }>,
  bindings: [] as Array<{
    workspaceId: string;
    name: string;
    handle: FileSystemFileHandle;
    boundAt: number;
    side: "left" | "right";
  }>,
}));

vi.mock("@/lib/persistenceDb", () => ({
  readRecentFiles: vi.fn(async () => [...recentDb.files]),
  writeRecentFile: vi.fn(async (record: (typeof recentDb.files)[number]) => {
    const index = recentDb.files.findIndex((item) => item.id === record.id);
    if (index >= 0) recentDb.files[index] = record;
    else recentDb.files.push(record);
    return true;
  }),
  deleteRecentFile: vi.fn(async (id: string) => {
    recentDb.files = recentDb.files.filter((item) => item.id !== id);
    return true;
  }),
  clearRecentFiles: vi.fn(async () => {
    recentDb.files = [];
    return true;
  }),
  readWorkspaceFiles: vi.fn(async () => [...recentDb.bindings]),
  writeWorkspaceFile: vi.fn(async (record: (typeof recentDb.bindings)[number]) => {
    const index = recentDb.bindings.findIndex((item) => item.workspaceId === record.workspaceId);
    if (index >= 0) recentDb.bindings[index] = record;
    else recentDb.bindings.push(record);
    return true;
  }),
  deleteWorkspaceFile: vi.fn(async (workspaceId: string) => {
    recentDb.bindings = recentDb.bindings.filter((item) => item.workspaceId !== workspaceId);
    return true;
  }),
  clearWorkspaceFiles: vi.fn(async () => {
    recentDb.bindings = [];
    return true;
  }),
}));

import {
  MAX_RECENT_FILES,
  clearWorkspaceFileBindings,
  clearRecentFileHistory,
  loadRecentFiles,
  pruneWorkspaceFileBindings,
  readRecentFile,
  recentFiles,
  rememberRecentFile,
  resetRecentFilesForTests,
  unbindFileForWorkspace,
  workspaceFileBindings,
} from "./recentFiles";

function createHandle(
  name: string,
  options: { permission?: PermissionState; sameAs?: string } = {},
) {
  return {
    name,
    kind: "file",
    getFile: async () => new File(["读取内容"], name, { type: "text/plain" }),
    queryPermission: async () => options.permission ?? "granted",
    requestPermission: async () => options.permission ?? "granted",
    isSameEntry: async (other: FileSystemFileHandle) => (options.sameAs ?? name) === other.name,
  } as unknown as FileSystemFileHandle;
}

beforeEach(() => {
  recentDb.files = [];
  recentDb.bindings = [];
  resetRecentFilesForTests();
});

describe("最近文件", () => {
  it("重复打开同一文件时移动绑定而不是新增重复项", async () => {
    const first = createHandle("one.txt");
    await rememberRecentFile({ handle: first, name: "one.txt", workspaceId: "w1" });
    await rememberRecentFile({ handle: first, name: "one-renamed.txt", workspaceId: "w2" });

    expect(recentFiles.value).toHaveLength(1);
    expect(recentFiles.value[0]).toMatchObject({ name: "one-renamed.txt" });
    expect(workspaceFileBindings.value).toEqual([
      expect.objectContaining({
        workspaceId: "w2",
        name: "one-renamed.txt",
        side: "left",
      }),
    ]);
  });

  it("最近历史最多保留固定数量，但工作区绑定不会被挤出", async () => {
    for (let index = 0; index < MAX_RECENT_FILES + 2; index++) {
      await rememberRecentFile({
        handle: createHandle(`${index}.txt`),
        name: `${index}.txt`,
        workspaceId: `w${index}`,
      });
    }

    expect(recentFiles.value).toHaveLength(MAX_RECENT_FILES);
    expect(recentDb.files).toHaveLength(MAX_RECENT_FILES);
    expect(workspaceFileBindings.value).toHaveLength(MAX_RECENT_FILES + 2);
    expect(recentDb.bindings).toHaveLength(MAX_RECENT_FILES + 2);
  });

  it("同一工作区另存为后只保留最新文件绑定", async () => {
    const first = createHandle("first.txt");
    const second = createHandle("second.txt");
    await rememberRecentFile({ handle: first, name: "first.txt", workspaceId: "w1" });
    await rememberRecentFile({ handle: second, name: "second.txt", workspaceId: "w1" });

    expect(workspaceFileBindings.value).toEqual([
      expect.objectContaining({ workspaceId: "w1", name: "second.txt", side: "left" }),
    ]);
    expect(recentDb.bindings).toEqual([
      expect.objectContaining({ workspaceId: "w1", name: "second.txt", side: "left" }),
    ]);
  });

  it("权限被拒绝时返回可读错误，不抛出异常", async () => {
    const handle = createHandle("blocked.txt", { permission: "denied" });
    await expect(
      readRecentFile({ id: "1", name: "blocked.txt", handle, lastOpenedAt: 1 }),
    ).resolves.toMatchObject({ ok: false, error: expect.stringContaining("权限") });
  });

  it("有权限时重新读取磁盘内容", async () => {
    const handle = createHandle("ok.txt");
    await expect(
      readRecentFile({ id: "1", name: "ok.txt", handle, lastOpenedAt: 1 }),
    ).resolves.toMatchObject({ ok: true, name: "ok.txt", text: "读取内容" });
  });

  it("清除历史不会丢失当前工作区绑定", async () => {
    await rememberRecentFile({
      handle: createHandle("clear.txt"),
      name: "clear.txt",
      workspaceId: "w1",
    });

    await clearRecentFileHistory();

    expect(recentFiles.value).toEqual([]);
    expect(recentDb.files).toEqual([]);
    expect(workspaceFileBindings.value).toHaveLength(1);
    expect(recentDb.bindings).toHaveLength(1);
  });

  it("清空全部数据时可单独清除工作区绑定", async () => {
    await rememberRecentFile({
      handle: createHandle("clear.txt"),
      name: "clear.txt",
      workspaceId: "w1",
    });

    await clearWorkspaceFileBindings();

    expect(workspaceFileBindings.value).toEqual([]);
    expect(recentDb.bindings).toEqual([]);
  });

  it("工作区删除后清理失联绑定", async () => {
    await rememberRecentFile({
      handle: createHandle("keep.txt"),
      name: "keep.txt",
      workspaceId: "keep",
    });
    await rememberRecentFile({
      handle: createHandle("remove.txt"),
      name: "remove.txt",
      workspaceId: "remove",
    });

    await pruneWorkspaceFileBindings(["keep"]);

    expect(workspaceFileBindings.value).toEqual([
      expect.objectContaining({ workspaceId: "keep", name: "keep.txt" }),
    ]);
    expect(recentDb.bindings).toEqual([
      expect.objectContaining({ workspaceId: "keep", name: "keep.txt" }),
    ]);
  });

  it("可单独解除工作区文件绑定而保留最近历史", async () => {
    await rememberRecentFile({
      handle: createHandle("unbind.txt"),
      name: "unbind.txt",
      workspaceId: "w1",
    });

    await expect(unbindFileForWorkspace("w1")).resolves.toMatchObject({
      name: "unbind.txt",
    });

    expect(workspaceFileBindings.value).toEqual([]);
    expect(recentDb.bindings).toEqual([]);
    expect(recentFiles.value).toHaveLength(1);
  });

  it("首次加载会把旧版 recent.workspaceId 迁移为工作区绑定", async () => {
    const handle = createHandle("legacy.txt");
    recentDb.files = [
      {
        id: "legacy",
        name: "legacy.txt",
        handle,
        lastOpenedAt: 10,
        workspaceId: "w-legacy",
      },
    ];

    await loadRecentFiles();

    expect(workspaceFileBindings.value).toEqual([
      expect.objectContaining({ workspaceId: "w-legacy", name: "legacy.txt" }),
    ]);
    expect(recentDb.bindings).toEqual([
      expect.objectContaining({ workspaceId: "w-legacy", name: "legacy.txt" }),
    ]);
    expect(recentDb.files[0].workspaceId).toBeUndefined();
  });
});
