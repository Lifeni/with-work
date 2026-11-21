import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetStores } from "@/test/resetStores";
import { useWorkspaceStore } from "@/stores/workspace";

const recent = vi.hoisted(() => ({
  findFileForWorkspace: vi.fn(),
  readRecentFile: vi.fn(),
  rememberRecentFile: vi.fn(),
}));

const access = vi.hoisted(() => ({
  writeTextToHandle: vi.fn(),
  saveTextFileAs: vi.fn(),
}));

vi.mock("@/lib/recentFiles", () => recent);
vi.mock("@/lib/fileAccess", () => access);

import {
  openRecentInNewWorkspace,
  openTextInNewWorkspace,
  saveWorkspaceAs,
  saveWorkspaceToBoundFile,
} from "./fileWorkspace";

const handle = {
  name: "notes.txt",
  kind: "file",
} as FileSystemFileHandle;

beforeEach(() => {
  resetStores();
  vi.clearAllMocks();
});

describe("文件工作区", () => {
  it("打开文本时创建新工作区并记住文件句柄", async () => {
    const id = await openTextInNewWorkspace({
      name: "notes.txt",
      text: "内容",
      handle,
    });

    expect(useWorkspaceStore().workspaces.find((item) => item.id === id)).toMatchObject({
      name: "notes",
      left: "内容",
    });
    expect(recent.rememberRecentFile).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: id, name: "notes.txt" }),
    );
  });

  it("没有绑定文件时 Ctrl+S 返回 no-file，让调用方回退下载", async () => {
    recent.findFileForWorkspace.mockReturnValue(undefined);

    await expect(saveWorkspaceToBoundFile("w1", "text")).resolves.toMatchObject({
      ok: false,
      reason: "no-file",
    });
  });

  it("写回原文件成功后更新最近文件的最后使用时间", async () => {
    recent.findFileForWorkspace.mockReturnValue({
      name: "notes.txt",
      handle,
      workspaceId: "w1",
      boundAt: 1,
      side: "right",
    });
    access.writeTextToHandle.mockResolvedValue({
      ok: true,
      handle,
      name: "notes.txt",
    });

    await expect(saveWorkspaceToBoundFile("w1", "新内容")).resolves.toMatchObject({
      ok: true,
      name: "notes.txt",
    });
    expect(recent.rememberRecentFile).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: "w1", name: "notes.txt", side: "right" }),
    );
  });

  it("最近文件读取失败时不创建空工作区", async () => {
    recent.readRecentFile.mockResolvedValue({ ok: false, error: "权限失效" });
    const before = useWorkspaceStore().workspaces.length;

    const result = await openRecentInNewWorkspace({
      id: "r1",
      name: "notes.txt",
      handle,
      lastOpenedAt: 1,
    });

    expect(result).toMatchObject({ ok: false, reason: "read" });
    expect(useWorkspaceStore().workspaces).toHaveLength(before);
  });

  it("另存为成功后绑定新句柄", async () => {
    access.saveTextFileAs.mockResolvedValue({
      ok: true,
      handle,
      name: "copy.txt",
    });

    await expect(saveWorkspaceAs("w1", "工作区", "文本")).resolves.toMatchObject({
      ok: true,
      name: "copy.txt",
    });
    expect(recent.rememberRecentFile).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: "w1", name: "copy.txt" }),
    );
  });
});
