/**
 * 编辑器字体：保留用户选择的编码字体，同时为非拉丁 glyph 提供项目中文回退。
 * 通用字体放到末尾，避免 monospace / system-ui 先匹配后截断中文候选。
 */
const GENERIC_FAMILIES = new Set([
  "serif",
  "sans-serif",
  "monospace",
  "cursive",
  "fantasy",
  "system-ui",
  "ui-serif",
  "ui-sans-serif",
  "ui-monospace",
  "ui-rounded",
  "math",
  "emoji",
]);

const CHINESE_FALLBACKS = [
  "MiSans",
  '"HarmonyOS Sans SC"',
  '"Source Han Sans SC"',
  '"Noto Sans SC"',
  "system-ui",
  "-apple-system",
  '"Segoe UI"',
];

/** 按 CSS 逗号分隔解析字体名，并保留引号内的逗号。 */
function splitFontFamilies(fontFamily: string): string[] {
  const result: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;
  let escaped = false;

  for (const character of fontFamily) {
    if (escaped) {
      current += character;
      escaped = false;
      continue;
    }
    if (character === "\\") {
      current += character;
      escaped = true;
      continue;
    }
    if (quote) {
      current += character;
      if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'") {
      current += character;
      quote = character;
      continue;
    }
    if (character === ",") {
      if (current.trim()) result.push(current.trim());
      current = "";
      continue;
    }
    current += character;
  }

  if (current.trim()) result.push(current.trim());
  return result;
}

function familyKey(font: string): string {
  return font
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .toLowerCase();
}

function isGenericFamily(font: string): boolean {
  const value = font.trim();
  if (value.startsWith('"') || value.startsWith("'")) return false;
  return GENERIC_FAMILIES.has(value.toLowerCase());
}

/** 构建 Monaco 字体栈：编码字体 → 中文回退 → 系统回退 → 通用回退。 */
export function resolveEditorFontFamily(fontFamily: string): string {
  const parsed = splitFontFamilies(fontFamily);
  const specific = parsed.filter((font) => !isGenericFamily(font));
  const generics = parsed.filter(isGenericFamily);
  const seen = new Set<string>();
  const result: string[] = [];

  for (const font of [...specific, ...CHINESE_FALLBACKS, ...generics, "monospace", "sans-serif"]) {
    const key = familyKey(font);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(font);
  }

  return result.join(", ");
}
