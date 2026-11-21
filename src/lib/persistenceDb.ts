/**
 * IndexedDB 访问层。
 *
 * 应用状态仍保留一份 localStorage 镜像，以便首屏同步恢复；IndexedDB 负责
 * 主存储与文件句柄等无法写入 JSON 的数据。这里所有失败都降级为返回值，
 * 不抛给业务层——存储能力不可用时应用仍应正常工作。
 */

export interface PersistedValueRecord {
  key: string;
  /** 未经 localStorage 压缩的 JSON 文本 */
  value: string;
  updatedAt: number;
}

export interface RecentFileRecord {
  id: string;
  name: string;
  handle: FileSystemFileHandle;
  lastOpenedAt: number;
  /** 最近一次打开该文件时对应的工作区；工作区删除后仅作为失效引用 */
  workspaceId?: string;
}

export interface WorkspaceFileRecord {
  workspaceId: string;
  name: string;
  handle: FileSystemFileHandle;
  boundAt: number;
  /** 原文件内容放在双栏编辑器的哪一栏；旧记录默认左栏 */
  side: "left" | "right";
}

const DATABASE_NAME = "with-work";
const DATABASE_VERSION = 2;
const STATE_STORE = "state";
const RECENT_FILES_STORE = "recent-files";
const WORKSPACE_FILES_STORE = "workspace-files";
const OPEN_RETRY_COOLDOWN_MS = 1_000;

let dbPromise: Promise<IDBDatabase | null> | null = null;
let currentDatabase: IDBDatabase | null = null;
let connectionGeneration = 0;
let retryDatabaseAfter = 0;

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);

  return new Promise((resolve) => {
    let settled = false;
    let blockedTimer: ReturnType<typeof setTimeout> | null = null;
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    } catch {
      resolve(null);
      return;
    }

    const finish = (db: IDBDatabase | null) => {
      if (blockedTimer) clearTimeout(blockedTimer);
      blockedTimer = null;
      if (settled) {
        db?.close();
        return;
      }
      settled = true;
      resolve(db);
    };

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STATE_STORE)) {
        db.createObjectStore(STATE_STORE, { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains(RECENT_FILES_STORE)) {
        db.createObjectStore(RECENT_FILES_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(WORKSPACE_FILES_STORE)) {
        db.createObjectStore(WORKSPACE_FILES_STORE, { keyPath: "workspaceId" });
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      const forgetConnection = () => {
        if (currentDatabase !== db) return;
        currentDatabase = null;
        dbPromise = null;
      };
      db.onversionchange = () => {
        db.close();
        forgetConnection();
      };
      db.onclose = forgetConnection;
      finish(db);
    };
    // 旧版本标签页会通过 versionchange 自动关连接；给升级留出时间，超时再降级。
    request.onblocked = () => {
      blockedTimer ??= setTimeout(() => finish(null), 3000);
    };
    request.onerror = () => finish(null);
  });
}

function getDatabase(): Promise<IDBDatabase | null> {
  if (Date.now() < retryDatabaseAfter) return Promise.resolve(null);
  if (!dbPromise) {
    const generation = connectionGeneration;
    dbPromise = openDatabase().then((db) => {
      // 测试重置期间到达的旧连接直接丢弃
      if (generation !== connectionGeneration) {
        db?.close();
        return null;
      }
      if (!db) {
        dbPromise = null;
        retryDatabaseAfter = Date.now() + OPEN_RETRY_COOLDOWN_MS;
      } else {
        currentDatabase = db;
        retryDatabaseAfter = 0;
      }
      return db;
    });
  }
  return dbPromise;
}

function readAll<T>(storeName: string): Promise<T[]> {
  return getDatabase().then(
    (db) =>
      new Promise<T[]>((resolve) => {
        if (!db) {
          resolve([]);
          return;
        }
        try {
          const request = db.transaction(storeName, "readonly").objectStore(storeName).getAll();
          request.onsuccess = () => resolve((request.result as T[]) ?? []);
          request.onerror = () => resolve([]);
        } catch {
          resolve([]);
        }
      }),
  );
}

