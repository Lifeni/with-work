export interface ListDiffResult {
  onlyA: string[];
  onlyB: string[];
  both: string[];
  aDuplicates: string[];
  bDuplicates: string[];
}

/** 基于集合（带计数）对比两个列表：仅在 A / 仅在 B / 共同 + 各自重复项 */
export function compareLists(a: string[], b: string[]): ListDiffResult {
  const count = (arr: string[]) => {
    const m = new Map<string, number>();
    for (const x of arr) m.set(x, (m.get(x) ?? 0) + 1);
    return m;
  };
  const ma = count(a);
  const mb = count(b);

  const onlyA: string[] = [];
  const onlyB: string[] = [];
  const both: string[] = [];
  const seen = new Set<string>();

  for (const x of a) {
    if (seen.has(x)) continue;
    seen.add(x);
    if ((mb.get(x) ?? 0) === 0) onlyA.push(x);
    else both.push(x);
  }
  for (const x of b) {
    if (seen.has(x)) continue;
    seen.add(x);
    if ((ma.get(x) ?? 0) === 0) onlyB.push(x);
  }

  return {
    onlyA,
    onlyB,
    both,
    aDuplicates: [...new Set(a.filter((x, i) => a.indexOf(x) !== i))],
    bDuplicates: [...new Set(b.filter((x, i) => b.indexOf(x) !== i))],
  };
}
