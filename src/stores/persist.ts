import type { PiniaPlugin } from "pinia";
import { reactive } from "vue";
import { compressToUTF16, decompressFromUTF16 } from "lz-string";
import { ALL_STORAGE_KEYS, PERSIST_KEYS, PERSIST_META_KEY } from "@/lib/storageKeys";
import {
  clearPersistedValues,
  readPersistedValues,
  writePersistedValue,
} from "@/lib/persistenceDb";
import { migrateWorkspaceState } from "@/lib/workspaceMigration";
import { normalizeSettings } from "@/lib/settingsMigration";
import { useToastStore } from "@/stores/toast";

/**
 * 写盘防抖窗口（ms）。
 * 编辑时每次按键都会改动 workspace store；不防抖就要把全部工作区序列化一遍，
 * 大文档下会明显卡顿。合并窗口内只写最后一次。
 */
export const PERSIST_DEBOUNCE_MS = 250;

export type PersistenceStatus = "saved" | "saving" | "error";

/** 供状态栏等 UI 订阅的真实保存状态（由实际写盘结果驱动） */
export const persistenceState = reactive<{
  status: PersistenceStatus;
  savedAt: number | null;
  error: string | null;
}>({
  status: "saved",
  savedAt: null,
  error: null,
});

const PERSIST_ERROR_MESSAGE = "本地存储写入失败，最近的编辑可能没有保存";
const COMPRESSED_PREFIX = "lz:";
const COMPRESSION_THRESHOLD = 512 * 1024;

/** 工作区可能装大段文本；超过阈值时压缩，降低 localStorage 配额压力 */
function encodeStoredValue(key: string, raw: string): string {
  if (key === PERSIST_KEYS.workspace && raw.length >= COMPRESSION_THRESHOLD) {
    return `${COMPRESSED_PREFIX}${compressToUTF16(raw)}`;
  }
  return raw;
}

function decodeStoredValue(raw: string): string {
  if (!raw.startsWith(COMPRESSED_PREFIX)) return raw;
  const decoded = decompressFromUTF16(raw.slice(COMPRESSED_PREFIX.length));
  if (!decoded) throw new Error("无法解压本地存储数据");
  return decoded;
}

type MirrorTimestamps = Record<string, number>;

function readMirrorTimestamps(): MirrorTimestamps {
  try {
    const raw = localStorage.getItem(PERSIST_META_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const result: MirrorTimestamps = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === "number" && Number.isFinite(value)) result[key] = value;
    }
    return result;
  } catch {
    return {};
  }
}

function writeMirrorTimestamps(timestamps: MirrorTimestamps) {
  try {
    localStorage.setItem(PERSIST_META_KEY, JSON.stringify(timestamps));
  } catch {
    // 时间戳只影响启动时新旧判断，镜像写入成功时不应因它失败而报错
  }
}

function updateMirrorTimestamp(key: string, updatedAt: number): boolean {
  try {
    const timestamps = readMirrorTimestamps();
    timestamps[key] = updatedAt;
    localStorage.setItem(PERSIST_META_KEY, JSON.stringify(timestamps));
    return true;
  } catch {
    return false;
  }
}

/** IndexedDB 数据在内存中的副本；localStorage 配额不足时仍能恢复 */
const latestValues = new Map<string, string>();

function isValidStateJson(raw: string): boolean {
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed !== null && typeof parsed === "object";
  } catch {
    return false;
  }
}

let hydrationPromise: Promise<void> | null = null;

/**
 * 启动时比较 IndexedDB 主存储与 localStorage 镜像，把较新的数据回填到镜像，
 * 并顺带把旧版仅存在 localStorage 的数据迁移到 IndexedDB。
 * 必须在创建 Pinia store 之前 await，让现有同步恢复路径直接读到最新镜像。
 */
export function hydratePersistence(): Promise<void> {
  hydrationPromise ??= hydratePersistenceOnce().catch((error) => {
    console.warn("[persist] 从 IndexedDB 恢复失败，继续使用 localStorage", error);
  });
  return hydrationPromise;
}

