import { DELIMITER_LITERALS, detectDelimiter, splitLines, type SplitDelimiter } from "./split";

/**
 * 「组合」：把多行文本用同一个组合符拼成一行（相当于 JS 的 Array.join），
 * 与「分割」（一行拆成多行）互为逆操作，因此共用同一组分隔符选项。
 */

export interface JoinOptions {
  delimiter: SplitDelimiter;
  /** delimiter 为 custom 时的正则：取其在本段文本中匹配到的字面量作为组合符 */
  customRegex?: string;
}

export interface JoinResult {
  /** 拼接结果；出错时为原文 */
  text: string;
  /** 参与拼接的行数 */
  count: number;
  /** 实际使用的组合符（出错时为空串） */
  separator: string;
  error?: string;
}

type SeparatorResult = { separator: string } | { error: string };

/** 解析本次要用的组合符 */
export function resolveSeparator(text: string, opts: JoinOptions): SeparatorResult {
  const { delimiter, customRegex } = opts;

  if (delimiter === "auto") {
    const detected = detectDelimiter(text);
    // detectDelimiter 无符号可用时返回 newline；此时组合成一行等于没做事，如实提示
    if (detected === "newline") {
      return { error: "自动检测未找到可用的组合符，请手动选择" };
    }
    return { separator: DELIMITER_LITERALS[detected] };
  }

  if (delimiter === "custom") {
    const pattern = customRegex?.trim();
    if (!pattern) return { error: "请输入自定义组合正则" };
    let re: RegExp;
    try {
      re = new RegExp(pattern);
    } catch {
      return { error: "正则表达式无效" };
    }
    // 正则本身不能直接当分隔字符串（如 [，,]），取它在文本里实际匹配到的文本；
    // 匹配不到时不能拿正则源码去拼接（那会把 "\d+" 之类原样写进内容），如实报错
    const matched = text.match(re);
    if (!matched || matched.length === 0) {
      return { error: "自定义组合正则没有在文本中匹配到内容" };
    }
    return { separator: matched[0] };
  }

  return { separator: DELIMITER_LITERALS[delimiter] };
}

/** 把多行组合成一行：按行拆分（去空白与空行）后用组合符拼接 */
export function joinText(text: string, opts: JoinOptions): JoinResult {
  const lines = splitLines(text);
  const resolved = resolveSeparator(text, opts);
  if ("error" in resolved) {
    // 出错时不报告行数（调用方拿到 error 就应中止，避免误读成「拼接了几行」）
    return { text, count: 0, separator: "", error: resolved.error };
  }
  return {
    text: lines.join(resolved.separator),
    count: lines.length,
    separator: resolved.separator,
  };
}
