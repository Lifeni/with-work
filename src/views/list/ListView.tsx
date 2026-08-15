import { useState } from "react";
import {
  ArrowRight,
  Copy,
  FileText,
  GitCompareArrows,
  Scissors,
  SortAsc,
  Wand2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Toggle } from "@/components/ui/toggle";
import { compareLists, type ListDiffResult } from "@/lib/listDiff";
import { sortAlphabetical, sortByReference, type SortResult } from "@/lib/sort";
import { splitLines, splitText, type SplitDelimiter, type SplitResult } from "@/lib/split";
import { importText } from "@/lib/transfer";
import { useListStore } from "@/stores/list";
import { useToastStore } from "@/stores/toast";
import { cn } from "@/lib/utils";

function Card({
  title,
  icon,
  children,
  className,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-lg border border-border bg-card p-4", className)}>
      <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

function NumberedList({ items, className }: { items: string[]; className?: string }) {
  if (items.length === 0) {
    return <p className="py-2 text-center text-xs text-muted-foreground">（空）</p>;
  }
  return (
    <ol
      className={cn(
        "max-h-48 overflow-y-auto rounded-md border border-border bg-background p-2 pl-6 text-xs",
        className,
      )}
    >
      {items.map((item, i) => (
        <li key={`${i}-${item}`} className="break-all py-0.5 font-mono">
          {item}
        </li>
      ))}
    </ol>
  );
}

export default function ListView() {
  const source = useListStore((s) => s.source);
  const reference = useListStore((s) => s.reference);
  const compare = useListStore((s) => s.compare);
  const setSource = useListStore((s) => s.setSource);
  const setReference = useListStore((s) => s.setReference);
  const setCompare = useListStore((s) => s.setCompare);
  const toast = useToastStore((s) => s.push);

  const [delimiter, setDelimiter] = useState<SplitDelimiter>("newline");
  const [customRegex, setCustomRegex] = useState("");
  const [trim, setTrim] = useState(true);
  const [ignoreEmpty, setIgnoreEmpty] = useState(true);
  const [dedupe, setDedupe] = useState(false);
  const [splitResult, setSplitResult] = useState<SplitResult | null>(null);
  const [sortMode, setSortMode] = useState<"reference" | "alpha-asc" | "alpha-desc">("reference");
  const [sortResult, setSortResult] = useState<SortResult | null>(null);
  const [compareResult, setCompareResult] = useState<ListDiffResult | null>(null);

  const copyLines = (lines: string[], label: string) => {
    if (lines.length === 0) {
      toast("没有可复制的内容");
      return;
    }
    void navigator.clipboard.writeText(lines.join("\n"));
    toast(`已复制${label}（${lines.length} 条）`);
  };

  const doSplit = () => {
    const r = splitText(source, { delimiter, customRegex, trim, ignoreEmpty, dedupe });
    setSplitResult(r);
    setSortResult(null);
    setCompareResult(null);
    if (r.error) toast(r.error);
  };

  const doSort = () => {
    const items = splitResult?.items;
    if (!items || items.length === 0) {
      toast("请先分割文本");
      return;
    }
    if (sortMode === "reference") {
      const ref = splitLines(reference);
      if (ref.length === 0) {
        toast("请先输入参考列表（每行一条）");
        return;
      }
      setSortResult(sortByReference(items, ref));
    } else {
      setSortResult({
        sorted: sortAlphabetical(items, sortMode === "alpha-asc" ? "asc" : "desc"),
        unmatched: [],
      });
    }
  };

  const doCompare = () => {
    const items = splitResult?.items ?? [];
    const other = splitLines(compare);
    if (items.length === 0 && other.length === 0) {
      toast("请先分割文本，并输入对比列表");
      return;
    }
    setCompareResult(compareLists(items, other));
  };

  const importEditor = (lines: string[]) => {
    if (lines.length === 0) {
      toast("没有可导入的内容");
      return;
    }
    importText("editor", lines.join("\n"));
  };

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-4 xl:grid-cols-2">
        <Card
          title="① 分割文本"
          icon={<Scissors className="size-4 text-muted-foreground" />}
          className="xl:col-span-2"
        >
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_280px]">
            <Textarea
              rows={5}
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="粘贴待处理的源文本，例如：苹果, 香蕉, 橙子, …"
              className="font-mono text-xs"
            />
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="shrink-0 text-xs text-muted-foreground">分隔符</span>
                <select
                  value={delimiter}
                  onChange={(e) => setDelimiter(e.target.value as SplitDelimiter)}
                  className="h-7 min-w-0 flex-1 rounded-md border border-border bg-transparent px-2 text-xs outline-none hover:bg-accent"
                >
                  <option value="newline">换行</option>
                  <option value="comma">英文逗号</option>
                  <option value="cn-comma">中文逗号</option>
                  <option value="space">空格 / Tab</option>
                  <option value="custom">自定义正则</option>
                </select>
              </div>
              {delimiter === "custom" && (
                <Input
                  value={customRegex}
                  onChange={(e) => setCustomRegex(e.target.value)}
                  placeholder="如 [，,、;；]"
                  className="h-7 font-mono text-xs"
                />
              )}
              <div className="flex flex-wrap gap-1.5">
                <Toggle active={trim} onClick={() => setTrim(!trim)}>
                  去首尾空格
                </Toggle>
                <Toggle active={ignoreEmpty} onClick={() => setIgnoreEmpty(!ignoreEmpty)}>
                  忽略空项
                </Toggle>
                <Toggle active={dedupe} onClick={() => setDedupe(!dedupe)}>
                  去重
                </Toggle>
              </div>
              <Button size="sm" className="mt-auto h-7 text-xs" onClick={doSplit}>
                <Wand2 className="size-3.5" />
                分割
              </Button>
            </div>
          </div>
          {splitResult && (
            <div className="mt-3">
              <div className="mb-1.5 flex items-center gap-2">
                <Badge variant="secondary">共 {splitResult.items.length} 项</Badge>
                {splitResult.error && <Badge variant="destructive">{splitResult.error}</Badge>}
                <div className="flex-1" />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => copyLines(splitResult.items, "分割结果")}
                >
                  <Copy className="size-3" />
                  复制
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => importEditor(splitResult.items)}
                >
                  <FileText className="size-3" />
                  导入编辑器
                </Button>
              </div>
              <NumberedList items={splitResult.items} />
            </div>
          )}
        </Card>

        <Card title="② 排序" icon={<SortAsc className="size-4 text-muted-foreground" />}>
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-xs text-muted-foreground">方式</span>
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as typeof sortMode)}
              className="h-7 min-w-0 flex-1 rounded-md border border-border bg-transparent px-2 text-xs outline-none hover:bg-accent"
            >
              <option value="reference">按参考列表顺序</option>
              <option value="alpha-asc">字母升序</option>
              <option value="alpha-desc">字母降序</option>
            </select>
          </div>
          {sortMode === "reference" && (
            <div className="mt-2 space-y-1.5">
              <Textarea
                rows={3}
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="参考列表（每行一条），优先匹配靠前的项"
                className="min-h-16 font-mono text-xs"
              />
              <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <ArrowRight className="size-3" />
                不在参考列表中的项会单独列出
              </p>
            </div>
          )}
          <Button size="sm" className="mt-2 h-7 text-xs" onClick={doSort} disabled={!splitResult}>
            排序
          </Button>
          {sortResult && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">排序结果 {sortResult.sorted.length} 项</Badge>
                <div className="flex-1" />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => copyLines(sortResult.sorted, "排序结果")}
                >
                  <Copy className="size-3" />
                  复制
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => importEditor(sortResult.sorted)}
                >
                  <FileText className="size-3" />
                  导入编辑器
                </Button>
              </div>
              <NumberedList items={sortResult.sorted} />
              {sortResult.unmatched.length > 0 && (
                <div>
                  <Badge
                    variant="outline"
                    className="border-amber-500/50 text-amber-600 dark:text-amber-400"
                  >
                    未匹配 {sortResult.unmatched.length} 项（不在参考列表中）
                  </Badge>
                  <div className="mt-1.5 rounded-md border border-amber-500/40 bg-amber-500/5 p-2 pl-6">
                    <ol className="max-h-32 overflow-y-auto text-xs">
                      {sortResult.unmatched.map((item, i) => (
                        <li
                          key={`u-${i}-${item}`}
                          className="break-all py-0.5 font-mono text-amber-600 dark:text-amber-400"
                        >
                          {item}
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>

        <Card
          title="③ 列表对比"
          icon={<GitCompareArrows className="size-4 text-muted-foreground" />}
        >
          <Textarea
            rows={4}
            value={compare}
            onChange={(e) => setCompare(e.target.value)}
            placeholder="另一个列表（每行一条），与分割结果对比"
            className="min-h-16 font-mono text-xs"
          />
          <Button
            size="sm"
            className="mt-2 h-7 text-xs"
            onClick={doCompare}
            disabled={!splitResult}
          >
            对比
          </Button>
          {compareResult && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              <div>
                <Badge
                  variant="outline"
                  className="mb-1.5 border-sky-500/50 text-sky-600 dark:text-sky-400"
                >
                  仅在左侧 {compareResult.onlyA.length}
                </Badge>
                <NumberedList items={compareResult.onlyA} className="max-h-40" />
              </div>
              <div>
                <Badge
                  variant="outline"
                  className="mb-1.5 border-emerald-500/50 text-emerald-600 dark:text-emerald-400"
                >
                  共同 {compareResult.both.length}
                </Badge>
                <NumberedList items={compareResult.both} className="max-h-40" />
              </div>
              <div>
                <Badge
                  variant="outline"
                  className="mb-1.5 border-rose-500/50 text-rose-600 dark:text-rose-400"
                >
                  仅在右侧 {compareResult.onlyB.length}
                </Badge>
                <NumberedList items={compareResult.onlyB} className="max-h-40" />
              </div>
              {(compareResult.aDuplicates.length > 0 || compareResult.bDuplicates.length > 0) && (
                <p className="col-span-3 text-[10px] text-muted-foreground">
                  {compareResult.aDuplicates.length > 0 &&
                    `左侧重复项：${compareResult.aDuplicates.join("、")}；`}
                  {compareResult.bDuplicates.length > 0 &&
                    `右侧重复项：${compareResult.bDuplicates.join("、")}`}
                </p>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
