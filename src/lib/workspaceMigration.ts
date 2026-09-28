import type { Workspace } from "@/types";

/**
 * 工作区数据迁移与清洗。
 * 早期版本的工作区只有一个 `content` 字段（单栏），后来改为 `left` / `right`（双栏）。
 * 从 localStorage 恢复或导入旧备份时必须把 `content` 迁到左栏，否则老用户的内容
 * 会静默消失在双栏界面里；同时丢弃 view / editorMode / language 等已废弃字段，
 * 避免历史垃圾随每次写盘永久回写。
 */

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/** 归一化单个工作区；缺少 id 视为非法数据返回 null */
export function normalizeWorkspace(raw: unknown): Workspace | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = asString(r.id);
  if (!id) return null;

  const left = asString(r.left);
  const right = asString(r.right);
  const legacyContent = asString(r.content);
  // 仅当双栏都没有内容时才用旧单栏内容兜底，避免覆盖新数据
  const migratedLeft = left || right ? left : legacyContent;

  return {
    id,
    name: asString(r.name) || "工作区",
    left: migratedLeft,
    right,
    // 保留旧字段原值（可为空串），保证老备份读写往返不丢任何一份历史数据
    ...(r.content !== undefined ? { content: legacyContent } : {}),
  };
}

export function normalizeWorkspaces(raw: unknown): Workspace[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => normalizeWorkspace(item)).filter((w): w is Workspace => w !== null);
}

/** 归一化 workspace store 的持久化状态（workspaces + activeId） */
export function migrateWorkspaceState(state: Record<string, unknown>): {
  workspaces: Workspace[];
  activeId: string | null;
} {
  const workspaces = normalizeWorkspaces(state.workspaces);
  const activeId = asString(state.activeId);
  const valid = workspaces.some((w) => w.id === activeId);
  return { workspaces, activeId: valid ? activeId : (workspaces[0]?.id ?? null) };
}
