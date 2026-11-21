import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import ToolsRail from "@/components/shared/ToolsRail.vue";
import { resetStores } from "@/test/resetStores";
import { useWorkspaceStore } from "@/stores/workspace";
import { resetRecentFilesForTests } from "@/lib/recentFiles";
import { clearRecentFiles } from "@/lib/persistenceDb";

beforeEach(async () => {
  resetStores();
  resetRecentFilesForTests();
  await clearRecentFiles();
  delete (window as Window & { showOpenFilePicker?: unknown }).showOpenFilePicker;
});

describe("ToolsRail 文件打开", () => {
  it("打开文本文件后创建同名工作区并写入左栏", async () => {
    const wrapper = mount(ToolsRail, { attachTo: document.body });
    const input = wrapper.get('input[type="file"][accept*=".txt"]');
    const file = {
      name: "会议记录.md",
      size: 6,
      text: async () => "会议内容",
    } as unknown as File;
    Object.defineProperty(input.element, "files", { configurable: true, value: [file] });

    await input.trigger("change");
    await vi.waitFor(() => {
      expect(useWorkspaceStore().workspaces[0]?.name).toBe("会议记录");
      expect(useWorkspaceStore().workspaces[0]?.left).toBe("会议内容");
    });
    wrapper.unmount();
  });

  it("支持系统文件选择器时直接创建同名工作区并写入", async () => {
    const handle = {
      name: "会议记录.md",
      kind: "file",
      getFile: async () => new File(["# 会议记录"], "会议记录.md", { type: "text/markdown" }),
      isSameEntry: async () => true,
      queryPermission: async () => "granted",
    } as unknown as FileSystemFileHandle;
    Object.defineProperty(window, "showOpenFilePicker", {
      configurable: true,
      value: vi.fn(async () => [handle]),
    });
    const wrapper = mount(ToolsRail, { attachTo: document.body });

    window.dispatchEvent(new CustomEvent("ww-open-text-file"));

    await vi.waitFor(() => {
      expect(useWorkspaceStore().workspaces[0]?.name).toBe("会议记录");
      expect(useWorkspaceStore().workspaces[0]?.left).toBe("# 会议记录");
    });
    wrapper.unmount();
  });
});
