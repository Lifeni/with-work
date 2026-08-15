export interface SortResult {
  sorted: string[];
  unmatched: string[];
}

/** 按参考列表顺序排序；不在参考列表中的项单独收集 */
export function sortByReference(items: string[], reference: string[]): SortResult {
  const index = new Map<string, number>();
  reference.forEach((r, i) => {
    const key = r.trim();
    if (key && !index.has(key)) index.set(key, i);
  });

  const sorted: string[] = [];
  const unmatched: string[] = [];
  for (const item of items) {
    const i = index.get(item.trim());
    if (i === undefined) unmatched.push(item);
    else sorted.push(item);
  }
  // 参考顺序相同的项保持原相对顺序（Array.sort 稳定）
  sorted.sort((a, b) => (index.get(a.trim()) ?? 0) - (index.get(b.trim()) ?? 0));
  return { sorted, unmatched };
}

export function sortAlphabetical(items: string[], order: "asc" | "desc"): string[] {
  return [...items].sort((a, b) => {
    const cmp = a.localeCompare(b, "zh-Hans-CN");
    return order === "asc" ? cmp : -cmp;
  });
}
