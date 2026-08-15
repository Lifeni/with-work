export interface SortResult {
  sorted: string[];
  unmatched: string[];
}

/** 匹配模式：精确匹配（默认） / 以参考列表项开头即匹配 */
export type MatchMode = "exact" | "prefix";

/** 按参考列表顺序排序；不在参考列表中的项单独收集 */
export function sortByReference(
  items: string[],
  reference: string[],
  matchMode: MatchMode = "exact",
): SortResult {
  const index = new Map<string, number>();
  reference.forEach((r, i) => {
    const key = r.trim();
    if (key && !index.has(key)) index.set(key, i);
  });

  // 返回匹配到的参考项 key（prefix 模式取参考顺序中第一个前缀命中的项）
  const matchKey = (t: string): string | undefined => {
    if (matchMode === "prefix") {
      for (const r of reference) {
        const key = r.trim();
        if (key && t.startsWith(key)) return key;
      }
      return undefined;
    }
    return index.has(t) ? t : undefined;
  };

  const sorted: string[] = [];
  const unmatched: string[] = [];
  for (const item of items) {
    const key = matchKey(item.trim());
    if (key === undefined) unmatched.push(item);
    else sorted.push(item);
  }
  // 参考顺序相同的项保持原相对顺序（Array.sort 稳定）
  sorted.sort((a, b) => {
    const ka = matchKey(a.trim());
    const kb = matchKey(b.trim());
    return (index.get(ka ?? "") ?? 0) - (index.get(kb ?? "") ?? 0);
  });
  return { sorted, unmatched };
}

export function sortAlphabetical(items: string[], order: "asc" | "desc"): string[] {
  return [...items].sort((a, b) => {
    const cmp = a.localeCompare(b, "zh-Hans-CN");
    return order === "asc" ? cmp : -cmp;
  });
}
