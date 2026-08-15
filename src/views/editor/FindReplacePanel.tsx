import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import * as monaco from "monaco-editor";
import {
  ArrowDown,
  ArrowUp,
  CaseSensitive,
  Highlighter,
  ListOrdered,
  Regex,
  ReplaceAll,
  Scissors,
  Settings2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toggle } from "@/components/ui/toggle";
import { RulesDialog } from "@/components/shared/RulesDialog";
import { TemplatesDialog } from "@/components/shared/TemplatesDialog";
import { setRuleApplyListener } from "@/lib/editorBridge";
import { computeReplacement } from "@/lib/replace";
import { sortAlphabetical, sortByReference } from "@/lib/sort";
import { splitLines, splitText, type SplitDelimiter } from "@/lib/split";
import { useDebounce } from "@/hooks/useDebounce";
import { useRulesStore } from "@/stores/rules";
import { useTemplatesStore } from "@/stores/templates";
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

  function applyRule(rule: ReplaceRule) {
    setFind(rule.find);
    setReplace(rule.replace);
    setIsRegex(rule.isRegex);
    setMatchCase(rule.matchCase);
    toast(`已应用规则：${rule.name}`);
  }

  // ---------- 列表工具（分割：聚焦 → 另一侧；排序规则：作用于另一侧） ----------
  const [delimiter, setDelimiter] = useState<SplitDelimiter>("auto");
  const [customRegex, setCustomRegex] = useState("");
  const templates = useTemplatesStore((s) => s.templates);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  // 规则下拉框（受控，选中后应用并复位）
  const [ruleSelect, setRuleSelect] = useState("");
  const [templateSelect, setTemplateSelect] = useState("");

  /** 把文本写入目标编辑器（整体替换，可撤销） */
  const writeToEditor = (dst: monaco.editor.IStandaloneCodeEditor | null, text: string) => {
    const model = dst?.getModel();
    if (!dst || !model) return false;
    dst.executeEdits("ww-list", [{ range: model.getFullModelRange(), text }]);
    return true;
  };

  /** 分割：作用于当前聚焦编辑器（选区优先），结果自动写入另一侧 */
  const runSplit = () => {
    const model = focusedEditor?.getModel();
    if (!focusedEditor || !model) {
      toast("请先点击要分割的编辑器（高亮边框者）");
      return;
    }
    const sel = focusedEditor.getSelection();
    const input = sel && !sel.isEmpty() ? model.getValueInRange(sel) : model.getValue();
    const r = splitText(input, {
      delimiter,
      customRegex,
      trim: true,
      ignoreEmpty: true,
      dedupe: false,
    });
    if (r.error) {
      toast(r.error);
      return;
    }
    if (!writeToEditor(otherEditor, r.items.join("\n"))) {
      toast("另一侧编辑器尚未就绪");
      return;
    }
    toast(`已分割 ${r.items.length} 项并写入另一侧编辑器`);
  };

  /** 排序：作用于当前聚焦编辑器（选区优先）。
   *  选了排序模板 → 按模板排；未选 → 升序，再点一次切降序，循环切换 */
  const runSort = () => {
    const model = focusedEditor?.getModel();
    if (!focusedEditor || !model) {
      toast("请先点击要排序的编辑器（高亮边框者）");
      return;
    }
    const sel = focusedEditor.getSelection();
    const input = sel && !sel.isEmpty() ? model.getValueInRange(sel) : model.getValue();
    const items = splitLines(input);
    if (items.length === 0) {
      toast("该编辑器没有可排序的内容");
      return;
    }

    const t = templates.find((x) => x.id === templateSelect);
    if (t) {
      const r = sortByReference(items, t.items);
      applyToFocused(sel, model, r.sorted.join("\n"));
      toast(
        `已按「${t.name}」排序 ${r.sorted.length} 项` +
          (r.unmatched.length > 0 ? `，${r.unmatched.length} 项未匹配` : ""),
      );
      return;
    }

    // 未选规则：升序 ↔ 降序循环（内容已是升序结果则下一次降序，反之亦然）
    const ascText = sortAlphabetical(items, "asc").join("\n");
    const descText = sortAlphabetical(items, "desc").join("\n");
    let next: string;
    let order: "升序" | "降序";
    if (input === ascText) {
      next = descText;
      order = "降序";
    } else if (input === descText) {
      next = ascText;
      order = "升序";
    } else {
      next = ascText;
      order = "升序";
    }
    applyToFocused(sel, model, next);
    toast(`已按${order}排序 ${items.length} 项`);
  };

  /** 把结果写入聚焦编辑器：有选区替换选区，否则替换全文（可撤销） */
  const applyToFocused = (
    sel: monaco.Selection | null,
    model: monaco.editor.ITextModel,
    text: string,
  ) => {
    if (sel && !sel.isEmpty()) {
      focusedEditor?.executeEdits("ww-sort", [{ range: sel, text }]);
    } else {
      focusedEditor?.executeEdits("ww-sort", [{ range: model.getFullModelRange(), text }]);
    }
  };

  // 接收来自暂存区等入口的规则应用请求，把规则填入查找/替换输入框
  useEffect(() => {
    setRuleApplyListener((rule) => {
      setFind(rule.find);
      setReplace(rule.replace);
      setIsRegex(rule.isRegex);
      setMatchCase(rule.matchCase);
      toast(`已应用规则：${rule.name}`);
    });
    return () => setRuleApplyListener(null);
  }, [toast]);

  useImperativeHandle(ref, () => ({
    open: () => setTimeout(() => findInputRef.current?.focus(), 60),
  }));

  return (
    <div className="bg-background p-0">
      {/* 单行四功能：查找 → 替换 → 分割 → 排序（窄屏自动换行） */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Input
          ref={findInputRef}
          value={find}
          onChange={(e) => setFind(e.target.value)}
          placeholder="查找"
          className="h-6.5 min-w-28 flex-1 basis-40 text-xs"
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
          className="h-6.5 min-w-24 flex-1 basis-32 text-xs"
        />
        <select
          value={ruleSelect}
          onChange={(e) => {
            const rule = rules.find((r) => r.id === e.target.value);
            if (rule) applyRule(rule);
            setRuleSelect("");
          }}
          title="替换规则"
          className="h-6.5 max-w-28 rounded-md border border-border bg-card px-1.5 text-xs outline-none"
        >
          <option value="">替换规则</option>
          {rules.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <Button
          size="sm"
          variant="secondary"
          className="h-6.5 shrink-0 px-2 text-[11px]"
          onClick={replaceOne}
        >
          替换
        </Button>
        <Button size="sm" className="h-6.5 shrink-0 px-2 text-[11px]" onClick={replaceAll}>
          <ReplaceAll className="size-3" />
          全部替换
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="h-6.5 w-6.5"
          title="管理替换规则"
          onClick={() => {
            setRuleDraft(find.trim() ? { find, replace, isRegex, matchCase } : null);
            setRulesOpen(true);
          }}
        >
          <Settings2 />
        </Button>

        <span className="mx-0.5 h-4 w-px shrink-0 bg-border" />

        <select
          value={delimiter}
          onChange={(e) => setDelimiter(e.target.value as SplitDelimiter)}
          title="分割分隔符"
          className="h-6.5 rounded-md border border-border bg-card px-1.5 text-xs outline-none"
        >
          <option value="auto">自动检测</option>
          <option value="newline">换行</option>
          <option value="comma">英文逗号</option>
          <option value="cn-comma">中文逗号</option>
          <option value="semicolon">英文分号</option>
          <option value="cn-semicolon">中文分号</option>
          <option value="cn-dunhao">顿号</option>
          <option value="space">空格 / Tab</option>
          <option value="custom">自定义正则</option>
        </select>
        {delimiter === "custom" && (
          <Input
            value={customRegex}
            onChange={(e) => setCustomRegex(e.target.value)}
            placeholder="分隔正则"
            className="h-6.5 w-28 font-mono text-xs"
          />
        )}
        <Button size="sm" className="h-6.5 shrink-0 px-2 text-[11px]" onClick={runSplit}>
          <Scissors className="size-3" />
          分割
        </Button>

        <span className="mx-0.5 h-4 w-px shrink-0 bg-border" />

        <select
          value={templateSelect}
          onChange={(e) => setTemplateSelect(e.target.value)}
          title="排序规则"
          className="h-6.5 max-w-28 rounded-md border border-border bg-card px-1.5 text-xs outline-none"
        >
          <option value="">排序规则</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <Button size="sm" className="h-6.5 shrink-0 px-2 text-[11px]" onClick={runSort}>
          <ListOrdered className="size-3" />
          排序
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="h-6.5 w-6.5"
          title="管理排序规则"
          onClick={() => setTemplatesOpen(true)}
        >
          <Settings2 />
        </Button>
      </div>

      {findError && <p className="mt-1 text-xs text-destructive">正则表达式无效，请检查语法</p>}

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

      <TemplatesDialog open={templatesOpen} onOpenChange={setTemplatesOpen} />
    </div>
  );
});
