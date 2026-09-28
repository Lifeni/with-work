import type { BackupData, ReplaceRule, SortTemplate, TextTemplate, Workspace } from "@/types";
import { useWorkspaceStore } from "@/stores/workspace";
import { useStagingStore } from "@/stores/staging";
import { useRulesStore } from "@/stores/rules";
import { useTemplatesStore } from "@/stores/templates";
import { useTextTemplatesStore } from "@/stores/textTemplates";
import { useSettingsStore } from "@/stores/settings";
import { disablePersist } from "@/stores/persist";
import { ALL_STORAGE_KEYS } from "./storageKeys";
import { normalizeWorkspaces } from "./workspaceMigration";
import { downloadText } from "./utils";
import { applyTheme } from "./theme";

export function collectBackup(): BackupData {
  const wsStore = useWorkspaceStore();
  const activeWs = wsStore.workspaces.find((w) => w.id === wsStore.activeId);
  const settings = useSettingsStore();
  return {
    app: "with-work",
    version: 4,
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
    if (version !== 1 && version !== 2 && version !== 3 && version !== 4) {
      return { ok: false, error: `不支持的备份版本：${version}` };
    }
    // 宽容恢复：字段缺失或类型不对（手工改过 / 传输损坏）时补默认值，
    // 避免 applyBackup 里 replaceAll(undefined) 之类的崩溃
    const asArray = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
    const rawDiff = (data.diff ?? {}) as Partial<BackupData["diff"]>;

    // 旧版备份缺少模板字段，兼容补空；工作区统一走迁移清洗（旧单栏 content → 左栏）。
    // 保留源版本号：applyBackup 需要据此判断是否用 diff 兜底（仅 v1/v2 需要）。
    return {
      ok: true,
      data: {
        ...data,
        version,
        workspaces: normalizeWorkspaces(data.workspaces),
        staging: asArray(data.staging),
        rules: asArray(data.rules),
        templates: asArray(data.templates),
        textTemplates: asArray(data.textTemplates),
        settings:
          data.settings && typeof data.settings === "object"
            ? data.settings
            : ({} as BackupData["settings"]),
        diff: { left: rawDiff.left ?? "", right: rawDiff.right ?? "" },
      },
    };
  } catch {
    return { ok: false, error: "JSON 解析失败，文件可能已损坏" };
  }
}

export function applyBackup(d: BackupData) {
  // parseBackup 已归一化过一次；这里再跑一次是幂等的防御（applyBackup 也可能被直接调用），
  // 保证无论调用路径如何，写入 store 的都是当前结构的工作区。
  useWorkspaceStore().replaceAll(normalizeWorkspaces(d.workspaces));
  useStagingStore().replaceAll(d.staging);
  useRulesStore().replaceAll(d.rules);
  useTemplatesStore().replaceAll(d.templates);
  useTextTemplatesStore().replaceAll(d.textTemplates);
  useSettingsStore().replaceAll(d.settings);
  // v1/v2 备份的工作区只有单栏 content，双栏内容只存在于 diff 里，需要回填；
  // v3+ 的工作区本身已带 left/right，diff 只是导出时那个工作区的快照，
  // 无条件回填会把「另一个工作区」的内容覆盖到恢复后的首个工作区上。
  const wsStore = useWorkspaceStore();
  if (d.version < 3 && wsStore.activeId && (d.diff.left || d.diff.right)) {
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

/** 双栏导出时的分栏分隔线 */
const EXPORT_SEPARATOR = "--------";

/** 工作区导出为纯文本：只有右栏时直接取右栏，双栏时用分隔线拼接，便于一眼对照 */
export function workspaceExportText(ws: Workspace): string {
  const left = ws.left ?? "";
  const right = ws.right ?? "";
  if (!left) return right;
  if (!right) return left;
  return `${left}\n\n${EXPORT_SEPARATOR}\n\n${right}`;
}

export function exportCurrentWorkspace() {
  const s = useWorkspaceStore();
  const ws: Workspace | undefined = s.workspaces.find((w) => w.id === s.activeId);
  if (!ws) return;
  downloadText(`${ws.name}.txt`, workspaceExportText(ws));
}

/**
 * 清除本地保存的全部数据（含内置数据标记，使内置规则/模板在下次启动时重新注入）。
 * 同时停写（`disablePersist`），避免内存中的旧状态被写回——因此调用方必须在清空后
 * 立即刷新页面（`clearAllData` 即如此）；页面重载单独拆出只是为了便于测试验证清理结果。
 */
export function clearAllStoredData() {
  // 先停写：否则防抖窗口内的旧内容会在关页 flush，或后续任何 store 变更时被重新写回
  disablePersist();
  ALL_STORAGE_KEYS.forEach((k) => localStorage.removeItem(k));
}

export function clearAllData() {
  clearAllStoredData();
  location.reload();
}
