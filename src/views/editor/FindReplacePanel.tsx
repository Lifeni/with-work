import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import * as monaco from "monaco-editor";
import { DiffEditor } from "@monaco-editor/react";
import {
  ArrowDown,
  ArrowUp,
  CaseSensitive,
  Check,
  Eye,
  Highlighter,
  List,
  Redo2,
  Regex,
  Settings2,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toggle } from "@/components/ui/toggle";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { RulesDialog } from "@/components/shared/RulesDialog";
import { cn } from "@/lib/utils";
import { applyReplacements, computeReplacement } from "@/lib/replace";
import { compareLists, type ListDiffResult } from "@/lib/listDiff";
import { sortAlphabetical, sortByReference, type SortResult } from "@/lib/sort";
import { splitLines, splitText, type SplitDelimiter } from "@/lib/split";
import { useDebounce } from "@/hooks/useDebounce";
import { useRulesStore } from "@/stores/rules";
import { useListStore } from "@/stores/list";
import { useSettingsStore } from "@/stores/settings";
import { useToastStore } from "@/stores/toast";
import { useWorkspaceStore } from "@/stores/workspace";
import type { ReplaceRule } from "@/types";

interface MatchInfo {
  line: number;
  col: number;
  range: monaco.IRange;
  text: string;
  groups: string[];
}

export interface FindReplaceHandle {
  open: (mode: "find" | "replace" | "list") => void;
}

interface Props {
  editor: monaco.editor.IStandaloneCodeEditor | null;
  initialMode?: "find" | "replace" | "list";
}

