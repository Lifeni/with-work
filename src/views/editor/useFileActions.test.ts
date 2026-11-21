import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetStores } from "@/test/resetStores";
import { createMockEditor } from "@/test/mockEditor";
import { setActiveEditor } from "@/lib/editorBridge";
import { useToastStore } from "@/stores/toast";
import { useWorkspaceStore } from "@/stores/workspace";
import { resetRecentFilesForTests, workspaceFileBindings } from "@/lib/recentFiles";

const workspaceFiles = vi.hoisted(() => ({
  saveWorkspaceAs: vi.fn(),
  saveWorkspaceToBoundFile: vi.fn(),
  suggestedTextFileName: vi.fn((name: string) => `${name}.txt`),
}));
const fileAccess = vi.hoisted(() => ({
  supportsSaveFilePicker: vi.fn(),
}));
const utils = vi.hoisted(() => ({
  downloadText: vi.fn(),
}));

vi.mock("@/lib/fileWorkspace", () => workspaceFiles);
vi.mock("@/lib/fileAccess", () => fileAccess);
vi.mock("@/lib/utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/utils")>()),
  downloadText: utils.downloadText,
}));

import { useFileActions } from "./useFileActions";

beforeEach(() => {
  resetStores();
  resetRecentFilesForTests();
  vi.clearAllMocks();
  workspaceFiles.suggestedTextFileName.mockImplementation((name: string) => `${name}.txt`);
});

afterEach(() => setActiveEditor(null));

function setupEditor(text = "内容") {
  const workspaceId = useWorkspaceStore().createWorkspace("笔记");
  useWorkspaceStore().setLeft(workspaceId, text);
  setActiveEditor(createMockEditor(text).editor);
  return workspaceId;
}

describe("编辑器文件保存", () => {
  it("未绑定原文件时 Ctrl+S 下载 txt", async () => {
    setupEditor();
    workspaceFiles.saveWorkspaceToBoundFile.mockResolvedValue({
      ok: false,
      reason: "no-file",
    });

    await useFileActions().saveFocused();

    expect(utils.downloadText).toHaveBeenCalledWith(
      expect.stringMatching(/^笔记-\d{4}-\d{2}-\d{2}-\d{6}\.txt$/),
      "内容",
    );
    expect(useToastStore().toasts.at(-1)?.message).toBe("已保存到下载");
  });

  it("已绑定原文件时 Ctrl+S 直接写回", async () => {
    const workspaceId = setupEditor("左栏原文");
    workspaceFileBindings.value = [
      {
        workspaceId,
        name: "notes.txt",
        handle: {} as FileSystemFileHandle,
        boundAt: 1,
        side: "left",
      },
    ];
    workspaceFiles.saveWorkspaceToBoundFile.mockResolvedValue({
      ok: true,
      name: "notes.txt",
    });

    await useFileActions().saveFocused();

    expect(utils.downloadText).not.toHaveBeenCalled();
    expect(workspaceFiles.saveWorkspaceToBoundFile).toHaveBeenCalledWith(workspaceId, "左栏原文");
    expect(useToastStore().toasts.at(-1)?.message).toBe("已保存到「notes.txt」");
  });

  it("绑定右栏时即使焦点在左栏也只写回右栏内容", async () => {
    const workspaceId = setupEditor("左栏临时内容");
    useWorkspaceStore().setRight(workspaceId, "右栏原文");
    workspaceFileBindings.value = [
      {
        workspaceId,
        name: "notes.txt",
        handle: {} as FileSystemFileHandle,
        boundAt: 1,
        side: "right",
      },
    ];
    workspaceFiles.saveWorkspaceToBoundFile.mockResolvedValue({
      ok: true,
      name: "notes.txt",
    });

    await useFileActions().saveFocused();

    expect(workspaceFiles.saveWorkspaceToBoundFile).toHaveBeenCalledWith(workspaceId, "右栏原文");
  });

  it("不支持另存为时回退下载", async () => {
    setupEditor();
    fileAccess.supportsSaveFilePicker.mockReturnValue(false);

    await useFileActions().saveFocusedAs("left");

    expect(utils.downloadText).toHaveBeenCalledWith("笔记.txt", "内容");
    expect(useToastStore().toasts.at(-1)?.message).toContain("已下载文本");
  });

  it("另存为成功后提示目标文件", async () => {
    setupEditor();
    fileAccess.supportsSaveFilePicker.mockReturnValue(true);
    workspaceFiles.saveWorkspaceAs.mockResolvedValue({
      ok: true,
      name: "copy.txt",
    });

    await useFileActions().saveFocusedAs("left");

    expect(useToastStore().toasts.at(-1)?.message).toBe("已保存到「copy.txt」");
  });
});