async function hydratePersistenceOnce() {
  const remote = await readPersistedValues();
  const timestamps = readMirrorTimestamps();

  for (const key of Object.values(PERSIST_KEYS)) {
    let localRaw: string | null;
    let localAt: number | null = null;
    try {
      const encoded = localStorage.getItem(key);
      localRaw = encoded ? decodeStoredValue(encoded) : null;
      if (localRaw && !isValidStateJson(localRaw)) localRaw = null;
      const timestamp = timestamps[key];
      if (typeof timestamp === "number" && Number.isFinite(timestamp)) localAt = timestamp;
    } catch {
      localRaw = null;
    }

    const remoteEntry = remote.get(key);
    const remoteRaw = remoteEntry && isValidStateJson(remoteEntry.value) ? remoteEntry.value : null;
    const remoteAt =
      remoteEntry && Number.isFinite(remoteEntry.updatedAt) ? remoteEntry.updatedAt : null;

    let chosenRaw: string | null = null;
    let chosenAt = 0;
    if (remoteRaw && remoteAt !== null) {
      const localWins =
        localRaw !== null &&
        localAt !== null &&
        (localAt > remoteAt || (localAt === remoteAt && localRaw === remoteRaw));
      chosenRaw = localWins ? localRaw : remoteRaw;
      chosenAt = Math.max(localAt ?? 0, remoteAt);
    } else if (localRaw) {
      chosenRaw = localRaw;
      chosenAt = localAt ?? Date.now();
    }
    if (!chosenRaw) continue;

    latestValues.set(key, chosenRaw);

    let mirrorWritten = false;
    try {
      const current = localStorage.getItem(key);
      const currentRaw = current ? decodeStoredValue(current) : null;
      if (currentRaw !== chosenRaw) {
        localStorage.setItem(key, encodeStoredValue(key, chosenRaw));
      }
      mirrorWritten = true;
    } catch {
      // 配额不足时继续用 latestValues 恢复，不让启动失败
    }
    if (mirrorWritten) timestamps[key] = chosenAt;

    if (!remoteRaw || remoteRaw !== chosenRaw) {
      await writePersistedValue({ key, value: chosenRaw, updatedAt: chosenAt });
    }
  }

  writeMirrorTimestamps(timestamps);
}

interface Registration {
  key: string;
  /** 取当前待写状态（延迟到真正写盘时再取，保证写的是最新值） */
  read: () => unknown;
}

/** 恢复持久化数据时的按 store 迁移（旧结构 → 当前结构） */
const STATE_MIGRATORS: Record<string, (state: Record<string, unknown>) => Record<string, unknown>> =
  {
    workspace: (state) => migrateWorkspaceState(state),
    settings: (state) => ({ ...normalizeSettings(state) }),
  };

/** store id(=key) → 待写任务与状态读取器 */
const pending = new Map<string, ReturnType<typeof setTimeout>>();
const registrations = new Map<string, Registration>();
const inFlight = new Set<Promise<void>>();
const writeSequences = new Map<string, number>();

/** 清空数据后停止写盘，避免内存中的旧状态被重新写回 */
let persistDisabled = false;
/** 处于写盘失败状态的 key */
const failingKeys = new Set<string>();
/** 已经成功提示过写盘失败的 key（toast store 尚未就绪时会在后续写盘重试） */
const notifiedKeys = new Set<string>();

/** 尝试提示写盘失败；返回是否已提示（store 未就绪时返回 false，下次再试） */
function notifyWriteFailure(): boolean {
  try {
    useToastStore().push(PERSIST_ERROR_MESSAGE);
    return true;
  } catch {
    // store 尚未就绪时忽略（上面已有 console.warn）
    return false;
  }
}

function failWrite(key: string, error: unknown) {
  console.warn(`[persist] 写入 ${key} 失败`, error);
  failingKeys.add(key);
  persistenceState.status = "error";
  persistenceState.error = PERSIST_ERROR_MESSAGE;
  if (!notifiedKeys.has(key) && notifyWriteFailure()) {
    notifiedKeys.add(key);
  }
}

