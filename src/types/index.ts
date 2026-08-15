export type ViewId = "editor" | "diff" | "list" | "settings";
export type ThemeMode = "light" | "dark" | "system";

export interface Workspace {
  id: string;
  name: string;
  content: string;
  language: string;
  view: ViewId;
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

export interface AppSettings {
  theme: ThemeMode;
  fontSize: number;
  wordWrap: boolean;
  editorFontFamily: string;
}

export interface BackupData {
  app: "with-work";
  version: 1;
  exportedAt: string;
  workspaces: Workspace[];
  staging: StagingItem[];
  rules: ReplaceRule[];
  settings: AppSettings;
  diff: { left: string; right: string };
  list: { source: string; reference: string; compare: string };
}

export const VIEW_LABELS: Record<ViewId, string> = {
  editor: "编辑器",
  diff: "文本对比",
  list: "列表工具",
  settings: "设置",
};
