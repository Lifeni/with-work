export type ThemeMode = "light" | "dark" | "system";

export interface Workspace {
  id: string;
  name: string;
  /** 双栏编辑器内容（旧数据可能缺失，读取时用 ?? ""） */
  left?: string;
  right?: string;
  /**
   * @deprecated 旧版单栏内容，仅用于兼容历史备份的读写往返，当前版本不再写入。
   * 界面内容一律以 left / right 为准。
   */
  content?: string;
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
  /** 开头匹配：文本以列表项开头即算匹配（旧数据可能缺失） */
  prefixMatch?: boolean;
}

/** 文本模板：一段可复用的文本，可拖拽/插入到编辑器 */
export interface TextTemplate {
  id: string;
  name: string;
  text: string;
  /** 分组名（可选，默认未分组） */
  group?: string;
}

export interface AppSettings {
  theme: ThemeMode;
  fontSize: number;
  wordWrap: boolean;
  editorFontFamily: string;
  /** 暂存区面板宽度（px），可拖动调节 */
  stagingWidth?: number;
  /** 左编辑器宽度占比（0.25 ~ 0.75），可拖动调节 */
  editorSplit?: number;
  /** 暂存区下方模板区高度（px），可拖动调节 */
  stagingTemplateHeight?: number;
}

export interface BackupData {
  app: "with-work";
  version: 3;
  exportedAt: string;
  workspaces: Workspace[];
  staging: StagingItem[];
  rules: ReplaceRule[];
  templates: SortTemplate[];
  textTemplates: TextTemplate[];
  settings: AppSettings;
  diff: { left: string; right: string };
}
