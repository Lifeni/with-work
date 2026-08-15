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
  Regex,
  Settings2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toggle } from "@/components/ui/toggle";
import { RulesDialog } from "@/components/shared/RulesDialog";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/hooks/useDebounce";
import { useRulesStore } from "@/stores/rules";
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
  open: (mode: "find" | "replace") => void;
}

interface Props {
  editor: monaco.editor.IStandaloneCodeEditor | null;
  initialMode?: "find" | "replace";
}

/** 计算单处替换的替换文本（支持 $1、$&、$$） */
function computeReplacement(
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

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** 在字符串层面应用全部替换（用于预览） */
function applyReplacements(
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

export const FindReplacePanel = forwardRef<FindReplaceHandle, Props>(function FindReplacePanel(
  { editor, initialMode = "find" },
  ref,
) {
  const [mode, setMode] = useState<"find" | "replace">(initialMode);
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

  const findInputRef = useRef<HTMLInputElement>(null);
  const decorationsRef = useRef<monaco.editor.IEditorDecorationsCollection | null>(null);
  const currentRef = useRef(0);

  const content = useWorkspaceStore(
    (s) => s.workspaces.find((w) => w.id === s.activeId)?.content ?? "",
  );
  const rules = useRulesStore((s) => s.rules);
  const toast = useToastStore((s) => s.push);
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
  }, [debouncedFind, isRegex, matchCase, highlightAll, editor, content]);

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
    setPreview({
      original: content,
      result: applyReplacements(content, find, replace, isRegex, matchCase),
      count: matches.length,
    });
    setPreviewOpen(true);
  }

  function applyPreview() {
    if (!preview) return;
    const ws = useWorkspaceStore.getState();
    if (ws.activeId) ws.setContent(ws.activeId, preview.result);
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
      </div>

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

      <RulesDialog open={rulesOpen} onOpenChange={setRulesOpen} initialDraft={ruleDraft} />
    </div>
  );
});
