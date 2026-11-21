import { beforeEach, describe, expect, it } from "vitest";
import { resetStores } from "@/test/resetStores";
import { useWorkspaceStore } from "@/stores/workspace";

beforeEach(() => {
  resetStores();
});

describe("workspace store", () => {
  it("创建时支持文件主名，空白名称回落到默认编号", () => {
    const store = useWorkspaceStore();
    const id = store.createWorkspace("  会议记录  ");
    expect(store.workspaces.find((workspace) => workspace.id === id)?.name).toBe("会议记录");

    store.createWorkspace("   ");
    expect(store.workspaces[1]?.name).toBe("工作区 2");
  });
});
