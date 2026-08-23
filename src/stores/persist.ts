import { toRaw, watch } from "vue";
import type { PiniaPlugin } from "pinia";

// 各 store 的 localStorage 持久化 key（与旧版 Zustand persist 保持一致，
// 用户浏览器中已有的数据可直接迁移，无需手动处理）
const PERSIST_KEYS: Record<string, string> = {
  workspace: "ww:workspaces",
  staging: "ww:staging",
  rules: "ww:rules",
  templates: "ww:templates",
  textTemplates: "ww:text-templates",
  settings: "ww:settings",
  list: "ww:list",
};

/**
 * 持久化插件：store 创建时从 localStorage 恢复（兼容旧 Zustand persist 的
 * `{ state, version }` 包装格式），此后深度监听状态变化写回。
 * 未登记 key 的 store（ui / status / toast）不持久化。
 */
export const persistPlugin: PiniaPlugin = (ctx) => {
  const key = PERSIST_KEYS[ctx.store.$id];
  if (!key) return;

  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      // 旧版 Zustand 格式：{ state: {...}, version: 0 }，解包后直接恢复
      const data =
        parsed && typeof parsed === "object" && "state" in (parsed as Record<string, unknown>)
          ? (parsed as { state: unknown }).state
          : parsed;
      if (data && typeof data === "object") {
        Object.assign(ctx.store.$state, data);
      }
    }
  } catch {
    // 本地数据损坏时静默跳过，保留空初始状态
  }

  watch(
    () => toRaw(ctx.store.$state),
    () => {
      try {
        localStorage.setItem(key, JSON.stringify(toRaw(ctx.store.$state)));
      } catch {
        // 存储配额不足等异常静默忽略
      }
    },
    { deep: true },
  );
};
