import { beforeEach, describe, expect, it } from "vitest";
import { importText } from "./transfer";
import { useToastStore } from "@/stores/toast";
import { useWorkspaceStore } from "@/stores/workspace";
import { resetStores } from "@/test/resetStores";

beforeEach(() => {
  resetStores();
});

describe("importText", () => {
  it("导入到激活工作区的左栏并提示", () => {
    const store = useWorkspaceStore();
    const id = store.createWorkspace();

    importText("diff-left", "导入内容");

    expect(store.workspaces.find((w) => w.id === id)?.left).toBe("导入内容");
    expect(useToastStore().toasts.map((t) => t.message)).toContain("已导入到对比左侧");
  });

  it("导入到激活工作区的右栏", () => {
    const store = useWorkspaceStore();
    const id = store.createWorkspace();

    importText("diff-right", "右侧内容");

    expect(store.workspaces.find((w) => w.id === id)?.right).toBe("右侧内容");
  });

  it("没有激活工作区时不写入也不误报成功", () => {
    const store = useWorkspaceStore();
    store.replaceAll([]);

    importText("diff-left", "无处安放");

    expect(store.workspaces).toHaveLength(0);
    expect(useToastStore().toasts.map((t) => t.message).join("|")).not.toContain("已导入");
  });
});
