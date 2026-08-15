import { beforeEach, describe, expect, it } from "vitest";
import {
  cleanupWorkspaceModels,
  getWorkspaceModels,
  resetWorkspaceModels,
} from "./workspaceModels";
import { useWorkspaceStore } from "@/stores/workspace";

beforeEach(() => {
  resetWorkspaceModels();
  localStorage.clear();
  useWorkspaceStore.getState().replaceAll([]);
});

describe("getWorkspaceModels", () => {
  it("首次访问为工作区创建左右模型（内容来自 store）", () => {
    const id = useWorkspaceStore.getState().createWorkspace();
    useWorkspaceStore.getState().setLeft(id, "左内容");
    useWorkspaceStore.getState().setRight(id, "右内容");

    const pair = getWorkspaceModels(id);
    expect(pair).not.toBeNull();
    expect(pair!.left.getValue()).toBe("左内容");
    expect(pair!.right.getValue()).toBe("右内容");
  });

  it("再次访问复用缓存的模型（不重复创建）", () => {
    const id = useWorkspaceStore.getState().createWorkspace();
    const first = getWorkspaceModels(id);
    const second = getWorkspaceModels(id);

    expect(second).toBe(first);
    expect(second!.left).toBe(first!.left);
    expect(second!.right).toBe(first!.right);
  });

  it("不存在的工作区返回 null", () => {
    expect(getWorkspaceModels("不存在的id")).toBeNull();
  });
});

describe("cleanupWorkspaceModels", () => {
  it("清理已删除工作区的模型", () => {
    const id = useWorkspaceStore.getState().createWorkspace();
    const pair = getWorkspaceModels(id)!;

    cleanupWorkspaceModels(new Set());
    expect(pair.left.isDisposed()).toBe(true);
    expect(pair.right.isDisposed()).toBe(true);
  });

  it("保留现存工作区的模型（撤销历史不丢）", () => {
    const id = useWorkspaceStore.getState().createWorkspace();
    const pair = getWorkspaceModels(id)!;

    cleanupWorkspaceModels(new Set([id]));
    expect(pair.left.isDisposed()).toBe(false);
    expect(pair.right.isDisposed()).toBe(false);
    // 再次获取仍是同一实例（undo/redo 栈跟随 Model 保留）
    expect(getWorkspaceModels(id)).toBe(pair);
  });

  it("删除工作区后重建会创建全新模型", () => {
    const id = useWorkspaceStore.getState().createWorkspace();
    const first = getWorkspaceModels(id)!;
    cleanupWorkspaceModels(new Set());
    expect(first.left.isDisposed()).toBe(true);

    const second = getWorkspaceModels(id)!;
    expect(second).not.toBe(first);
    expect(second.left.isDisposed()).toBe(false);
  });
});
