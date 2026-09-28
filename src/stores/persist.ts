import type { PiniaPlugin } from "pinia";
import { PERSIST_KEYS } from "@/lib/storageKeys";

/**
 * 写盘防抖窗口（ms）。
 * 编辑时每次按键都会改动 workspace store；不防抖就要把全部工作区序列化一遍，
 * 大文档下会明显卡顿。合并窗口内只写最后一次。
 */
export const PERSIST_DEBOUNCE_MS = 250;

interface Registration {
  key: string;
  /** 取当前待写状态（延迟到真正写盘时再取，保证写的是最新值） */
  read: () => unknown;
}

/** store id(=key) → 待写任务与状态读取器 */
const pending = new Map<string, ReturnType<typeof setTimeout>>();
const registrations = new Map<string, Registration>();

function writeNow(reg: Registration) {
  try {
    localStorage.setItem(reg.key, JSON.stringify(reg.read()));
  } catch {
    // 存储配额不足等异常静默忽略
  }
}

function scheduleWrite(reg: Registration) {
  const timer = pending.get(reg.key);
  if (timer) clearTimeout(timer);
  pending.set(
    reg.key,
    setTimeout(() => {
      pending.delete(reg.key);
      writeNow(reg);
    }, PERSIST_DEBOUNCE_MS),
  );
}

/** 立即写出全部待写状态（页面隐藏 / 关闭前调用，避免丢掉最后一次编辑） */
export function flushPersist() {
  for (const [key, timer] of [...pending]) {
    clearTimeout(timer);
    pending.delete(key);
    const reg = registrations.get(key);
    if (reg) writeNow(reg);
  }
}

/** 丢弃全部待写状态（清空数据时调用，避免内存里的旧内容被重新写回） */
export function cancelPendingPersist() {
  for (const timer of pending.values()) clearTimeout(timer);
  pending.clear();
}

// 关页 / 切后台前落盘（PWA 单文件版同样适用）
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flushPersist);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushPersist();
  });
}

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

  // 订阅状态变化，合并到防抖窗口后写回 localStorage
  const reg: Registration = { key, read: () => ctx.store.$state };
  registrations.set(key, reg);
  // flush: "sync" —— 变更当拍就登记待写任务（只是重置定时器，不做序列化），
  // 保证「改完立刻关页」时 flushPersist 能拿到最后一次改动
  ctx.store.$subscribe(() => scheduleWrite(reg), { flush: "sync" });
};
