import { beforeEach, describe, expect, it } from "vitest";

import {
  applyBackup,
  clearAllStoredData,
  collectBackup,
  parseBackup,
  parseRules,
  parseTemplates,
  parseTextTemplates,
  workspaceExportText,
} from "./backup";
import { SEEDED_KEY } from "./storageKeys";
import { seedDefaultData } from "./defaultData";
import { useRulesStore } from "@/stores/rules";
import { useSettingsStore } from "@/stores/settings";
import { useStagingStore } from "@/stores/staging";
import { useTemplatesStore } from "@/stores/templates";
import { useTextTemplatesStore } from "@/stores/textTemplates";
import { useWorkspaceStore } from "@/stores/workspace";

// 每个用例前重置所有 store，避免 persist 恢复的旧状态串扰
beforeEach(() => {
  localStorage.clear();
  useWorkspaceStore().replaceAll([]);
  useStagingStore().replaceAll([]);
  useRulesStore().replaceAll([]);
  useTemplatesStore().replaceAll([]);
  useTextTemplatesStore().replaceAll([]);
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
  it("接受 v3 备份并保留 textTemplates，升级到最新版本", () => {
    const d = {
      ...BASE_BACKUP,
      version: 3,
      templates: [],
      textTemplates: [{ id: "1", name: "t", text: "x" }],
    };
    const r = parseBackup(JSON.stringify(d));
    expect(r.ok).toBe(true);
    if (r.ok) {
      // 保留源版本号：applyBackup 需要据此判断旧版才用 diff 兜底
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
      expect(r.data.version).toBe(2);
      expect(r.data.textTemplates).toEqual([]);
    }
  });

  it("兼容 v1 备份并补空模板字段", () => {
    const d = { ...BASE_BACKUP, version: 1 };
    delete (d as Record<string, unknown>).templates;
    const r = parseBackup(JSON.stringify(d));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.version).toBe(1);
      expect(r.data.templates).toEqual([]);
      expect(r.data.textTemplates).toEqual([]);
    }
  });

  it("接受最新 v4 备份", () => {
    const d = { ...BASE_BACKUP, version: 4, templates: [], textTemplates: [] };
    const r = parseBackup(JSON.stringify(d));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.version).toBe(4);
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
  it("收集全部数据且版本为 4", () => {
    useWorkspaceStore().createWorkspace();
    useStagingStore().add("hello");
    useRulesStore().addRule({
      id: "r1",
      name: "规则",
      find: "a",
      replace: "b",
      isRegex: false,
      matchCase: false,
    });
    useTemplatesStore().addTemplate({ id: "t1", name: "模板", items: ["x"] });
    useTextTemplatesStore().addTemplate({ id: "tt1", name: "文本", text: "hi" });

    const d = collectBackup();
    expect(d.app).toBe("with-work");
    expect(d.version).toBe(4);
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
    const id = useWorkspaceStore().createWorkspace();
    useWorkspaceStore().setLeft(id, "左");
    useWorkspaceStore().setRight(id, "右");
    const d = collectBackup();
    expect(d.diff).toEqual({ left: "左", right: "右" });
  });

  it("设置包含暂存区模板高度（备份不再丢该设置）", () => {
    useSettingsStore().setStagingTemplateHeight(300);
    expect(collectBackup().settings.stagingTemplateHeight).toBe(300);
  });

  it("不再写入已废弃的 list 字段", () => {
    useWorkspaceStore().createWorkspace();
    expect(collectBackup()).not.toHaveProperty("list");
  });

  it("仍能读取含废弃 list 字段的旧备份", () => {
    const r = parseBackup(JSON.stringify({ ...BASE_BACKUP, version: 3, templates: [] }));
    expect(r.ok).toBe(true);
  });

  it("宽容处理缺字段的备份：补默认值而不是让恢复流程抛错", () => {
    const r = parseBackup(JSON.stringify({ app: "with-work", version: 4, workspaces: [] }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.data.staging).toEqual([]);
    expect(r.data.rules).toEqual([]);
    expect(r.data.templates).toEqual([]);
    expect(r.data.textTemplates).toEqual([]);
    // 设置会逐字段补齐为完整默认值（theme 缺失时跟随系统，而不是被强制浅色）
    expect(r.data.settings.theme).toBe("system");
    expect(r.data.settings.fontSize).toBe(14);
    expect(r.data.diff).toEqual({ left: "", right: "" });
    expect(() => applyBackup(r.data)).not.toThrow();
  });

  it("缺少 workspaces 的残缺备份被拒绝，避免静默清空现有工作区", () => {
    const r = parseBackup(JSON.stringify({ app: "with-work", version: 4 }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("工作区");
  });

  it("workspaces 非数组时同样拒绝", () => {
    const r = parseBackup(JSON.stringify({ app: "with-work", version: 4, workspaces: "坏数据" }));
    expect(r.ok).toBe(false);
  });

  it("旧备份缺少 theme 时补为跟随系统，而不是被强制成浅色", () => {
    const r = parseBackup(
      JSON.stringify({ ...BASE_BACKUP, version: 1, workspaces: [], settings: {} }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.settings.theme).toBe("system");
  });

  it("设置里类型不对的字段在导入时被校验掉", () => {
    const r = parseBackup(
      JSON.stringify({
        ...BASE_BACKUP,
        version: 4,
        workspaces: [],
        settings: { theme: "dark", fontSize: "big", wordWrap: 0 },
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.settings.theme).toBe("dark");
    expect(r.data.settings.fontSize).toBe(14);
    expect(r.data.settings.wordWrap).toBe(true);
  });

  it("version 为非数字时给出「文件损坏」而不是误报版本不支持", () => {
    const r = parseBackup(JSON.stringify({ ...BASE_BACKUP, version: "3", workspaces: [] }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("损坏");
  });

  it("v1/v2 的 diff 只回填到没有内容的工作区", () => {
    const d = {
      ...BASE_BACKUP,
      version: 2,
      workspaces: [{ id: "w1", name: "一号", content: "一号自己的内容" }],
      diff: { left: "别的工作区的快照", right: "" },
    };
    const r = parseBackup(JSON.stringify(d));
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    applyBackup(r.data);

    expect(useWorkspaceStore().workspaces[0].left).toBe("一号自己的内容");
  });

  it("导入旧备份时把只有 content 的工作区迁移到左栏", () => {
    const d = {
      ...BASE_BACKUP,
      version: 3,
      templates: [],
      textTemplates: [],
      workspaces: [{ id: "w1", name: "旧工作区", content: "旧版单栏内容" }],
    };
    const r = parseBackup(JSON.stringify(d));
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    applyBackup(r.data);

    const ws = useWorkspaceStore().workspaces[0];
    expect(ws.left).toBe("旧版单栏内容");
    expect(ws.right).toBe("");
  });

  it("导入 v1/v2 备份时用 diff 填补空栏，且不覆盖已迁移的内容", () => {
    const d = {
      ...BASE_BACKUP,
      version: 2,
      workspaces: [{ id: "w1", name: "旧工作区", content: "单栏内容" }],
      diff: { left: "左栏", right: "右栏" },
    };
    const r = parseBackup(JSON.stringify(d));
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    applyBackup(r.data);

    const ws = useWorkspaceStore().workspaces[0];
    // 左栏保留迁移出来的单栏内容，右栏此前为空，用 diff 补上
    expect(ws.left).toBe("单栏内容");
    expect(ws.right).toBe("右栏");
  });

  it("导入 v1/v2 备份且工作区没有任何内容时，diff 两栏都回填", () => {
    const d = {
      ...BASE_BACKUP,
      version: 1,
      workspaces: [{ id: "w1", name: "空工作区" }],
      diff: { left: "左栏", right: "右栏" },
    };
    const r = parseBackup(JSON.stringify(d));
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    applyBackup(r.data);

    const ws = useWorkspaceStore().workspaces[0];
    expect(ws.left).toBe("左栏");
    expect(ws.right).toBe("右栏");
  });

  it("导入 v3/v4 备份时不把 diff 快照覆盖到恢复出的工作区", () => {
    const d = {
      ...BASE_BACKUP,
      version: 4,
      templates: [],
      textTemplates: [],
      workspaces: [{ id: "w1", name: "一号", left: "一号自己的内容", right: "右栏" }],
      diff: { left: "另一个工作区的快照", right: "快照右栏" },
    };
    const r = parseBackup(JSON.stringify(d));
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    applyBackup(r.data);

    const ws = useWorkspaceStore().workspaces[0];
    expect(ws.left).toBe("一号自己的内容");
    expect(ws.right).toBe("右栏");
  });
});

describe("workspaceExportText", () => {
  it("单栏时导出左栏内容", () => {
    const ws = { id: "w1", name: "工作区", left: "只有左栏" };
    expect(workspaceExportText(ws)).toBe("只有左栏");
  });

  it("双栏时用分隔线拼接左右内容", () => {
    const ws = { id: "w1", name: "工作区", left: "左", right: "右" };
    expect(workspaceExportText(ws)).toBe("左\n\n===== with-work split =====\n\n右");
  });

  it("只有右栏时导出右栏内容", () => {
    const ws = { id: "w1", name: "工作区", left: "", right: "只有右栏" };
    expect(workspaceExportText(ws)).toBe("只有右栏");
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

describe("clearAllStoredData", () => {
  it("连同内置数据标记一起清除，使内置规则与模板可以重新注入", () => {
    localStorage.setItem(SEEDED_KEY, JSON.stringify(["builtin-rule-angle-bracket"]));
    localStorage.setItem("ww:staging", JSON.stringify({ items: [{ id: "s1", text: "x" }] }));
    useRulesStore().replaceAll([]);
    useTemplatesStore().replaceAll([]);

    clearAllStoredData();

    expect(localStorage.getItem(SEEDED_KEY)).toBeNull();
    expect(localStorage.getItem("ww:staging")).toBeNull();

    // 清空后重新注入：内置规则与排序模板必须回来
    seedDefaultData();
    expect(useRulesStore().rules.map((r) => r.id)).toContain("builtin-rule-angle-bracket");
    expect(useTemplatesStore().templates.map((t) => t.id)).toContain(
      "builtin-sort-shandong-cities",
    );
  });
});
