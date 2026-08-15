export type SplitDelimiter =
  | "auto"
  | "newline"
  | "comma"
  | "cn-comma"
  | "semicolon"
  | "cn-semicolon"
  | "cn-dunhao"
  | "space"
  | "custom";

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

/** 自动检测：统计候选符号出现次数，取最多的作为分隔符；都没有则按换行 */
export function detectDelimiter(text: string): SplitDelimiter {
  const stats: [SplitDelimiter, number][] = [
    ["comma", (text.match(/,/g) ?? []).length],
    ["cn-comma", (text.match(/，/g) ?? []).length],
    ["semicolon", (text.match(/;/g) ?? []).length],
    ["cn-semicolon", (text.match(/；/g) ?? []).length],
    ["cn-dunhao", (text.match(/、/g) ?? []).length],
    ["space", (text.match(/[ \t]/g) ?? []).length],
  ];
  stats.sort((a, b) => b[1] - a[1]);
  return stats[0][1] > 0 ? stats[0][0] : "newline";
}

const AUTO_CHARS: Partial<Record<SplitDelimiter, string>> = {
  comma: ",",
  "cn-comma": "，",
  semicolon: ";",
  "cn-semicolon": "；",
  "cn-dunhao": "、",
};

export function splitText(text: string, opts: SplitOptions): SplitResult {
  if (!text) return { items: [] };
  const { delimiter, customRegex, trim = true, ignoreEmpty = true, dedupe = false } = opts;

  let parts: string[];
  switch (delimiter) {
    case "auto": {
      const d = detectDelimiter(text);
      if (d === "newline") parts = text.split(/\r?\n/);
      else if (d === "space") parts = text.split(/[ \t]+/);
      else parts = text.split(AUTO_CHARS[d] ?? ",");
      break;
    }
    case "newline":
      parts = text.split(/\r?\n/);
      break;
    case "comma":
      parts = text.split(",");
      break;
    case "cn-comma":
      parts = text.split("，");
      break;
    case "semicolon":
      parts = text.split(";");
      break;
    case "cn-semicolon":
      parts = text.split("；");
      break;
    case "cn-dunhao":
      parts = text.split("、");
      break;
    case "space":
      parts = text.split(/[ \t]+/);
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
