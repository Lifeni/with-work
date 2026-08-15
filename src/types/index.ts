export type ViewId = "editor" | "settings";
export type EditorMode = "single" | "dual";
export type ThemeMode = "light" | "dark" | "system";

export interface Workspace {
  id: string;
  name: string;
  content: string;
  language: string;
  view: ViewId;
  /** 编辑器模式：单编辑器 / 双编辑器（对比）。旧数据可能缺失，读取时用 ?? "single" */
  editorMode?: EditorMode;
}

export interface StagingItem {
  id: string;
  text: string;
  createdAt: number;
}

export interface ReplaceRule {
  id: string;
  name: string;
  find: string;
  replace: string;
  isRegex: boolean;
  matchCase: boolean;
}

/** 自定义排序模板：用户提供的顺序列表，待排序文本按此顺序排列 */
export interface SortTemplate {
  id: string;
  name: string;
  items: string[];
  /** 分组名（可选，默认未分组） */
  group?: string;
}

export interface AppSettings {
  theme: ThemeMode;
  fontSize: number;
  wordWrap: boolean;
  editorFontFamily: string;
}

export interface BackupData {
  app: "with-work";
  version: 2;
  exportedAt: string;
  workspaces: Workspace[];
  staging: StagingItem[];
  rules: ReplaceRule[];
  templates: SortTemplate[];
  settings: AppSettings;
  diff: { left: string; right: string };
  list: { source: string; reference: string; compare: string };
}

export const VIEW_LABELS: Record<ViewId, string> = {
  editor: "编辑器",
  settings: "设置",
};
