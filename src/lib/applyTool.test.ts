import { afterEach, describe, expect, it, vi } from "vitest";
import { applyTool } from "./applyTool";
import { setActiveEditor } from "./editorBridge";
import { resetStores } from "@/test/resetStores";
import { createMockEditor } from "@/test/mockEditor";
import { useWorkspaceStore } from "@/stores/workspace";
import { tools } from "@/tools/registry";

afterEach(() => {
  setActiveEditor(null);
  resetStores();
});

describe("applyTool 焦点恢复", () => {
  it("工具执行后把焦点还给编辑器（Ctrl+Z 可直接撤销）", () => {
    const store = useWorkspaceStore();
    store.createWorkspace();
    const mock = createMockEditor("ab");
    setActiveEditor(mock.editor);
    const spy = vi.spyOn(mock.editor, "focus");

    const upper = tools.find((t) => t.id === "text-upper")!;
    const res = applyTool(upper, (i) => i.toUpperCase());

    expect(mock.getValue()).toBe("AB");
    expect(spy).toHaveBeenCalledTimes(1);
    expect(res?.message).toContain("Ctrl+Z 可撤销");
  });

  it("无编辑器实例时回退到工作区 store", () => {
    const store = useWorkspaceStore();
    const id = store.createWorkspace();
    store.setLeft(id, "ab");

    const upper = tools.find((t) => t.id === "text-upper")!;
    const res = applyTool(upper, (i) => i.toUpperCase());

    expect(store.workspaces[0].left).toBe("AB");
    expect(res?.message).toBeTruthy();
  });
});
