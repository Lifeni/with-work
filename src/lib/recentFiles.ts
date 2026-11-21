import { shallowRef } from "vue";
import { ensureFileHandlePermission } from "@/lib/fileAccess";
import { readTextFile } from "@/lib/fileImport";
import {
  clearRecentFiles,
  clearWorkspaceFiles,
  deleteRecentFile,
  deleteWorkspaceFile,
  readRecentFiles,
  readWorkspaceFiles,
  writeRecentFile,
  writeWorkspaceFile,
  type RecentFileRecord,
  type WorkspaceFileRecord,
} from "@/lib/persistenceDb";
import { uid } from "@/lib/utils";

export const MAX_RECENT_FILES = 8;

/** 最近文件句柄由 IndexedDB 持久化；这里保存响应式副本供菜单和命令面板使用 */
export const recentFiles = shallowRef<RecentFileRecord[]>([]);
/** 工作区绑定独立于最近历史：历史只保留 8 条，绑定不能因此丢失 */
export const workspaceFileBindings = shallowRef<WorkspaceFileRecord[]>([]);

let loaded = false;
let loadPromise: Promise<void> | null = null;

function sortRecent(files: RecentFileRecord[]) {
  return [...files].sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
}

export function loadRecentFiles(): Promise<void> {
  if (loaded) return Promise.resolve();
  loadPromise ??= Promise.all([readRecentFiles(), readWorkspaceFiles()])
    .then(async ([files, bindings]) => {
      const bindingsById = new Map(bindings.map((record) => [record.workspaceId, record]));
      const migrated: WorkspaceFileRecord[] = [];
      for (const file of files) {
        if (!file.workspaceId || bindingsById.has(file.workspaceId)) continue;
        const binding = {
          workspaceId: file.workspaceId,
          name: file.name,
          handle: file.handle,
          boundAt: file.lastOpenedAt,
          side: "left" as const,
        };
        bindingsById.set(binding.workspaceId, binding);
        migrated.push(binding);
      }
      if (migrated.length > 0) {
        await Promise.all(migrated.map((binding) => writeWorkspaceFile(binding)));
      }
      const cleanedFiles = files.map((file) => {
        const record = { ...file };
        delete record.workspaceId;
        return record;
      });
      // 旧版把 workspaceId 写在最近历史里；迁移后必须落盘清除，
      // 否则“解除绑定/删除工作区”后下次启动又会从历史中恢复绑定。
      const legacyFiles = files.flatMap((file, index) =>
        file.workspaceId ? [cleanedFiles[index]] : [],
      );
      if (legacyFiles.length > 0) {
        await Promise.all(legacyFiles.map((file) => writeRecentFile(file)));
      }
      recentFiles.value = sortRecent(cleanedFiles);
      workspaceFileBindings.value = [...bindingsById.values()];
      loaded = true;
    })
    .catch(() => {
      recentFiles.value = [];
      workspaceFileBindings.value = [];
      loaded = true;
    });
  return loadPromise;
}

async function sameFile(a: FileSystemFileHandle, b: FileSystemFileHandle): Promise<boolean> {
  if (typeof a.isSameEntry === "function") {
    try {
      return await a.isSameEntry(b);
    } catch {
      return false;
    }
  }
  return a.name === b.name;
}

async function findExisting(handle: FileSystemFileHandle): Promise<RecentFileRecord | undefined> {
  for (const record of recentFiles.value) {
    if (await sameFile(record.handle, handle)) return record;
  }
  return undefined;
}

async function findBinding(handle: FileSystemFileHandle): Promise<WorkspaceFileRecord | undefined> {
  for (const binding of workspaceFileBindings.value) {
    if (await sameFile(binding.handle, handle)) return binding;
  }
  return undefined;
}

