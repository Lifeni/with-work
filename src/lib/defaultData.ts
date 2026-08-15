import { useRulesStore } from "@/stores/rules";
import { useTemplatesStore } from "@/stores/templates";
import { useTextTemplatesStore } from "@/stores/textTemplates";
import type { ReplaceRule, SortTemplate, TextTemplate } from "@/types";

/**
 * 内置示例数据：按需增量注入，便于用户快速上手。
 * - 已注入过的内置项（id 记录在 `ww:seeded`）被删除后不会复活；
 * - 后续新增的内置项会对老用户可见（补入缺失项）；
 * - 已下架的内置项（`DEPRECATED_BUILTIN_IDS`）会自动从用户数据中移除；
 * - 用户编辑过的项不会被覆盖。
 */

/** 已注入内置 id 的持久化标记 */
export const SEEDED_KEY = "ww:seeded";

/** 历史版本注入过、现已下架的内置项：seed 时从用户数据中移除 */
export const DEPRECATED_BUILTIN_IDS = [
  "builtin-rule-trailing-space",
  "builtin-rule-collapse-blank-lines",
  "builtin-rule-tab-to-space",
  "builtin-rule-cn-comma",
  "builtin-rule-cn-semicolon",
  "builtin-sort-weekday",
  "builtin-sort-month",
  "builtin-text-codeblock",
  "builtin-text-todo",
];

export const DEFAULT_RULES: ReplaceRule[] = [
  {
    id: "builtin-rule-angle-bracket",
    name: "单书名号替换",
    find: "<(.+?)>",
    replace: "〈$1〉",
    isRegex: true,
    matchCase: false,
  },
];

const SHANDONG_CITIES = [
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
];

export const DEFAULT_SORT_TEMPLATES: SortTemplate[] = [
  {
    id: "builtin-sort-shandong-cities",
    name: "山东 16 市",
    items: SHANDONG_CITIES,
    group: "内置",
    prefixMatch: true,
  },
];

export const DEFAULT_TEXT_TEMPLATES: TextTemplate[] = [];

function readSeeded(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEDED_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

/** 把 defaults 中「未注入过且当前不存在」的项合并进 existing，返回合并结果与新增 id */
function injectMissing<T extends { id: string }>(
  existing: T[],
  defaults: T[],
  seeded: Set<string>,
): { items: T[]; injected: string[] } {
  const present = new Set(existing.map((x) => x.id));
  const added = defaults.filter((d) => !seeded.has(d.id) && !present.has(d.id));
  return {
    items: added.length ? [...existing, ...added] : existing,
    injected: added.map((x) => x.id),
  };
}

/** 移除已下架的内置项 */
function removeDeprecated<T extends { id: string }>(existing: T[]): T[] {
  return existing.filter((x) => !DEPRECATED_BUILTIN_IDS.includes(x.id));
}

/** 补齐内置项的默认属性（如 prefixMatch）：仅当旧数据缺失该字段时写入，不覆盖用户改动 */
function syncBuiltinDefaults(
  existing: SortTemplate[],
  defaults: SortTemplate[],
): SortTemplate[] {
  const defaultsById = new Map(defaults.map((d) => [d.id, d]));
  let changed = false;
  const next = existing.map((t) => {
    const d = defaultsById.get(t.id);
    if (d && t.prefixMatch === undefined && d.prefixMatch !== undefined) {
      changed = true;
      return { ...t, prefixMatch: d.prefixMatch };
    }
    return t;
  });
  return changed ? next : existing;
}

/** 增量注入内置数据：新增内置项对老用户可见，已删除的不复活，编辑过的不覆盖，下架的自动移除 */
export function seedDefaultData() {
  const seeded = readSeeded();

  const rules = removeDeprecated(useRulesStore.getState().rules);
  if (rules.length !== useRulesStore.getState().rules.length) {
    useRulesStore.getState().replaceAll(rules);
  }
  const templates = removeDeprecated(useTemplatesStore.getState().templates);
  if (templates.length !== useTemplatesStore.getState().templates.length) {
    useTemplatesStore.getState().replaceAll(templates);
  }
  const syncedTemplates = syncBuiltinDefaults(templates, DEFAULT_SORT_TEMPLATES);
  if (syncedTemplates !== templates) {
    useTemplatesStore.getState().replaceAll(syncedTemplates);
  }
  const textTemplates = removeDeprecated(useTextTemplatesStore.getState().templates);
  if (textTemplates.length !== useTextTemplatesStore.getState().templates.length) {
    useTextTemplatesStore.getState().replaceAll(textTemplates);
  }

  const rulesResult = injectMissing(rules, DEFAULT_RULES, seeded);
  if (rulesResult.injected.length) useRulesStore.getState().replaceAll(rulesResult.items);
  const templatesResult = injectMissing(syncedTemplates, DEFAULT_SORT_TEMPLATES, seeded);
  if (templatesResult.injected.length) useTemplatesStore.getState().replaceAll(templatesResult.items);
  const textTemplatesResult = injectMissing(textTemplates, DEFAULT_TEXT_TEMPLATES, seeded);
  if (textTemplatesResult.injected.length) {
    useTextTemplatesStore.getState().replaceAll(textTemplatesResult.items);
  }

  for (const d of [...DEFAULT_RULES, ...DEFAULT_SORT_TEMPLATES, ...DEFAULT_TEXT_TEMPLATES]) {
    seeded.add(d.id);
  }
  for (const id of DEPRECATED_BUILTIN_IDS) {
    seeded.delete(id);
  }
  localStorage.setItem(SEEDED_KEY, JSON.stringify([...seeded]));
}
