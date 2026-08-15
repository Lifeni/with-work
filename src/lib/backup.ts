import type { BackupData, ReplaceRule, SortTemplate, Workspace } from "@/types";
import { useWorkspaceStore } from "@/stores/workspace";
import { useStagingStore } from "@/stores/staging";
import { useRulesStore } from "@/stores/rules";
import { useTemplatesStore } from "@/stores/templates";
import { useSettingsStore } from "@/stores/settings";
import { useListStore } from "@/stores/list";
import { downloadText } from "./utils";
import { applyTheme } from "./theme";

export const STORAGE_KEYS = [
  "ww:workspaces",
  "ww:staging",
  "ww:rules",
  "ww:templates",
  "ww:settings",
  "ww:diff",
  "ww:list",
];

export function collectBackup(): BackupData {
  const wsState = useWorkspaceStore.getState();
  const activeWs = wsState.workspaces.find((w) => w.id === wsState.activeId);
  return {
    app: "with-work",
    version: 2,
    exportedAt: new Date().toISOString(),
    workspaces: wsState.workspaces,
    staging: useStagingStore.getState().items,
    rules: useRulesStore.getState().rules,
    templates: useTemplatesStore.getState().templates,
    settings: {
      theme: useSettingsStore.getState().theme,
      fontSize: useSettingsStore.getState().fontSize,
      wordWrap: useSettingsStore.getState().wordWrap,
      editorFontFamily: useSettingsStore.getState().editorFontFamily,
      stagingWidth: useSettingsStore.getState().stagingWidth,
      editorSplit: useSettingsStore.getState().editorSplit,
    },
    diff: { left: activeWs?.left ?? "", right: activeWs?.right ?? "" },
    list: {
      source: useListStore.getState().source,
      reference: useListStore.getState().reference,
      compare: useListStore.getState().compare,
    },
  };
}

export function exportBackup() {
  const d = collectBackup();
  downloadText(
    `with-work-backup-${new Date().toISOString().slice(0, 10)}.json`,
    JSON.stringify(d, null, 2),
    "application/json",
  );
}

export function parseBackup(
  raw: string,
): { ok: true; data: BackupData } | { ok: false; error: string } {
  try {
    const d: unknown = JSON.parse(raw);
    if (!d || typeof d !== "object" || (d as BackupData).app !== "with-work") {
      return { ok: false, error: "文件格式不正确：不是 with-work 的备份文件" };
    }
    const data = d as BackupData;
    if ((data.version as number) !== 1 && (data.version as number) !== 2) {
      return { ok: false, error: `不支持的备份版本：${data.version}` };
    }
    // v1 备份没有模板字段，兼容补空
    return {
      ok: true,
      data: {
        ...data,
        version: 2,
        templates: Array.isArray(data.templates) ? data.templates : [],
      },
    };
  } catch {
    return { ok: false, error: "JSON 解析失败，文件可能已损坏" };
  }
}

export function applyBackup(d: BackupData) {
  useWorkspaceStore.getState().replaceAll(d.workspaces);
  useStagingStore.getState().replaceAll(d.staging);
  useRulesStore.getState().replaceAll(d.rules);
  useTemplatesStore.getState().replaceAll(d.templates);
  useSettingsStore.getState().replaceAll(d.settings);
  useListStore.getState().replaceAll(d.list);
  // 旧版备份的工作区没有 left/right，把备份的 diff 合并到当前工作区
  const wsState = useWorkspaceStore.getState();
  if (wsState.activeId && (d.diff.left || d.diff.right)) {
    wsState.setLeft(wsState.activeId, d.diff.left);
    wsState.setRight(wsState.activeId, d.diff.right);
  }
  applyTheme(d.settings.theme);
}

export function exportRules() {
  downloadText(
    "with-work-rules.json",
    JSON.stringify(useRulesStore.getState().rules, null, 2),
    "application/json",
  );
}

export function parseRules(
  raw: string,
): { ok: true; rules: ReplaceRule[] } | { ok: false; error: string } {
  try {
    const d: unknown = JSON.parse(raw);
    if (!Array.isArray(d)) {
      return { ok: false, error: "文件格式不正确：应为规则数组" };
    }
    return { ok: true, rules: d as ReplaceRule[] };
  } catch {
    return { ok: false, error: "JSON 解析失败，文件可能已损坏" };
  }
}

export function exportTemplates() {
  downloadText(
    "with-work-templates.json",
    JSON.stringify(useTemplatesStore.getState().templates, null, 2),
    "application/json",
  );
}

export function parseTemplates(
  raw: string,
): { ok: true; templates: SortTemplate[] } | { ok: false; error: string } {
  try {
    const d: unknown = JSON.parse(raw);
    if (!Array.isArray(d)) {
      return { ok: false, error: "文件格式不正确：应为模板数组" };
    }
    return { ok: true, templates: d as SortTemplate[] };
  } catch {
    return { ok: false, error: "JSON 解析失败，文件可能已损坏" };
  }
}

export function exportCurrentWorkspace() {
  const s = useWorkspaceStore.getState();
  const ws: Workspace | undefined = s.workspaces.find((w) => w.id === s.activeId);
  if (!ws) return;
  downloadText(`${ws.name}.txt`, ws.content);
}

export function clearAllData() {
  STORAGE_KEYS.forEach((k) => localStorage.removeItem(k));
  location.reload();
}