/** 记录本次打开 / 保存的文件，同一文件会移到最前而不是重复添加 */
export async function rememberRecentFile(options: {
  handle: FileSystemFileHandle;
  name: string;
  workspaceId: string;
  side?: "left" | "right";
}): Promise<RecentFileRecord> {
  await loadRecentFiles();
  const existing = await findExisting(options.handle);
  const record: RecentFileRecord = {
    id: existing?.id ?? uid(),
    name: options.name || options.handle.name,
    handle: options.handle,
    lastOpenedAt: Date.now(),
  };
  const next = sortRecent([record, ...recentFiles.value.filter((item) => item.id !== record.id)]);
  const kept = next.slice(0, MAX_RECENT_FILES);
  const removed = next.slice(MAX_RECENT_FILES);
  recentFiles.value = kept;

  const binding: WorkspaceFileRecord = {
    workspaceId: options.workspaceId,
    name: record.name,
    handle: record.handle,
    boundAt: record.lastOpenedAt,
    side: options.side ?? "left",
  };
  const previousBinding = await findBinding(options.handle);
  workspaceFileBindings.value = [
    binding,
    ...workspaceFileBindings.value.filter(
      (item) =>
        item.workspaceId !== options.workspaceId &&
        item.workspaceId !== previousBinding?.workspaceId,
    ),
  ];

  await Promise.all([writeRecentFile(record), writeWorkspaceFile(binding)]);
  if (previousBinding && previousBinding.workspaceId !== options.workspaceId) {
    await deleteWorkspaceFile(previousBinding.workspaceId);
  }
  await Promise.allSettled(removed.map((item) => deleteRecentFile(item.id)));
  return record;
}

export function findFileForWorkspace(workspaceId: string): WorkspaceFileRecord | undefined {
  return workspaceFileBindings.value.find((record) => record.workspaceId === workspaceId);
}

export async function unbindFileForWorkspace(
  workspaceId: string,
): Promise<WorkspaceFileRecord | undefined> {
  const binding = findFileForWorkspace(workspaceId);
  if (!binding) return undefined;
  workspaceFileBindings.value = workspaceFileBindings.value.filter(
    (record) => record.workspaceId !== workspaceId,
  );
  await deleteWorkspaceFile(workspaceId);
  return binding;
}

export async function readRecentFile(
  record: RecentFileRecord,
): Promise<{ ok: true; name: string; text: string } | { ok: false; error: string }> {
  const granted = await ensureFileHandlePermission(record.handle, "read");
  if (!granted) {
    return { ok: false, error: "没有读取该文件的权限，请重新打开文件" };
  }
  try {
    const file = await record.handle.getFile();
    const result = await readTextFile(file);
    if (!result.ok) return result;
    return { ok: true, name: file.name || record.name, text: result.text };
  } catch {
    return { ok: false, error: `无法读取「${record.name}」` };
  }
}

export async function forgetRecentFile(id: string) {
  recentFiles.value = recentFiles.value.filter((record) => record.id !== id);
  await deleteRecentFile(id);
}

export async function clearRecentFileHistory() {
  recentFiles.value = [];
  loaded = true;
  loadPromise = Promise.resolve();
  await clearRecentFiles();
}

export async function clearWorkspaceFileBindings() {
  workspaceFileBindings.value = [];
  await clearWorkspaceFiles();
}

/** 工作区删除后清理失联绑定，避免句柄长期占用 IndexedDB */
export async function pruneWorkspaceFileBindings(activeWorkspaceIds: Iterable<string>) {
  const active = new Set(activeWorkspaceIds);
  const stale = workspaceFileBindings.value.filter((record) => !active.has(record.workspaceId));
  if (stale.length === 0) return;
  workspaceFileBindings.value = workspaceFileBindings.value.filter((record) =>
    active.has(record.workspaceId),
  );
  await Promise.allSettled(stale.map((record) => deleteWorkspaceFile(record.workspaceId)));
}

export function resetRecentFilesForTests() {
  recentFiles.value = [];
  workspaceFileBindings.value = [];
  loaded = false;
  loadPromise = null;
}
