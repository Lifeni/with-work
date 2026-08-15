export type SplitDelimiter = "comma" | "cn-comma" | "space" | "newline" | "custom";

export interface SplitOptions {
  delimiter: SplitDelimiter;
  customRegex?: string;
  trim?: boolean;
  ignoreEmpty?: boolean;
  dedupe?: boolean;
}

export interface SplitResult {
  items: string[];
  error?: string;
}

export function splitText(text: string, opts: SplitOptions): SplitResult {
  if (!text) return { items: [] };
  const { delimiter, customRegex, trim = true, ignoreEmpty = true, dedupe = false } = opts;

  let parts: string[];
  switch (delimiter) {
    case "comma":
      parts = text.split(",");
      break;
    case "cn-comma":
      parts = text.split("，");
      break;
    case "space":
      parts = text.split(/[ \t]+/);
      break;
    case "newline":
      parts = text.split(/\r?\n/);
      break;
    case "custom": {
      if (!customRegex) return { items: [], error: "请输入自定义分割正则" };
      try {
        parts = text.split(new RegExp(customRegex, "g"));
      } catch {
        return { items: [], error: "正则表达式无效" };
      }
      break;
    }
  }

  let items = parts;
  if (trim) items = items.map((p) => p.trim());
  if (ignoreEmpty) items = items.filter((p) => p !== "");
  if (dedupe) items = [...new Set(items)];
  return { items };
}

/** 将文本按行拆分（参考列表、对比列表使用），去空白与空行 */
export function splitLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}
