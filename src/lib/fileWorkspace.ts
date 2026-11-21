import type { OpenedTextFile } from "@/lib/fileAccess";
import { saveTextFileAs, writeTextToHandle } from "@/lib/fileAccess";
import { workspaceNameFromFile } from "@/lib/fileImport";
import { findFileForWorkspace, readRecentFile, rememberRecentFile } from "@/lib/recentFiles";
import type { RecentFileRecord } from "@/lib/persistenceDb";
import { useWorkspaceStore } from "@/stores/workspace";
import { sanitizeFileName } from "@/lib/utils";

export interface WorkspaceFileResult {
  ok: boolean;
  workspaceId?: string;
  name?: string;
  reason?: "no-file" | "permission" | "write" | "read" | "picker";
  cancelled?: boolean;
  permissionDenied?: boolean;
  error?: string;
}

/** 打开文件内容：始终创建新工作区，避免覆盖当前未保存的编辑 */
export async function openTextInNewWorkspace(file: OpenedTextFile): Promise<string> {
  const workspaceStore = useWorkspaceStore();
  const workspaceId = workspaceStore.createWorkspace(workspaceNameFromFile(file.name));
  workspaceStore.setLeft(workspaceId, file.text);
  if (file.handle) {
    await rememberRecentFile({
      handle: file.handle,
      name: file.name || file.handle.name,
      workspaceId,
      side: "left",
    });
  }
  return workspaceId;
}

export async function openRecentInNewWorkspace(
  record: RecentFileRecord,
): Promise<WorkspaceFileResult> {
  const result = await readRecentFile(record);
  if (!result.ok) return { ok: false, reason: "read", error: result.error };
  const workspaceId = await openTextInNewWorkspace({
    name: result.name,
    text: result.text,
    handle: record.handle,
  });
  return { ok: true, workspaceId, name: result.name };
}

/** Ctrl+S：有绑定句柄时直接写回原文件；没有句柄时返回 no-handle 让调用方走下载 */
export async function saveWorkspaceToBoundFile(
  workspaceId: string,
  text: string,
): Promise<WorkspaceFileResult> {
  const record = findFileForWorkspace(workspaceId);
  if (!record) return { ok: false, reason: "no-file", error: "当前工作区没有绑定文件" };

  const result = await writeTextToHandle(record.handle, text);
  if (!result.ok) {
    return {
      ok: false,
      reason: result.permissionDenied ? "permission" : "write",
      permissionDenied: result.permissionDenied,
      error: result.error,
    };
  }
  await rememberRecentFile({
    handle: result.handle,
    name: result.name,
    workspaceId,
    side: record.side,
  });
  return { ok: true, name: result.name };
}

export function suggestedTextFileName(workspaceName: string): string {
  const cleaned = sanitizeFileName(workspaceName);
  return /\.[^.]+$/.test(cleaned) ? cleaned : `${cleaned}.txt`;
}

export async function saveWorkspaceAs(
  workspaceId: string,
  workspaceName: string,
  text: string,
  side: "left" | "right" = "left",
): Promise<WorkspaceFileResult> {
  const result = await saveTextFileAs(suggestedTextFileName(workspaceName), text);
  if (!result.ok) {
    return {
      ok: false,
      reason: result.cancelled ? undefined : result.permissionDenied ? "permission" : "picker",
      cancelled: result.cancelled,
      permissionDenied: result.permissionDenied,
      error: result.error,
    };
  }
  await rememberRecentFile({
    handle: result.handle,
    name: result.name,
    workspaceId,
    side,
  });
  return { ok: true, name: result.name };
}