function put<T>(storeName: string, value: T): Promise<boolean> {
  return getDatabase().then(
    (db) =>
      new Promise<boolean>((resolve) => {
        if (!db) {
          resolve(false);
          return;
        }
        try {
          const transaction = db.transaction(storeName, "readwrite");
          transaction.objectStore(storeName).put(value);
          transaction.oncomplete = () => resolve(true);
          transaction.onerror = () => resolve(false);
          transaction.onabort = () => resolve(false);
        } catch {
          resolve(false);
        }
      }),
  );
}

function removeAll(storeNames: string[]): Promise<boolean> {
  return getDatabase().then(
    (db) =>
      new Promise<boolean>((resolve) => {
        if (!db) {
          resolve(false);
          return;
        }
        try {
          const transaction = db.transaction(storeNames, "readwrite");
          for (const storeName of storeNames) transaction.objectStore(storeName).clear();
          transaction.oncomplete = () => resolve(true);
          transaction.onerror = () => resolve(false);
          transaction.onabort = () => resolve(false);
        } catch {
          resolve(false);
        }
      }),
  );
}

function remove(storeName: string, key: IDBValidKey): Promise<boolean> {
  return getDatabase().then(
    (db) =>
      new Promise<boolean>((resolve) => {
        if (!db) {
          resolve(false);
          return;
        }
        try {
          const transaction = db.transaction(storeName, "readwrite");
          transaction.objectStore(storeName).delete(key);
          transaction.oncomplete = () => resolve(true);
          transaction.onerror = () => resolve(false);
          transaction.onabort = () => resolve(false);
        } catch {
          resolve(false);
        }
      }),
  );
}

/** 读取全部持久化状态，key → record */
export async function readPersistedValues(): Promise<Map<string, PersistedValueRecord>> {
  const records = await readAll<PersistedValueRecord>(STATE_STORE);
  return new Map(
    records
      .filter(
        (record) =>
          !!record &&
          typeof record.key === "string" &&
          typeof record.value === "string" &&
          Number.isFinite(record.updatedAt),
      )
      .map((record) => [record.key, record]),
  );
}

export function writePersistedValue(record: PersistedValueRecord): Promise<boolean> {
  // updatedAt 由调用方生成；同一标签页内的写入按事务创建顺序执行。
  return put(STATE_STORE, record);
}

export function clearPersistedValues(): Promise<boolean> {
  return removeAll([STATE_STORE]);
}

export async function readRecentFiles(): Promise<RecentFileRecord[]> {
  const records = await readAll<RecentFileRecord>(RECENT_FILES_STORE);
  return records
    .filter(
      (record) =>
        !!record &&
        typeof record.id === "string" &&
        typeof record.name === "string" &&
        !!record.handle &&
        Number.isFinite(record.lastOpenedAt),
    )
    .sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
}

export function writeRecentFile(record: RecentFileRecord): Promise<boolean> {
  return put(RECENT_FILES_STORE, record);
}

export function deleteRecentFile(id: string): Promise<boolean> {
  return remove(RECENT_FILES_STORE, id);
}

export function clearRecentFiles(): Promise<boolean> {
  return removeAll([RECENT_FILES_STORE]);
}

export async function readWorkspaceFiles(): Promise<WorkspaceFileRecord[]> {
  const records = await readAll<WorkspaceFileRecord>(WORKSPACE_FILES_STORE);
  return records
    .filter(
      (record) =>
        !!record &&
        typeof record.workspaceId === "string" &&
        typeof record.name === "string" &&
        !!record.handle &&
        Number.isFinite(record.boundAt),
    )
    .map((record) => ({
      ...record,
      side: record.side === "right" ? "right" : "left",
    }));
}

export function writeWorkspaceFile(record: WorkspaceFileRecord): Promise<boolean> {
  return put(WORKSPACE_FILES_STORE, record);
}

export function deleteWorkspaceFile(workspaceId: string): Promise<boolean> {
  return remove(WORKSPACE_FILES_STORE, workspaceId);
}

export function clearWorkspaceFiles(): Promise<boolean> {
  return removeAll([WORKSPACE_FILES_STORE]);
}

/** 主要供测试隔离使用；也会关闭当前连接，避免 fake-indexeddb 留下旧状态。 */
export function resetPersistenceDbConnection() {
  connectionGeneration += 1;
  const db = currentDatabase;
  currentDatabase = null;
  dbPromise = null;
  retryDatabaseAfter = 0;
  db?.close();
}
