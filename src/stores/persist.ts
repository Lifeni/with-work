import type { PiniaPlugin } from "pinia";
import { PERSIST_KEYS } from "@/lib/storageKeys";
import { migrateWorkspaceState } from "@/lib/workspaceMigration";
import { useToastStore } from "@/stores/toast";

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

/** 恢复持久化数据时的按 store 迁移（旧结构 → 当前结构） */
const STATE_MIGRATORS: Record<string, (state: Record<string, unknown>) => Record<string, unknown>> =
  {
    workspace: (state) => migrateWorkspaceState(state),
  };

/** store id(=key) → 待写任务与状态读取器 */
const pending = new Map<string, ReturnType<typeof setTimeout>>();
const registrations = new Map<string, Registration>();

/** 清空数据后停止写盘，避免内存中的旧状态被重新写回 */
let persistDisabled = false;
/** 写盘失败只提示一次，避免每个按键都弹提示 */
let writeFailureNotified = false;

function notifyWriteFailure() {
  if (writeFailureNotified) return;
  writeFailureNotified = true;
  try {
    useToastStore().push("本地存储写入失败，最近的编辑可能没有保存");
  } catch {
    // store 尚未就绪时忽略（上面已有 console.warn）
  }
}

function writeNow(reg: Registration) {
  if (persistDisabled) return;
  try {
    localStorage.setItem(reg.key, JSON.stringify(reg.read()));
    writeFailureNotified = false;
  } catch (e) {
    // 配额不足等原因写不进去时不能静默：否则用户编辑会无声丢失
    console.warn(`[persist] 写入 ${reg.key} 失败`, e);
    notifyWriteFailure();
  }
}

function scheduleWrite(reg: Registration) {
  if (persistDisabled) return;
  // 同一个 key 只认最新注册的 store：pinia 重建后旧实例的迟到变更不得覆盖新实例数据
  if (registrations.get(reg.key) !== reg) return;
  const timer = pending.get(reg.key);
  if (timer) clearTimeout(timer);
  pending.set(
    reg.key,
    setTimeout(() => {
      pending.delete(reg.key);
      // 写盘时刻重新取当前注册，保证写的是仍然存活的那个 store 的状态
      const current = registrations.get(reg.key);
      if (current) writeNow(current);
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

/**
 * 清空数据前调用：丢弃待写任务并停止后续写盘（含关页 flush）。
 * 本会话内是终态——调用方应在清空后立即刷新页面重建模块状态；
 * 若确实需要继续使用（例如测试隔离），显式调用 enablePersist() 恢复。
 */
export function disablePersist() {
  persistDisabled = true;
  cancelPendingPersist();
}

/** 恢复写盘：仅用于「清空后不刷新页面」的特殊场景与测试隔离 */
export function enablePersist() {
  persistDisabled = false;
  writeFailureNotified = false;
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
        // 旧结构在这里归一化：既补齐缺失字段，也丢弃已废弃字段
        const migrator = STATE_MIGRATORS[ctx.store.$id];
        const restored = migrator
          ? migrator(data as Record<string, unknown>)
          : (data as Record<string, unknown>);
        Object.assign(ctx.store.$state, restored);
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
