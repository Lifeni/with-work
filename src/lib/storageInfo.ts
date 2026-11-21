export interface StorageInfo {
  usage: number | null;
  quota: number | null;
  persisted: boolean | null;
}

export async function readStorageInfo(): Promise<StorageInfo> {
  const manager = navigator.storage;
  if (!manager) return { usage: null, quota: null, persisted: null };

  const [estimate, persisted] = await Promise.allSettled([
    manager.estimate?.(),
    manager.persisted?.(),
  ]);
  return {
    usage: estimate.status === "fulfilled" ? (estimate.value?.usage ?? null) : null,
    quota: estimate.status === "fulfilled" ? (estimate.value?.quota ?? null) : null,
    persisted: persisted.status === "fulfilled" ? (persisted.value ?? null) : null,
  };
}

export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  try {
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export function formatStorageBytes(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes)) return "未知";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}
