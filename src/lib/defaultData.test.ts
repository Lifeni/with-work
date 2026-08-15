import { beforeEach, describe, expect, it } from "vitest";
import {
  DEPRECATED_BUILTIN_IDS,
  DEFAULT_RULES,
  DEFAULT_SORT_TEMPLATES,
  DEFAULT_TEXT_TEMPLATES,
  SEEDED_KEY,
  seedDefaultData,
} from "@/lib/defaultData";
import { useRulesStore } from "@/stores/rules";
import { useTemplatesStore } from "@/stores/templates";
import { useTextTemplatesStore } from "@/stores/textTemplates";
import { resetStores } from "@/test/resetStores";

describe("内置模板与规则", () => {
  beforeEach(() => {
    resetStores();
  });

  it("首次使用（无任何标记）时注入内置数据", () => {
    localStorage.clear();
    seedDefaultData();

    expect(useRulesStore.getState().rules).toEqual(DEFAULT_RULES);
    expect(useTemplatesStore.getState().templates).toEqual(DEFAULT_SORT_TEMPLATES);
    expect(useTextTemplatesStore.getState().templates).toEqual([]);
    // 注入后记录已注入 id，防止重复注入
    expect(JSON.parse(localStorage.getItem(SEEDED_KEY) ?? "[]")).toHaveLength(
      DEFAULT_RULES.length + DEFAULT_SORT_TEMPLATES.length + DEFAULT_TEXT_TEMPLATES.length,
    );
  });

  it("单书名号替换规则的名称与内容正确", () => {
    localStorage.clear();
    seedDefaultData();

    const rule = useRulesStore.getState().rules[0];
    expect(rule.name).toBe("单书名号替换");
    expect(rule.find).toBe("<(.+?)>");
    expect(rule.replace).toBe("〈$1〉");
    expect(rule.isRegex).toBe(true);
  });

  it("山东 16 市模板保持用户给定顺序并默认开头匹配", () => {
    localStorage.clear();
    seedDefaultData();

    const t = useTemplatesStore.getState().templates[0];
    expect(t.name).toBe("山东 16 市");
    expect(t.prefixMatch).toBe(true);
    expect(t.items).toEqual([
      "济南",
      "青岛",
      "淄博",
      "枣庄",
      "东营",
      "烟台",
      "潍坊",
      "济宁",
      "泰安",
      "威海",
      "日照",
      "临沂",
      "德州",
      "聊城",
      "滨州",
      "菏泽",
    ]);
  });

  it("用户清空全部数据后不再重复注入", () => {
    localStorage.clear();
    seedDefaultData();
    // 用户清空
    useRulesStore.getState().replaceAll([]);
    useTemplatesStore.getState().replaceAll([]);
    useTextTemplatesStore.getState().replaceAll([]);

    seedDefaultData();

    expect(useRulesStore.getState().rules).toEqual([]);
    expect(useTemplatesStore.getState().templates).toEqual([]);
    expect(useTextTemplatesStore.getState().templates).toEqual([]);
  });

  it("用户删除的内置项不会复活", () => {
    localStorage.clear();
    seedDefaultData();
    const store = useRulesStore.getState();
    const first = store.rules[0];
    expect(first).toBeDefined();

    store.removeRule(first.id);
    seedDefaultData();

    expect(useRulesStore.getState().rules.some((r) => r.id === first.id)).toBe(false);
  });

  it("历史版本注入过的旧内置项会从用户数据中自动移除", () => {
    localStorage.clear();
    // 模拟老用户：旧内置项已在数据中且 seeded 已记录
    useRulesStore.getState().replaceAll([
      {
        id: "builtin-rule-trailing-space",
        name: "清理行尾空格",
        find: "[ \\t]+$",
        replace: "",
        isRegex: true,
        matchCase: false,
      },
      ...DEFAULT_RULES,
    ]);
    useTemplatesStore.getState().replaceAll([
      { id: "builtin-sort-weekday", name: "星期顺序", items: ["周一"], group: "内置" },
      ...DEFAULT_SORT_TEMPLATES,
    ]);
    useTextTemplatesStore.getState().replaceAll([
      { id: "builtin-text-codeblock", name: "Markdown 代码块", text: "```", group: "内置" },
    ]);
    localStorage.setItem(SEEDED_KEY, JSON.stringify([...DEPRECATED_BUILTIN_IDS]));

    seedDefaultData();

    const rules = useRulesStore.getState().rules;
    expect(rules.some((r) => r.id === "builtin-rule-trailing-space")).toBe(false);
    expect(rules).toEqual(DEFAULT_RULES);
    const templates = useTemplatesStore.getState().templates;
    expect(templates.some((t) => t.id === "builtin-sort-weekday")).toBe(false);
    expect(templates).toEqual(DEFAULT_SORT_TEMPLATES);
    expect(useTextTemplatesStore.getState().templates).toEqual([]);
  });

  it("老用户已有的内置模板自动补齐开头匹配属性", () => {
    localStorage.clear();
    // 模拟老用户：山东 16 市已存在但缺 prefixMatch 字段（旧版本注入）
    useTemplatesStore.getState().addTemplate({
      id: "builtin-sort-shandong-cities",
      name: "山东 16 市",
      items: ["济南", "青岛"],
      group: "内置",
    });
    localStorage.setItem(SEEDED_KEY, JSON.stringify(["builtin-sort-shandong-cities"]));

    seedDefaultData();

    const t = useTemplatesStore.getState().templates.find(
      (x) => x.id === "builtin-sort-shandong-cities",
    );
    expect(t?.prefixMatch).toBe(true);
    // 用户显式关闭过（prefixMatch 非 undefined）不会被覆盖
    useTemplatesStore
      .getState()
      .updateTemplate({ ...t!, prefixMatch: false });
    seedDefaultData();
    expect(
      useTemplatesStore.getState().templates.find((x) => x.id === t!.id)?.prefixMatch,
    ).toBe(false);
  });
});
