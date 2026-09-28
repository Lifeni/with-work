/**
 * 本地存储键的唯一来源。
 * 持久化插件（stores/persist.ts）与备份/清空（lib/backup.ts）都从这里取键，
 * 避免两份清单各自演化后出现「清空数据漏删某个键」这类问题。
 */

/** store id → localStorage key（与旧版 Zustand persist 保持一致，老数据可直接迁移） */
export const PERSIST_KEYS: Record<string, string> = {
  workspace: "ww:workspaces",
  staging: "ww:staging",
  rules: "ww:rules",
  templates: "ww:templates",
  textTemplates: "ww:text-templates",
  settings: "ww:settings",
};

/** 内置示例数据的注入标记（不属于任何 store，由 lib/defaultData.ts 维护） */
export const SEEDED_KEY = "ww:seeded";

/** 历史版本写入过、当前版本不再读写的键：清空数据时一并移除 */
export const LEGACY_STORAGE_KEYS = ["ww:diff", "ww:list"];

/** 清空数据需要移除的全部键 */
export const ALL_STORAGE_KEYS = [
  ...Object.values(PERSIST_KEYS),
  SEEDED_KEY,
  ...LEGACY_STORAGE_KEYS,
];
