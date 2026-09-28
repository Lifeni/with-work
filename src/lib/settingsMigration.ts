import type { AppSettings, ThemeMode } from "@/types";

/**
 * 设置项的归一化（默认值 + 取值范围）。
 * 持久化恢复与备份导入都用它：localStorage 里的老数据、手工改过的备份文件
 * 都可能带着错误类型（如 fontSize: "big"），直接写进 store 会让渲染或持久化出错。
 */

export const DEFAULT_FONT_SIZE = 14;
export const DEFAULT_FONT_FAMILY = "ui-monospace, SF Mono, Cascadia Code, Consolas, monospace";

/** 字号范围（与设置面板输入框一致） */
export const MIN_FONT_SIZE = 10;
export const MAX_FONT_SIZE = 24;
/** 左右分栏比例范围（与拖动调节一致） */
export const MIN_EDITOR_SPLIT = 0.25;
export const MAX_EDITOR_SPLIT = 0.75;
/** 暂存区宽度范围（与拖动调节一致） */
export const MIN_STAGING_WIDTH = 280;
export const MAX_STAGING_WIDTH = 560;
/** 模板区最小高度（与拖动调节一致） */
export const MIN_TEMPLATE_HEIGHT = 160;

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** 合法数字才采纳（NaN / Infinity / 字符串一律视为无效） */
function finiteOr(v: unknown, fallback: number | undefined): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function normalizeTheme(v: unknown): ThemeMode {
  return v === "light" || v === "dark" || v === "system" ? v : "system";
}

/** 把任意来源的设置对象归一化为可安全写入 store 的完整 AppSettings */
export function normalizeSettings(raw: unknown): AppSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<AppSettings>;

  const fontSize = finiteOr(r.fontSize, DEFAULT_FONT_SIZE);
  const stagingWidth = finiteOr(r.stagingWidth, undefined);
  const editorSplit = finiteOr(r.editorSplit, undefined);
  const stagingTemplateHeight = finiteOr(r.stagingTemplateHeight, undefined);

  return {
    theme: normalizeTheme(r.theme),
    fontSize: clamp(fontSize as number, MIN_FONT_SIZE, MAX_FONT_SIZE),
    wordWrap: typeof r.wordWrap === "boolean" ? r.wordWrap : true,
    editorFontFamily:
      typeof r.editorFontFamily === "string" && r.editorFontFamily.trim()
        ? r.editorFontFamily
        : DEFAULT_FONT_FAMILY,
    ...(stagingWidth === undefined
      ? {}
      : { stagingWidth: clamp(stagingWidth, MIN_STAGING_WIDTH, MAX_STAGING_WIDTH) }),
    ...(editorSplit === undefined
      ? {}
      : { editorSplit: clamp(editorSplit, MIN_EDITOR_SPLIT, MAX_EDITOR_SPLIT) }),
    ...(stagingTemplateHeight === undefined
      ? {}
      : { stagingTemplateHeight: Math.max(MIN_TEMPLATE_HEIGHT, stagingTemplateHeight) }),
  };
}
