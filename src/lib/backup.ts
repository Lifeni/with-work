import type { BackupData, ReplaceRule, SortTemplate, TextTemplate, Workspace } from "@/types";
import { useWorkspaceStore } from "@/stores/workspace";
import { useStagingStore } from "@/stores/staging";
import { useRulesStore } from "@/stores/rules";
import { useTemplatesStore } from "@/stores/templates";
import { useTextTemplatesStore } from "@/stores/textTemplates";
import { useSettingsStore } from "@/stores/settings";
import { ALL_STORAGE_KEYS } from "./storageKeys";
import { downloadText } from "./utils";
import { applyTheme } from "./theme";

export function collectBackup(): BackupData {
  const wsStore = useWorkspaceStore();
  const activeWs = wsStore.workspaces.find((w) => w.id === wsStore.activeId);
  const settings = useSettingsStore();
  return {
    app: "with-work",
    version: 3,
    exportedAt: new Date().toISOString(),
    workspaces: wsStore.workspaces,
    staging: useStagingStore().items,
    rules: useRulesStore().rules,
    templates: useTemplatesStore().templates,
    textTemplates: useTextTemplatesStore().templates,
    settings: {
      theme: settings.theme,
      fontSize: settings.fontSize,
      wordWrap: settings.wordWrap,
      editorFontFamily: settings.editorFontFamily,
      stagingWidth: settings.stagingWidth,
      editorSplit: settings.editorSplit,
      stagingTemplateHeight: settings.stagingTemplateHeight,
    },
    diff: { left: activeWs?.left ?? "", right: activeWs?.right ?? "" },
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
    const version = data.version as number;
    if (version !== 1 && version !== 2 && version !== 3) {
      return { ok: false, error: `不支持的备份版本：${version}` };
    }
    // 旧版备份缺少模板字段，兼容补空
    return {
      ok: true,
      data: {
        ...data,
        version: 3,
        templates: Array.isArray(data.templates) ? data.templates : [],
        textTemplates: Array.isArray(data.textTemplates) ? data.textTemplates : [],
      },
    };
  } catch {
    return { ok: false, error: "JSON 解析失败，文件可能已损坏" };
  }
}

export function applyBackup(d: BackupData) {
  useWorkspaceStore().replaceAll(d.workspaces);
  useStagingStore().replaceAll(d.staging);
  useRulesStore().replaceAll(d.rules);
  useTemplatesStore().replaceAll(d.templates);
  useTextTemplatesStore().replaceAll(d.textTemplates);
  useSettingsStore().replaceAll(d.settings);
  // 旧版备份的工作区没有 left/right，把备份的 diff 合并到当前工作区
  const wsStore = useWorkspaceStore();
  if (wsStore.activeId && (d.diff.left || d.diff.right)) {
    wsStore.setLeft(wsStore.activeId, d.diff.left);
    wsStore.setRight(wsStore.activeId, d.diff.right);
  }
  applyTheme(d.settings.theme);
}

export function exportRules() {
  downloadText(
    "with-work-rules.json",
    JSON.stringify(useRulesStore().rules, null, 2),
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
    JSON.stringify(useTemplatesStore().templates, null, 2),
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

export function exportTextTemplates() {
  downloadText(
    "with-work-text-templates.json",
    JSON.stringify(useTextTemplatesStore().templates, null, 2),
    "application/json",
  );
}

export function parseTextTemplates(
  raw: string,
): { ok: true; templates: TextTemplate[] } | { ok: false; error: string } {
  try {
    const d: unknown = JSON.parse(raw);
    if (!Array.isArray(d)) {
      return { ok: false, error: "文件格式不正确：应为模板数组" };
    }
    return { ok: true, templates: d as TextTemplate[] };
  } catch {
    return { ok: false, error: "JSON 解析失败，文件可能已损坏" };
  }
}

/** 工作区导出为纯文本：只有右栏时直接取右栏，双栏时用分隔线拼接，便于一眼对照 */
export function workspaceExportText(ws: Workspace): string {
  const left = ws.left ?? "";
  const right = ws.right ?? "";
  if (!left) return right;
  if (!right) return left;
  return `${left}\n\n--------\n\n${right}`;
}

export function exportCurrentWorkspace() {
  const s = useWorkspaceStore();
  const ws: Workspace | undefined = s.workspaces.find((w) => w.id === s.activeId);
  if (!ws) return;
  downloadText(`${ws.name}.txt`, workspaceExportText(ws));
}

/**
 * 清除本地保存的全部数据（含内置数据标记，使内置规则/模板在下次启动时重新注入）。
 * 页面重载交由 clearAllData 处理，便于测试直接验证清理结果。
 */
export function clearAllStoredData() {
  ALL_STORAGE_KEYS.forEach((k) => localStorage.removeItem(k));
}

export function clearAllData() {
  clearAllStoredData();
  location.reload();
}