function writeNow(reg: Registration): Promise<void> {
  if (persistDisabled) return Promise.resolve();
  persistenceState.status = "saving";
  persistenceState.error = null;

  let raw: string;
  try {
    const serialized = JSON.stringify(reg.read());
    if (typeof serialized !== "string") throw new Error("状态无法序列化");
    raw = serialized;
  } catch (error) {
    failWrite(reg.key, error);
    return Promise.resolve();
  }

  const updatedAt = Date.now();
  const sequence = (writeSequences.get(reg.key) ?? 0) + 1;
  writeSequences.set(reg.key, sequence);
  latestValues.set(reg.key, raw);

  let localOk = false;
  let localError: unknown = null;
  try {
    localStorage.setItem(reg.key, encodeStoredValue(reg.key, raw));
    // 镜像值和镜像时间戳都写成功才算本地副本完整；否则仍依赖 IndexedDB。
    localOk = updateMirrorTimestamp(reg.key, updatedAt);
  } catch (e) {
    localError = e;
  }

  const task = (async () => {
    let idbOk = false;
    try {
      idbOk = await writePersistedValue({ key: reg.key, value: raw, updatedAt });
    } catch (error) {
      localError ??= error;
    }

    if (persistDisabled || writeSequences.get(reg.key) !== sequence) return;
    if (localOk || idbOk) {
      failingKeys.delete(reg.key);
      notifiedKeys.delete(reg.key);
      return;
    }
    failWrite(reg.key, localError);
  })();

  inFlight.add(task);
  void task.finally(() => {
    inFlight.delete(task);
    if (!persistDisabled) syncPersistenceStatus();
  });
  return task;
}

function syncPersistenceStatus() {
  if (failingKeys.size > 0) {
    persistenceState.status = "error";
    persistenceState.error = PERSIST_ERROR_MESSAGE;
    return;
  }
  if (pending.size > 0 || inFlight.size > 0) {
    persistenceState.status = "saving";
    persistenceState.error = null;
    return;
  }
  persistenceState.status = "saved";
  persistenceState.savedAt = Date.now();
  persistenceState.error = null;
}

function scheduleWrite(reg: Registration) {
  if (persistDisabled) return;
  // 同一个 key 只认最新注册的 store：pinia 重建后旧实例的迟到变更不得覆盖新实例数据
  if (registrations.get(reg.key) !== reg) return;
  persistenceState.status = "saving";
  persistenceState.error = null;
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

/**
 * 立即写出全部待写状态并等待写盘完成。
 * localStorage 镜像同步写入，IndexedDB 异步完成；页面隐藏 / 关闭时调用，
 * PWA 更新前也会 await，确保最后几次编辑已经进入两层存储。
 */
export async function flushPersist(): Promise<void> {
  const tasks: Promise<void>[] = [];
  for (const [key, timer] of [...pending]) {
    clearTimeout(timer);
    pending.delete(key);
    const reg = registrations.get(key);
    if (reg) tasks.push(writeNow(reg));
  }
  tasks.push(...inFlight);
  await Promise.allSettled(tasks);
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
  failingKeys.clear();
  notifiedKeys.clear();
  writeSequences.clear();
  latestValues.clear();
  persistenceState.status = "saved";
  persistenceState.savedAt = null;
  persistenceState.error = null;
}

// 关页 / 切后台前落盘
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => void flushPersist());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void flushPersist();
  });
}

/** 等待已开始的 IndexedDB 写入结束（清空数据前使用） */
export async function waitForPersistenceIdle(): Promise<void> {
  while (inFlight.size > 0) {
    await Promise.allSettled([...inFlight]);
  }
}

/**
 * 清空 localStorage 镜像与 IndexedDB 状态。调用后本页写盘保持关闭，
 * 调用方应刷新页面重建模块状态。
 */
export async function clearPersistedState(): Promise<void> {
  disablePersist();
  await waitForPersistenceIdle();
  latestValues.clear();
  ALL_STORAGE_KEYS.forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      // 清空失败也应继续清理 IndexedDB
    }
  });
  await clearPersistedValues();
}

/** 测试隔离：允许同一个测试文件反复模拟应用启动。 */
export function resetPersistenceForTests() {
  cancelPendingPersist();
  enablePersist();
  hydrationPromise = null;
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
    const stored = latestValues.get(key) ?? localStorage.getItem(key);
    if (stored) {
      const raw = latestValues.has(key) ? stored : decodeStoredValue(stored);
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

  // 订阅状态变化，合并到防抖窗口后同时写回 localStorage 镜像与 IndexedDB
  const reg: Registration = { key, read: () => ctx.store.$state };
  registrations.set(key, reg);
  // flush: "sync" —— 变更当拍就登记待写任务（只是重置定时器，不做序列化），
  // 保证「改完立刻关页」时 flushPersist 能拿到最后一次改动
  ctx.store.$subscribe(() => scheduleWrite(reg), { flush: "sync" });
};