export const FindReplacePanel = forwardRef<FindReplaceHandle, Props>(function FindReplacePanel(
  { editor, initialMode = "find" },
  ref,
) {
  const [mode, setMode] = useState<"find" | "replace" | "list">(initialMode);
  const [find, setFind] = useState("");
  const [replace, setReplace] = useState("");
  const [isRegex, setIsRegex] = useState(false);
  const [matchCase, setMatchCase] = useState(false);
  const [highlightAll, setHighlightAll] = useState(true);
  const [matches, setMatches] = useState<MatchInfo[]>([]);
  const [current, setCurrent] = useState(0);
  const [findError, setFindError] = useState<string | null>(null);
  const [showPositions, setShowPositions] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [preview, setPreview] = useState<{
    original: string;
    result: string;
    count: number;
  } | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [ruleDraft, setRuleDraft] = useState<{
    find: string;
    replace: string;
    isRegex: boolean;
    matchCase: boolean;
  } | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const findInputRef = useRef<HTMLInputElement>(null);
  const decorationsRef = useRef<monaco.editor.IEditorDecorationsCollection | null>(null);
  const currentRef = useRef(0);

  const rules = useRulesStore((s) => s.rules);
  const toast = useToastStore((s) => s.push);

  // 监听目标编辑器内容版本：单/双编辑器模式下都能在内容变化时自动重跑搜索
  const [modelVersion, setModelVersion] = useState(0);
  useEffect(() => {
    if (!editor) return;
    const model = editor.getModel();
    if (!model) return;
    const sub = model.onDidChangeContent(() => setModelVersion((v) => v + 1));
    return () => sub.dispose();
  }, [editor]);

  const monacoTheme = useSettingsStore((s) =>
    s.theme === "dark"
      ? "vs-dark"
      : s.theme === "light"
        ? "light"
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "vs-dark"
          : "light",
  );

  const debouncedFind = useDebounce(find, 200);

  useEffect(() => {
    currentRef.current = current;
  }, [current]);

  function applyDecorations(infos: MatchInfo[], idx: number, highlight: boolean) {
    if (!editor) return;
    const coll = decorationsRef.current ?? editor.createDecorationsCollection();
    decorationsRef.current = coll;
    const decs: monaco.editor.IModelDeltaDecoration[] = [];
    infos.forEach((m, i) => {
      if (!highlight && i !== idx) return;
      decs.push({
        range: m.range,
        options: {
          className: i === idx ? "ww-find-current" : "ww-find-match",
          stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
        },
      });
    });
    coll.set(decs);
  }

  // 搜索：输入防抖 + 编辑器内容变化时自动重跑
  useEffect(() => {
    const model = editor?.getModel();
    if (!editor || !model || !debouncedFind) {
      decorationsRef.current?.clear();
      decorationsRef.current = null;
      setMatches([]);
      setCurrent(0);
      setFindError(null);
      return;
    }
    let ms: monaco.editor.FindMatch[];
    try {
      ms = model.findMatches(debouncedFind, true, isRegex, matchCase, null, true, 10000);
    } catch {
      setFindError("正则表达式无效");
      setMatches([]);
      setCurrent(0);
      return;
    }
    setFindError(null);
    const infos: MatchInfo[] = ms.map((m) => ({
      line: m.range.startLineNumber,
      col: m.range.startColumn,
      range: m.range,
      text: m.matches?.[0] ?? "",
      groups: m.matches?.slice(1) ?? [],
    }));
    setMatches(infos);
    const idx = Math.min(currentRef.current, Math.max(infos.length - 1, 0));
    setCurrent(idx);
    applyDecorations(infos, idx, highlightAll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedFind, isRegex, matchCase, highlightAll, editor, modelVersion]);

  function navigate(idx: number) {
    if (idx < 0 || idx >= matches.length || !editor) return;
    setCurrent(idx);
    currentRef.current = idx;
    applyDecorations(matches, idx, highlightAll);
    editor.revealRangeInCenter(matches[idx].range);
    editor.setPosition({ lineNumber: matches[idx].line, column: matches[idx].col });
    editor.focus();
  }

  function replaceOne() {
    if (!editor) return;
    const m = matches[currentRef.current];
    if (!m) {
      toast("没有匹配项可替换");
      return;
    }
    editor.executeEdits("ww-replace", [
      { range: m.range, text: computeReplacement(replace, isRegex, m.text, m.groups) },
    ]);
    setPreview(null);
  }

  function replaceAll() {
    if (!editor) return;
    if (matches.length === 0) {
      toast("没有匹配项可替换");
      return;
    }
    editor.executeEdits(
      "ww-replace-all",
      matches.map((m) => ({
        range: m.range,
        text: computeReplacement(replace, isRegex, m.text, m.groups),
      })),
    );
    setPreview(null);
    toast(`已替换 ${matches.length} 处`);
  }

  function showPreview() {
    if (!find) return;
    if (matches.length === 0) {
      toast("没有匹配项，无法预览");
      return;
    }
    const text = editor?.getModel()?.getValue() ?? "";
    setPreview({
      original: text,
      result: applyReplacements(text, find, replace, isRegex, matchCase),
      count: matches.length,
    });
    setPreviewOpen(true);
  }

  function applyPreview() {
    if (!preview) return;
    // 用编辑器操作应用结果，单/双模式均可 Ctrl+Z 撤销
    const model = editor?.getModel();
    if (editor && model) {
      editor.executeEdits("ww-preview", [
        { range: model.getFullModelRange(), text: preview.result },
      ]);
    }
    setPreview(null);
    setPreviewOpen(false);
    toast("已应用替换");
  }

  function applyRule(rule: ReplaceRule) {
    setFind(rule.find);
    setReplace(rule.replace);
    setIsRegex(rule.isRegex);
    setMatchCase(rule.matchCase);
    setMode("replace");
    toast(`已应用规则：${rule.name}`);
  }

  // ---------- 列表工具（分割 / 排序 / 对比） ----------
  const [listDelimiter, setListDelimiter] = useState<SplitDelimiter>("newline");
  const [listCustomRegex, setListCustomRegex] = useState("");
  const [listTrim, setListTrim] = useState(true);
  const [listIgnoreEmpty, setListIgnoreEmpty] = useState(true);
  const [listDedupe, setListDedupe] = useState(false);
  const [listResult, setListResult] = useState<string[] | null>(null);
  const [sortMode, setSortMode] = useState<"reference" | "alpha-asc" | "alpha-desc">("reference");
  // 参考列表 / 对比列表 持久化到 list store（暂存区导入入口直接写入）
  const referenceText = useListStore((s) => s.reference);
  const setReferenceText = useListStore((s) => s.setReference);
  const compareText = useListStore((s) => s.compare);
  const setCompareText = useListStore((s) => s.setCompare);
  const [sortResult, setSortResult] = useState<SortResult | null>(null);
  const [compareResult, setCompareResult] = useState<ListDiffResult | null>(null);

  /** 列表工具的数据源：编辑器选区优先，否则全文 */
  const listSource = () => {
    const model = editor?.getModel();
    const sel = editor?.getSelection();
    if (editor && model && sel && !sel.isEmpty()) return model.getValueInRange(sel);
    return model?.getValue() ?? "";
  };

  const runSplit = () => {
    const r = splitText(listSource(), {
      delimiter: listDelimiter,
      customRegex: listCustomRegex,
      trim: listTrim,
      ignoreEmpty: listIgnoreEmpty,
      dedupe: listDedupe,
    });
    if (r.error) {
      toast(r.error);
      return;
    }
    setListResult(r.items);
    setSortResult(null);
    setCompareResult(null);
  };

  const runSort = () => {
    const items = listResult;
    if (!items || items.length === 0) {
      toast("请先分割文本");
      return;
    }
    if (sortMode === "reference") {
      const ref = splitLines(referenceText);
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

  const runCompare = () => {
    const items = listResult ?? [];
    const other = splitLines(compareText);
    if (items.length === 0 && other.length === 0) {
      toast("请先分割文本，并输入对比列表");
      return;
    }
    setCompareResult(compareLists(items, other));
  };

  const copyLines = (lines: string[]) => {
    if (lines.length === 0) {
      toast("没有可复制的内容");
      return;
    }
    void navigator.clipboard.writeText(lines.join("\n"));
    toast(`已复制 ${lines.length} 条`);
  };

  /** 把处理结果应用到编辑器：有选区替换选区，否则替换全文（可撤销） */
  const applyLines = (lines: string[]) => {
    if (lines.length === 0) {
      toast("没有可应用的内容");
      return;
    }
    const text = lines.join("\n");
    const model = editor?.getModel();
    const sel = editor?.getSelection();
    if (editor && model && sel && !sel.isEmpty()) {
      editor.executeEdits("ww-list", [{ range: sel, text }]);
    } else if (editor && model) {
      editor.executeEdits("ww-list", [{ range: model.getFullModelRange(), text }]);
    }
    toast(`已应用 ${lines.length} 行`);
  };

  useImperativeHandle(ref, () => ({
    open: (m) => {
      setMode(m);
      setTimeout(() => findInputRef.current?.focus(), 60);
    },
  }));

  return (
    <div className="border-b border-border bg-muted/40 px-3 py-2">
      <div className="flex items-center gap-1.5">
        <div className="flex shrink-0 rounded-md border border-border bg-card p-0.5 text-xs">
          <button
            className={cn(
              "rounded px-2 py-1",
              mode === "find" ? "bg-accent font-medium" : "text-muted-foreground",
            )}
            onClick={() => setMode("find")}
          >
            查找
          </button>
          <button
            className={cn(
              "rounded px-2 py-1",
              mode === "replace" ? "bg-accent font-medium" : "text-muted-foreground",
            )}
            onClick={() => setMode("replace")}
          >
            替换
          </button>
          <button
            className={cn(
              "rounded px-2 py-1",
              mode === "list" ? "bg-accent font-medium" : "text-muted-foreground",
            )}
            onClick={() => setMode("list")}
          >
            列表
          </button>
        </div>
        <Input
          ref={findInputRef}
          value={find}
          onChange={(e) => setFind(e.target.value)}
          placeholder="查找内容（支持正则）"
          className="h-7 flex-1 min-w-0 text-xs"
        />
        <Badge
          variant={findError ? "destructive" : "secondary"}
          title="匹配数（当前 / 总数）"
          className="min-w-11 shrink-0 justify-center font-mono"
        >
          {findError
            ? "无效"
            : matches.length > 0
              ? `${current + 1}/${matches.length}`
              : find
                ? "0"
                : "—"}
        </Badge>
        <Toggle active={isRegex} title="正则表达式" onClick={() => setIsRegex(!isRegex)}>
          <Regex />
        </Toggle>
        <Toggle active={matchCase} title="区分大小写" onClick={() => setMatchCase(!matchCase)}>
          <CaseSensitive />
        </Toggle>
        <Toggle
          active={highlightAll}
          title="全部高亮"
          onClick={() => setHighlightAll(!highlightAll)}
        >
          <Highlighter />
        </Toggle>
        <Button
          variant="ghost"
          size="icon-sm"
          title="上一个"
          disabled={matches.length === 0}
          onClick={() => navigate(current - 1)}
        >
          <ArrowUp />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          title="下一个"
          disabled={matches.length === 0}
          onClick={() => navigate(current + 1)}
        >
          <ArrowDown />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          title="位置列表"
          className={cn(showPositions && "bg-accent text-accent-foreground")}
          onClick={() => setShowPositions(!showPositions)}
        >
          <List />
        </Button>
        <span className="mx-0.5 h-4 w-px shrink-0 bg-border" />
        <Button
          variant="ghost"
          size="icon-sm"
          title="撤销 (Ctrl+Z)"
          onClick={() => editor?.trigger("toolbar", "undo", null)}
        >
          <Undo2 />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          title="重做"
          onClick={() => editor?.trigger("toolbar", "redo", null)}
        >
          <Redo2 />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          title="清空内容"
          className="text-destructive hover:text-destructive"
          onClick={() => setConfirmClear(true)}
        >
          <Trash2 />
        </Button>
      </div>

      {/* 列表工具：分割 / 排序 / 对比（源 = 编辑器选区优先，否则全文） */}
      {mode === "list" && (
        <div className="mt-1.5 max-h-56 space-y-2 overflow-y-auto pr-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="shrink-0 text-xs text-muted-foreground">分隔符</span>
            <select
              value={listDelimiter}
              onChange={(e) => setListDelimiter(e.target.value as SplitDelimiter)}
              className="h-7 rounded-md border border-border bg-card px-1.5 text-xs outline-none"
            >
              <option value="newline">换行</option>
              <option value="comma">英文逗号</option>
              <option value="cn-comma">中文逗号</option>
              <option value="space">空格 / Tab</option>
              <option value="custom">自定义正则</option>
            </select>
            {listDelimiter === "custom" && (
              <Input
                value={listCustomRegex}
                onChange={(e) => setListCustomRegex(e.target.value)}
                placeholder="如 [，,、]"
                className="h-7 w-28 font-mono text-xs"
              />
            )}
            <Toggle active={listTrim} onClick={() => setListTrim(!listTrim)}>
              去空格
            </Toggle>
            <Toggle active={listIgnoreEmpty} onClick={() => setListIgnoreEmpty(!listIgnoreEmpty)}>
              忽略空项
            </Toggle>
            <Toggle active={listDedupe} onClick={() => setListDedupe(!listDedupe)}>
              去重
            </Toggle>
            <Button size="sm" className="h-7 text-xs" onClick={runSplit}>
              分割
            </Button>
          </div>

          {listResult && (
            <div className="rounded-md border border-border bg-card p-1.5">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-medium">分割结果 · {listResult.length} 项</span>
                <span className="text-[10px] text-muted-foreground">（源：选区优先）</span>
                <div className="flex-1" />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => copyLines(listResult)}
                >
                  复制
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => applyLines(listResult)}
                >
                  应用到编辑器
                </Button>
              </div>
              <ol className="mt-1 max-h-24 overflow-y-auto pl-4 text-xs">
                {listResult.slice(0, 200).map((item, i) => (
                  <li key={`${i}-${item}`} className="break-all py-0.5 font-mono">
                    {item}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {listResult && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="shrink-0 text-xs text-muted-foreground">排序</span>
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as typeof sortMode)}
                className="h-7 rounded-md border border-border bg-card px-1.5 text-xs outline-none"
              >
                <option value="reference">按参考列表</option>
                <option value="alpha-asc">字母升序</option>
                <option value="alpha-desc">字母降序</option>
              </select>
              {sortMode === "reference" && (
                <Input
                  value={referenceText}
                  onChange={(e) => setReferenceText(e.target.value)}
                  placeholder="参考列表，每行一条"
                  className="h-7 w-48 min-w-0 font-mono text-xs"
                />
              )}
              <Button size="sm" className="h-7 text-xs" onClick={runSort}>
                排序
              </Button>
            </div>
          )}

          {sortResult && (
            <div className="rounded-md border border-border bg-card p-1.5">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-medium">排序结果 · {sortResult.sorted.length} 项</span>
                <div className="flex-1" />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => copyLines(sortResult.sorted)}
                >
                  复制
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => applyLines(sortResult.sorted)}
                >
                  应用到编辑器
                </Button>
              </div>
              <ol className="mt-1 max-h-24 overflow-y-auto pl-4 text-xs">
                {sortResult.sorted.slice(0, 200).map((item, i) => (
                  <li key={`s-${i}-${item}`} className="break-all py-0.5 font-mono">
                    {item}
                  </li>
                ))}
              </ol>
              {sortResult.unmatched.length > 0 && (
                <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
                  未匹配（不在参考列表）：
                  {sortResult.unmatched.slice(0, 10).join("、")}
                  {sortResult.unmatched.length > 10
                    ? ` 等 ${sortResult.unmatched.length} 项`
                    : `，共 ${sortResult.unmatched.length} 项`}
                </p>
              )}
            </div>
          )}

          {listResult && (
            <div className="flex items-center gap-1.5">
              <span className="shrink-0 text-xs text-muted-foreground">对比</span>
              <Input
                value={compareText}
                onChange={(e) => setCompareText(e.target.value)}
                placeholder="另一个列表，每行一条"
                className="h-7 min-w-0 flex-1 font-mono text-xs"
              />
              <Button size="sm" className="h-7 text-xs" onClick={runCompare}>
                对比
              </Button>
            </div>
          )}

          {compareResult && (
            <div className="grid grid-cols-3 gap-1.5 text-[11px]">
              <div className="rounded-md border border-border bg-card p-1.5">
                <p className="mb-1 font-medium text-sky-600 dark:text-sky-400">
                  仅左侧 {compareResult.onlyA.length}
                </p>
                <p className="max-h-16 overflow-y-auto break-all font-mono text-muted-foreground">
                  {compareResult.onlyA.slice(0, 30).join("、") || "—"}
                </p>
              </div>
              <div className="rounded-md border border-border bg-card p-1.5">
                <p className="mb-1 font-medium text-emerald-600 dark:text-emerald-400">
                  共同 {compareResult.both.length}
                </p>
                <p className="max-h-16 overflow-y-auto break-all font-mono text-muted-foreground">
                  {compareResult.both.slice(0, 30).join("、") || "—"}
                </p>
              </div>
              <div className="rounded-md border border-border bg-card p-1.5">
                <p className="mb-1 font-medium text-rose-600 dark:text-rose-400">
                  仅右侧 {compareResult.onlyB.length}
                </p>
                <p className="max-h-16 overflow-y-auto break-all font-mono text-muted-foreground">
                  {compareResult.onlyB.slice(0, 30).join("、") || "—"}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {mode === "replace" && (
        <div className="mt-1.5 flex items-center gap-1.5">
          <span className="w-8 shrink-0 text-xs text-muted-foreground">替换为</span>
          <Input
            value={replace}
            onChange={(e) => setReplace(e.target.value)}
            placeholder="替换内容（正则模式支持 $1、$&）"
            className="h-7 min-w-0 flex-1 text-xs"
          />
          <Button
            size="sm"
            variant="secondary"
            className="h-7 shrink-0 text-xs"
            onClick={replaceOne}
          >
            替换
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="h-7 shrink-0 text-xs"
            onClick={replaceAll}
          >
            全部替换
          </Button>
          <Button size="sm" className="h-7 shrink-0 text-xs" onClick={showPreview}>
            <Eye className="size-3.5" />
            预览
          </Button>
        </div>
      )}

      {/* 规则管理入口：常驻显示，可把当前查找/替换一键带入对话框保存为新规则 */}
      <div className="mt-1.5 flex items-center gap-1.5">
        <span className="shrink-0 text-xs text-muted-foreground">规则</span>
        {rules.length === 0 ? (
          <span className="min-w-0 flex-1 text-[11px] text-muted-foreground/60">
            暂无规则，点击右侧「管理规则」添加；或先输入查找/替换内容再点开，可直接保存为新规则
          </span>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
            {rules.map((r) => (
              <button
                key={r.id}
                title={`${r.find} → ${r.replace}`}
                onClick={() => applyRule(r)}
                className="shrink-0 rounded-full border border-border bg-card px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                {r.name}
              </button>
            ))}
          </div>
        )}
        <Button
          variant="outline"
          size="sm"
          className="h-6 shrink-0 px-2 text-xs"
          onClick={() => {
            setRuleDraft(find.trim() ? { find, replace, isRegex, matchCase } : null);
            setRulesOpen(true);
          }}
        >
          <Settings2 className="size-3" />
          管理规则
        </Button>
      </div>

      {findError && <p className="mt-1 text-xs text-destructive">正则表达式无效，请检查语法</p>}

      {showPositions && (
        <div className="mt-1.5 max-h-32 overflow-y-auto rounded-md border border-border bg-card">
          {matches.length === 0 ? (
            <p className="px-2 py-1 text-xs text-muted-foreground">没有匹配项</p>
          ) : (
            matches.slice(0, 500).map((m, i) => (
              <button
                key={`${m.line}-${m.col}-${i}`}
                onClick={() => navigate(i)}
                className={cn(
                  "flex w-full items-center gap-2 px-2 py-0.5 text-left text-xs hover:bg-accent",
                  i === current && "bg-accent/60",
                )}
              >
                <span className="w-6 shrink-0 text-muted-foreground">{i + 1}</span>
                <span className="shrink-0 font-mono">
                  第 {m.line} 行 · 第 {m.col} 列
                </span>
                <span className="ml-auto max-w-40 truncate text-muted-foreground">{m.text}</span>
              </button>
            ))
          )}
        </div>
      )}

      {previewOpen && preview && (
        <div className="mt-2 rounded-md border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-2 py-1">
            <span className="text-xs font-medium">替换预览 · 共 {preview.count} 处</span>
            <div className="flex items-center gap-1">
              <Button size="sm" className="h-6 px-2 text-xs" onClick={applyPreview}>
                <Check className="size-3.5" />
                应用替换
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs"
                onClick={() => setPreviewOpen(false)}
              >
                <X className="size-3.5" />
                关闭
              </Button>
            </div>
          </div>
          <DiffEditor
            original={preview.original}
            modified={preview.result}
            theme={monacoTheme}
            language="plaintext"
            height="200"
            options={{
              readOnly: true,
              renderSideBySide: true,
              minimap: { enabled: false },
              fontSize: 12,
              automaticLayout: true,
              scrollBeyondLastLine: false,
              wordWrap: "on",
            }}
          />
        </div>
      )}

      <ConfirmDialog
        open={confirmClear}
        title="清空当前工作区"
        description="确定要清空当前工作区的全部内容吗？此操作不可撤销。"
        confirmText="清空"
        destructive
        onConfirm={() => {
          const wsState = useWorkspaceStore.getState();
          if (wsState.activeId) wsState.setContent(wsState.activeId, "");
          setConfirmClear(false);
          toast("已清空");
        }}
        onCancel={() => setConfirmClear(false)}
      />

      <RulesDialog
        key={
          rulesOpen
            ? ruleDraft
              ? `${ruleDraft.find}|${ruleDraft.replace}|${ruleDraft.isRegex}|${ruleDraft.matchCase}`
              : "plain"
            : "closed"
        }
        open={rulesOpen}
        onOpenChange={setRulesOpen}
        initialDraft={ruleDraft}
      />
    </div>
  );
});
