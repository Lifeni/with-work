import { describe, expect, it } from "vitest";
import {
  migrateWorkspaceState,
  normalizeWorkspace,
  normalizeWorkspaces,
} from "./workspaceMigration";

describe("normalizeWorkspace", () => {
  it("把只有旧版 content 的工作区迁移到左栏", () => {
    const w = normalizeWorkspace({ id: "w1", name: "旧工作区", content: "旧内容" });
    expect(w).toEqual({ id: "w1", name: "旧工作区", left: "旧内容", right: "" });
    // 内容已迁到左栏，旧的 content 不再保留（否则会被持久化永久写回）
    expect(Object.keys(w ?? {})).not.toContain("content");
  });

  it("content 与双栏内容不一致时保留，避免静默丢数据", () => {
    const w = normalizeWorkspace({
      id: "w1",
      name: "混合数据",
      left: "左栏内容",
      right: "",
      content: "另一份历史内容",
    });
    expect(w?.left).toBe("左栏内容");
    expect(w?.content).toBe("另一份历史内容");
  });

  it("已有 left/right 时不使用 content 覆盖", () => {
    const w = normalizeWorkspace({
      id: "w1",
      name: "新工作区",
      content: "过期的旧内容",
      left: "左",
      right: "右",
    });
    expect(w?.left).toBe("左");
    expect(w?.right).toBe("右");
  });

  it("丢弃 view/editorMode/language 等已废弃字段", () => {
    const w = normalizeWorkspace({
      id: "w1",
      name: "工作区",
      left: "a",
      right: "",
      view: "editor",
      editorMode: "dual",
      language: "auto",
    });
    expect(Object.keys(w ?? {}).sort()).toEqual(["id", "left", "name", "right"]);
  });

  it("缺少 id 的条目被丢弃，名称缺失时补默认名", () => {
    expect(normalizeWorkspace({ name: "没有 id" })).toBeNull();
    expect(normalizeWorkspace({ id: "w1" })?.name).toBe("工作区");
  });
});

describe("normalizeWorkspaces / migrateWorkspaceState", () => {
  it("过滤非法条目", () => {
    expect(normalizeWorkspaces([{ id: "a" }, null, 3, { name: "x" }])).toHaveLength(1);
    expect(normalizeWorkspaces("not-array")).toEqual([]);
  });

  it("activeId 指向不存在的条目时回落到第一个工作区", () => {
    const state = migrateWorkspaceState({
      workspaces: [{ id: "a", name: "A", content: "内容" }],
      activeId: "已删除的 id",
    });
    expect(state.activeId).toBe("a");
    expect(state.workspaces[0].left).toBe("内容");
  });

  it("没有工作区时 activeId 为 null", () => {
    expect(migrateWorkspaceState({ workspaces: [], activeId: "x" }).activeId).toBeNull();
  });
});
