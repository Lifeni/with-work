/** 查找替换共用的替换计算工具（编辑器面板与全局工具共用） */

export function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** 计算单处替换的替换文本（正则模式支持 $1、$&、$$） */
export function computeReplacement(
  replace: string,
  isRegex: boolean,
  matchText: string,
  groups: string[],
): string {
  if (!isRegex) return replace;
  return replace.replace(/\$(\d+)|\$&|\$\$/g, (token, num: string | undefined) => {
    if (token === "$&") return matchText;
    if (token === "$$") return "$";
    if (num !== undefined) return groups[Number(num) - 1] ?? "";
    return token;
  });
}

/** 在字符串层面应用全部替换（用于预览与规则工具） */
export function applyReplacements(
  text: string,
  find: string,
  replace: string,
  isRegex: boolean,
  matchCase: boolean,
): string {
  if (!find) return text;
  try {
    if (isRegex) {
      const flags = "g" + (matchCase ? "" : "i");
      const re = new RegExp(find, flags);
      return text.replace(re, (...args) => {
        const matchText = args[0] as string;
        const groups = args.slice(1, -2) as string[];
        return computeReplacement(replace, true, matchText, groups);
      });
    }
    if (matchCase) return text.split(find).join(replace);
    const re = new RegExp(escapeRegExp(find), "gi");
    return text.replace(re, () => replace);
  } catch {
    return text;
  }
}
