import { useState } from "react";
import * as monaco from "monaco-editor";
import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TemplatesDialog } from "@/components/shared/TemplatesDialog";
import { sortByReference } from "@/lib/sort";
import { splitLines, splitText, type SplitDelimiter } from "@/lib/split";
import { useTemplatesStore } from "@/stores/templates";
import { useToastStore } from "@/stores/toast";
import type { SortTemplate } from "@/types";

interface Props {
  /** 当前聚焦的编辑器（分割的源） */
  focusedEditor: monaco.editor.IStandaloneCodeEditor | null;
  /** 另一侧编辑器（分割/排序的结果目标） */
  otherEditor: monaco.editor.IStandaloneCodeEditor | null;
}

/** 独立列表面板：分割（聚焦 → 另一侧）+ 排序规则 */
export function ListPanel({ focusedEditor, otherEditor }: Props) {
  const toast = useToastStore((s) => s.push);
  const templates = useTemplatesStore((s) => s.templates);
  const [delimiter, setDelimiter] = useState<SplitDelimiter>("auto");
  const [customRegex, setCustomRegex] = useState("");
  const [templatesOpen, setTemplatesOpen] = useState(false);

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

  /** 排序规则：对另一侧编辑器内容按行排序并写回 */
  const applyTemplate = (t: SortTemplate) => {
    const model = otherEditor?.getModel();
    if (!otherEditor || !model) {
      toast("请先分割文本到另一侧编辑器");
      return;
    }
    const items = splitLines(model.getValue());
    if (items.length === 0) {
      toast("另一侧编辑器没有可排序的内容");
      return;
    }
    const r = sortByReference(items, t.items);
    writeToEditor(otherEditor, r.sorted.join("\n"));
    toast(
      `已按「${t.name}」排序 ${r.sorted.length} 项` +
        (r.unmatched.length > 0 ? `，${r.unmatched.length} 项未匹配` : ""),
    );
  };

  return (
    <div className="w-72 shrink-0 space-y-1 rounded-md border border-border bg-background p-1.5">
      {/* 第一行：分隔符 + 分割 */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="shrink-0 text-xs text-muted-foreground">分隔符</span>
        <select
          value={delimiter}
          onChange={(e) => setDelimiter(e.target.value as SplitDelimiter)}
          className="h-6.5 min-w-0 flex-1 rounded-md border border-border bg-card px-1.5 text-xs outline-none"
        >
          <option value="auto">自动检测（出现最多的符号）</option>
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
            placeholder="如 [，,、]"
            className="h-6.5 w-full font-mono text-xs"
          />
        )}
        <Button size="sm" className="h-6.5 px-2 text-[11px]" onClick={runSplit}>
          分割
        </Button>
      </div>

      {/* 第二行：排序规则 */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="shrink-0 text-xs text-muted-foreground">排序规则</span>
        {templates.length === 0 ? (
          <span className="min-w-0 flex-1 text-[11px] text-muted-foreground/60">
            暂无规则，点击「管理规则」创建
          </span>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
            {templates.map((t) => (
              <button
                key={t.id}
                title={t.items.join("、")}
                onClick={() => applyTemplate(t)}
                className="shrink-0 rounded-full border border-border bg-card px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                {t.name}
              </button>
            ))}
          </div>
        )}
        <Button
          variant="outline"
          size="sm"
          className="h-6 shrink-0 px-2 text-xs"
          onClick={() => setTemplatesOpen(true)}
        >
          <Settings2 className="size-3" />
          管理规则
        </Button>
      </div>

      <TemplatesDialog open={templatesOpen} onOpenChange={setTemplatesOpen} />
    </div>
  );
}
