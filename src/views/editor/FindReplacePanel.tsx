import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import * as monaco from "monaco-editor";
import {
  ArrowDown,
  ArrowUp,
  CaseSensitive,
  Eye,
  Highlighter,
  Regex,
  Settings2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toggle } from "@/components/ui/toggle";
import { RulesDialog } from "@/components/shared/RulesDialog";
import { applyReplacements, computeReplacement } from "@/lib/replace";
import { useDebounce } from "@/hooks/useDebounce";
import { useRulesStore } from "@/stores/rules";
import { useToastStore } from "@/stores/toast";
import type { ReplaceRule } from "@/types";

interface MatchInfo {
  line: number;
  col: number;
  range: monaco.IRange;
  text: string;
  groups: string[];
}

export interface FindReplaceHandle {
  open: () => void;
}

interface Props {
  /** 当前聚焦的编辑器（查找/替换/预览的源） */
  focusedEditor: monaco.editor.IStandaloneCodeEditor | null;
  /** 另一侧编辑器（替换预览的结果目标） */
  otherEditor: monaco.editor.IStandaloneCodeEditor | null;
}

export const FindReplacePanel = forwardRef<FindReplaceHandle, Props>(function FindReplacePanel(
  { focusedEditor, otherEditor },
  ref,
) {
  const editor = focusedEditor; // 查找/替换作用于当前聚焦的编辑器

  const [find, setFind] = useState("");
  const [replace, setReplace] = useState("");
  const [isRegex, setIsRegex] = useState(false);
  const [matchCase, setMatchCase] = useState(false);
  const [highlightAll, setHighlightAll] = useState(true);
  const [matches, setMatches] = useState<MatchInfo[]>([]);
  const [current, setCurrent] = useState(0);
  const [findError, setFindError] = useState<string | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [ruleDraft, setRuleDraft] = useState<{
    find: string;
    replace: string;
    isRegex: boolean;
    matchCase: boolean;
  } | null>(null);

  const findInputRef = useRef<HTMLInputElement>(null);
  const decorationsRef = useRef<monaco.editor.IEditorDecorationsCollection | null>(null);
  const currentRef = useRef(0);

  const rules = useRulesStore((s) => s.rules);
  const toast = useToastStore((s) => s.push);

  // 监听目标编辑器内容版本：内容变化时自动重跑搜索
  const [modelVersion, setModelVersion] = useState(0);
  useEffect(() => {
    if (!editor) return;
    const model = editor.getModel();
    if (!model) return;
    const sub = model.onDidChangeContent(() => setModelVersion((v) => v + 1));
    return () => sub.dispose();
  }, [editor]);

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
    toast(`已替换 ${matches.length} 处`);
  }

  /** 替换预览：把替换后的全文写入另一侧编辑器（双编辑器即对比） */
  function showPreview() {
    if (!find) return;
    if (matches.length === 0) {
      toast("没有匹配项，无法预览");
      return;
    }
    const text = editor?.getModel()?.getValue() ?? "";
    const result = applyReplacements(text, find, replace, isRegex, matchCase);
    const model = otherEditor?.getModel();
    if (!otherEditor || !model) {
      toast("另一侧编辑器尚未就绪");
      return;
    }
    otherEditor.executeEdits("ww-preview", [{ range: model.getFullModelRange(), text: result }]);
    toast("替换预览已写入另一侧编辑器");
  }

  function applyRule(rule: ReplaceRule) {
    setFind(rule.find);
    setReplace(rule.replace);
    setIsRegex(rule.isRegex);
    setMatchCase(rule.matchCase);
    toast(`已应用规则：${rule.name}`);
  }

  useImperativeHandle(ref, () => ({
    open: () => setTimeout(() => findInputRef.current?.focus(), 60),
  }));

  return (
    <div className="space-y-1 rounded-md border border-border bg-background p-1.5">
      {/* 第一行：查找 + 替换（同在一行，紧凑布局） */}
      <div className="flex items-center gap-1.5">
        <Input
          ref={findInputRef}
          value={find}
          onChange={(e) => setFind(e.target.value)}
          placeholder="查找内容（支持正则）"
          className="h-6.5 min-w-0 flex-1 text-xs"
        />
        <Badge
          variant={findError ? "destructive" : "secondary"}
          title="匹配数（当前 / 总数）"
          className="min-w-9 shrink-0 justify-center px-1 font-mono text-[10px]"
        >
          {findError
            ? "无效"
            : matches.length > 0
              ? `${current + 1}/${matches.length}`
              : find
                ? "0"
                : "—"}
        </Badge>
        <Toggle
          active={isRegex}
          title="正则表达式"
          onClick={() => setIsRegex(!isRegex)}
          className="h-6.5 px-1.5 text-[10px]"
        >
          <Regex />
        </Toggle>
        <Toggle
          active={matchCase}
          title="区分大小写"
          onClick={() => setMatchCase(!matchCase)}
          className="h-6.5 px-1.5 text-[10px]"
        >
          <CaseSensitive />
        </Toggle>
        <Toggle
          active={highlightAll}
          title="全部高亮"
          onClick={() => setHighlightAll(!highlightAll)}
          className="h-6.5 px-1.5 text-[10px]"
        >
          <Highlighter />
        </Toggle>
        <Button
          variant="ghost"
          size="icon-sm"
          className="h-6.5 w-6.5"
          title="上一个"
          disabled={matches.length === 0}
          onClick={() => navigate(current - 1)}
        >
          <ArrowUp />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="h-6.5 w-6.5"
          title="下一个"
          disabled={matches.length === 0}
          onClick={() => navigate(current + 1)}
        >
          <ArrowDown />
        </Button>
        <span className="mx-0.5 h-4 w-px shrink-0 bg-border" />
        <Input
          value={replace}
          onChange={(e) => setReplace(e.target.value)}
          placeholder="替换为"
          className="h-6.5 min-w-0 flex-1 text-xs"
        />
        <Button
          size="sm"
          variant="secondary"
          className="h-6.5 shrink-0 px-2 text-[11px]"
          onClick={replaceOne}
        >
          替换
        </Button>
        <Button
          size="sm"
          variant="secondary"
          className="h-6.5 shrink-0 px-2 text-[11px]"
          onClick={replaceAll}
        >
          全部替换
        </Button>
        <Button size="sm" className="h-6.5 shrink-0 px-2 text-[11px]" onClick={showPreview}>
          <Eye className="size-3" />
          预览
        </Button>
      </div>

      {findError && <p className="text-xs text-destructive">正则表达式无效，请检查语法</p>}

      {/* 第二行：规则 */}
      <div className="flex items-center gap-1.5">
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
