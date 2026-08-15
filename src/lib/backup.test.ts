import { beforeEach, describe, expect, it } from "vitest";

import {
  collectBackup,
  parseBackup,
  parseRules,
  parseTemplates,
  parseTextTemplates,
} from "./backup";
import { useRulesStore } from "@/stores/rules";
import { useStagingStore } from "@/stores/staging";
import { useTemplatesStore } from "@/stores/templates";
import { useTextTemplatesStore } from "@/stores/textTemplates";
import { useWorkspaceStore } from "@/stores/workspace";

// 每个用例前重置所有 store，避免 persist 恢复的旧状态串扰
beforeEach(() => {
  localStorage.clear();
  useWorkspaceStore.getState().replaceAll([]);
  useStagingStore.getState().replaceAll([]);
  useRulesStore.getState().replaceAll([]);
  useTemplatesStore.getState().replaceAll([]);
  useTextTemplatesStore.getState().replaceAll([]);
});

const BASE_BACKUP = {
  app: "with-work",
  exportedAt: "2026-08-15T00:00:00.000Z",
  workspaces: [],
  staging: [],
  rules: [],
  settings: {},
  diff: { left: "", right: "" },
  list: { source: "", reference: "", compare: "" },
};

describe("parseBackup", () => {
  it("接受 v3 备份并保留 textTemplates", () => {
    const d = {
      ...BASE_BACKUP,
      version: 3,
      templates: [],
      textTemplates: [{ id: "1", name: "t", text: "x" }],
    };
    const r = parseBackup(JSON.stringify(d));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.version).toBe(3);
      expect(r.data.textTemplates).toHaveLength(1);
      expect(r.data.textTemplates[0].text).toBe("x");
    }
  });

  it("兼容 v2 备份并补空 textTemplates", () => {
    const d = { ...BASE_BACKUP, version: 2, templates: [] };
    const r = parseBackup(JSON.stringify(d));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.version).toBe(3);
      expect(r.data.textTemplates).toEqual([]);
    }
  });

  it("兼容 v1 备份并补空模板字段", () => {
    const d = { ...BASE_BACKUP, version: 1 };
    delete (d as Record<string, unknown>).templates;
    const r = parseBackup(JSON.stringify(d));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.version).toBe(3);
      expect(r.data.templates).toEqual([]);
      expect(r.data.textTemplates).toEqual([]);
    }
  });

  it("非 with-work 文件被拒绝", () => {
    const r = parseBackup(JSON.stringify({ app: "other", version: 3 }));
    expect(r.ok).toBe(false);
  });

  it("损坏的 JSON 被拒绝", () => {
    expect(parseBackup("{oops").ok).toBe(false);
  });

  it("不支持的版本被拒绝", () => {
    const d = { ...BASE_BACKUP, version: 99 };
    expect(parseBackup(JSON.stringify(d)).ok).toBe(false);
  });
});

describe("collectBackup", () => {
  it("收集全部数据且版本为 3", () => {
    useWorkspaceStore.getState().createWorkspace();
    useStagingStore.getState().add("hello");
    useRulesStore.getState().addRule({
      id: "r1",
      name: "规则",
      find: "a",
      replace: "b",
      isRegex: false,
      matchCase: false,
    });
    useTemplatesStore.getState().addTemplate({ id: "t1", name: "模板", items: ["x"] });
    useTextTemplatesStore.getState().addTemplate({ id: "tt1", name: "文本", text: "hi" });

    const d = collectBackup();
    expect(d.app).toBe("with-work");
    expect(d.version).toBe(3);
    expect(d.workspaces).toHaveLength(1);
    expect(d.workspaces[0].name).toBe("工作区 1");
    expect(d.staging).toHaveLength(1);
    expect(d.staging[0].text).toBe("hello");
    expect(d.rules).toHaveLength(1);
    expect(d.rules[0].name).toBe("规则");
    expect(d.templates).toHaveLength(1);
    expect(d.textTemplates).toHaveLength(1);
    expect(d.settings).toHaveProperty("theme");
    expect(d.exportedAt).toBeTruthy();
  });

  it("diff 反映当前激活工作区的左右内容", () => {
    const id = useWorkspaceStore.getState().createWorkspace();
    useWorkspaceStore.getState().setLeft(id, "左");
    useWorkspaceStore.getState().setRight(id, "右");
    const d = collectBackup();
    expect(d.diff).toEqual({ left: "左", right: "右" });
  });
});

describe("规则 / 模板解析", () => {
  it("parseRules 接受规则数组", () => {
    const r = parseRules(
      JSON.stringify([
        { id: "1", name: "n", find: "f", replace: "r", isRegex: false, matchCase: false },
      ]),
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.rules).toHaveLength(1);
  });

  it("parseRules 拒绝非数组", () => {
    expect(parseRules(JSON.stringify({ a: 1 })).ok).toBe(false);
  });

  it("parseRules 拒绝损坏的 JSON", () => {
    expect(parseRules("nope").ok).toBe(false);
  });

  it("parseTemplates 接受排序模板数组", () => {
    const r = parseTemplates(JSON.stringify([{ id: "1", name: "n", items: ["a", "b"] }]));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.templates).toHaveLength(1);
  });

  it("parseTextTemplates 接受文本模板数组", () => {
    const r = parseTextTemplates(JSON.stringify([{ id: "1", name: "n", text: "内容" }]));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.templates).toHaveLength(1);
  });
});
