import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Editor, { DiffEditor } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import {
  ArrowLeftRight,
  ArrowUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ClipboardPaste,
  Copy,
  FileDiff,
  FileText,
  Inbox,
  ListOrdered,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FindReplacePanel, type FindReplaceHandle } from "@/views/editor/FindReplacePanel";
import { detectLanguage } from "@/lib/detect";
import { setActiveEditor } from "@/lib/editorBridge";
import { applyReplacements } from "@/lib/replace";
import { splitLines } from "@/lib/split";
import { cn, uid } from "@/lib/utils";
import { cleanupWorkspaceModels, getWorkspaceModels } from "@/lib/workspaceModels";
import { useRulesStore } from "@/stores/rules";
import { useSettingsStore } from "@/stores/settings";
import { useStagingStore } from "@/stores/staging";
import { useStatusStore } from "@/stores/status";
import { useTemplatesStore } from "@/stores/templates";
import { useTextTemplatesStore } from "@/stores/textTemplates";
import { useToastStore } from "@/stores/toast";
import { useWorkspaceStore } from "@/stores/workspace";

type Side = "left" | "right";

export default function EditorView() {
  const ws = useWorkspaceStore((s) => s.workspaces.find((w) => w.id === s.activeId));
  const setLeft = useWorkspaceStore((s) => s.setLeft);
  const setRight = useWorkspaceStore((s) => s.setRight);
  const swapSides = useWorkspaceStore((s) => s.swapSides);
  const settings = useSettingsStore();
  const setCursor = useStatusStore((s) => s.setCursor);
  const toast = useToastStore((s) => s.push);
  const workspaceCount = useWorkspaceStore((s) => s.workspaces.length);

  const [leftEditor, setLeftEditor] = useState<monaco.editor.IStandaloneCodeEditor | null>(null);
  const [rightEditor, setRightEditor] = useState<monaco.editor.IStandaloneCodeEditor | null>(null);
  const [focused, setFocused] = useState<Side>("left");
  // 对比弹窗：手动打开，不影响两个编辑器的位置与状态
  const [diffOpen, setDiffOpen] = useState(false);
  const panelRef = useRef<FindReplaceHandle>(null);
  const editorAreaRef = useRef<HTMLDivElement>(null);

  const theme =
    settings.theme === "dark"
      ? "vs-dark"
      : settings.theme === "light"
        ? "light"
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "vs-dark"
          : "light";

  const editorOptions: monaco.editor.IStandaloneEditorConstructionOptions = {
    minimap: { enabled: true, scale: 1 },
    fontSize: settings.fontSize,
    fontFamily: settings.editorFontFamily,
    wordWrap: settings.wordWrap ? "on" : "off",
    automaticLayout: true,
    scrollBeyondLastLine: false,
    renderLineHighlight: "all",
    tabSize: 4,
    padding: { top: 10, bottom: 10 },
    scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
    smoothScrolling: true,
    cursorBlinking: "smooth",
    fixedOverflowWidgets: true,
    // 关闭 Monaco 原生拖拽与拖入功能：拖入文本会走 snippet/paste 解析（$0 被展开/变形），
    // 全部拖放由包裹层的 React 捕获事件接管
    dragAndDrop: false,
    dropIntoEditor: { enabled: false },
  };

  const mountEditor = (ed: monaco.editor.IStandaloneCodeEditor, side: Side) => {
    if (side === "left") setLeftEditor(ed);
    else setRightEditor(ed);
    setActiveEditor(ed);
    // 挂载时绑定当前工作区的 Model（每个工作区独立撤销历史）
    if (activeWsId) {
      const pair = getWorkspaceModels(activeWsId);
      if (pair) ed.setModel(side === "left" ? pair.left : pair.right);
    }
    ed.onDidFocusEditorText(() => {
      setFocused(side);
      setActiveEditor(ed);
    });
    ed.onDidChangeCursorPosition((e) => setCursor(e.position.lineNumber, e.position.column));
    ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, () => panelRef.current?.open());
    ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyH, () => panelRef.current?.open());
  };

  // 卸载时注销全局编辑器引用（全局工具会回退到直接读写工作区内容）
  useEffect(() => () => setActiveEditor(null), []);

  const left = ws?.left ?? "";
  const right = ws?.right ?? "";
  const activeWsId = ws?.id;

  // 切换工作区：换绑该工作区的 Model（保留各自的撤销/重做历史），编辑器实例复用不重建；
  // useLayoutEffect 保证在绘制前完成，避免切换瞬间闪出旧内容
  useLayoutEffect(() => {
    if (!activeWsId) return;
    const pair = getWorkspaceModels(activeWsId);
    if (!pair) return;
    if (leftEditor) leftEditor.setModel(pair.left);
    if (rightEditor) rightEditor.setModel(pair.right);
  }, [activeWsId, leftEditor, rightEditor]);

  // store 内容变化（交换/复制到另一侧/备份导入等直接改 store 的操作）时同步到 Model，
  // 保证 Model 与 store 一致（否则切回工作区时会显示陈旧内容）；executeEdits 保留可撤销
  useLayoutEffect(() => {
    if (!activeWsId) return;
    const pair = getWorkspaceModels(activeWsId);
    if (!pair) return;
    if (leftEditor && pair.left.getValue() !== left) {
      leftEditor.executeEdits("ww-sync", [
        { range: pair.left.getFullModelRange(), text: left },
      ]);
    }
    if (rightEditor && pair.right.getValue() !== right) {
      rightEditor.executeEdits("ww-sync", [
        { range: pair.right.getFullModelRange(), text: right },
      ]);
    }
  }, [left, right, activeWsId, leftEditor, rightEditor]);

  // 无工作区时，@monaco-editor/react 已卸载并 dispose 编辑器实例。
  // 在渲染期间同步清空引用（React 官方 render-phase 调整模式）：若延后到 effect，
  // App 自动新建工作区后的 useLayoutEffect 会对已释放实例调用 setModel，
  // Monaco 内部访问已释放对象抛异常导致整页白屏
  if (!ws && (leftEditor !== null || rightEditor !== null)) {
    setLeftEditor(null);
    setRightEditor(null);
    setActiveEditor(null);
  }

  // 工作区被删除时清理对应 Model（防内存泄漏）
  useEffect(() => {
    const ids = new Set(useWorkspaceStore.getState().workspaces.map((w) => w.id));
    cleanupWorkspaceModels(ids);
  }, [workspaceCount]);

  if (!ws) return null;

  // 查找替换与列表工具的目标：当前聚焦的编辑器（边框高亮者）
  const focusedEditor = focused === "left" ? leftEditor : rightEditor;
  const otherEditor = focused === "left" ? rightEditor : leftEditor;

  const copyLeftToRight = () => setRight(ws.id, left);
  const copyRightToLeft = () => setLeft(ws.id, right);

  /** 复制聚焦编辑器的全部内容到剪贴板 */
  const copyFocusedContent = () => {
    const text = focused === "left" ? left : right;
    if (!text) {
      toast("该编辑器没有可复制的内容");
      return;
    }
    void navigator.clipboard.writeText(text);
    toast("已复制聚焦编辑器全部内容");
  };

  /** 从剪贴板读取文本，粘贴到聚焦编辑器（选区替换，无选区插入光标处） */
  const pasteToFocused = async () => {
    const ed = focusedEditor;
    const model = ed?.getModel();
    if (!ed || !model) {
      toast("没有可粘贴的编辑器");
      return;
    }
    try {
      const text = await navigator.clipboard.readText();
      if (!text) {
        toast("剪贴板为空");
        return;
      }
      const sel = ed.getSelection();
      const range = sel && !sel.isEmpty() ? sel : model.getFullModelRange();
      ed.executeEdits("ww-paste", [{ range, text }]);
      ed.focus();
      toast("已粘贴到聚焦编辑器（Ctrl+Z 可撤销）");
    } catch {
      toast("无法读取剪贴板（浏览器可能未授权）");
    }
  };

  /** 清空聚焦编辑器（可 Ctrl+Z 撤销） */
  const clearFocusedContent = () => {
    const ed = focusedEditor;
    const model = ed?.getModel();
    if (!ed || !model) {
      toast("没有可清空的编辑器");
      return;
    }
    ed.executeEdits("ww-clear", [{ range: model.getFullModelRange(), text: "" }]);
    toast("已清空聚焦编辑器（Ctrl+Z 可撤销）");
  };

  /** 拖拽悬停（React 捕获阶段，先于 Monaco 内部处理）：允许规则/文本拖入 */
  const handleEditorDragOver = (e: React.DragEvent) => {
    const dt = e.dataTransfer;
    if (!dt || dt.types.includes("Files")) return;
    if (
      dt.types.includes("application/x-with-work-rule") ||
      dt.types.includes("text/plain")
    ) {
      e.preventDefault();
      e.stopPropagation();
      dt.dropEffect = "copy";
    }
  };

  /** 拖拽放下：规则拖入 → 按规则替换；普通文本拖入 → 落点插入纯文本（$0 原样保留） */
  const handleEditorDrop = (e: React.DragEvent, side: Side) => {
    const dt = e.dataTransfer;
    if (!dt) return;
    e.preventDefault();
    e.stopPropagation();
    const ed = side === "left" ? leftEditor : rightEditor;
    if (!ed) return;

    // 替换规则拖入：按规则对编辑器全部内容执行替换（可撤销）
    if (dt.types.includes("application/x-with-work-rule")) {
      const ruleId = dt.getData("application/x-with-work-rule");
      const rule = useRulesStore.getState().rules.find((x) => x.id === ruleId);
      const model = ed.getModel();
      if (rule && model) {
        const text = model.getValue();
        const result = applyReplacements(
          text,
          rule.find,
          rule.replace,
          rule.isRegex,
          rule.matchCase,
        );
        ed.executeEdits("ww-rule-drop", [{ range: model.getFullModelRange(), text: result }]);
        toast(`已按规则「${rule.name}」替换`);
      }
      return;
    }

    // 普通文本拖入：落点插入纯文本
    const text = dt.getData("text/plain");
    if (text === undefined || text === null || text === "") return;
    const target = ed.getTargetAtClientPoint(e.clientX, e.clientY);
    if (!target?.position) return;
    const pos = target.position;
    ed.executeEdits("ww-drop", [
      {
        range: {
          startLineNumber: pos.lineNumber,
          startColumn: pos.column,
          endLineNumber: pos.lineNumber,
          endColumn: pos.column,
        },
        text,
      },
    ]);
    ed.focus();
  };

  /** 把聚焦编辑器内容（选区优先）导出到暂存区 / 模板 */
  const importFromFocused = (
    target: "staging" | "text-template" | "sort-template",
  ) => {
    const ed = focusedEditor;
    const model = ed?.getModel();
    const sel = ed?.getSelection();
    const text =
      ed && model && sel && !sel.isEmpty()
        ? model.getValueInRange(sel)
        : focused === "left"
          ? left
          : right;
    if (!text.trim()) {
      toast("该编辑器没有可导出的文本");
      return;
    }
    const name = text.length > 12 ? `${text.slice(0, 12)}…` : text;
    if (target === "staging") {
      useStagingStore.getState().add(text);
      toast("已导入到暂存区");
    } else if (target === "text-template") {
      useTextTemplatesStore.getState().addTemplate({ id: uid(), name, text, group: undefined });
      toast(`已保存为文本模板「${name}」`);
    } else {
      const items = splitLines(text);
      if (items.length === 0) {
        toast("该编辑器没有可导出的行内容");
        return;
      }
      const sortName = items[0].length > 12 ? `${items[0].slice(0, 12)}…` : items[0];
      useTemplatesStore.getState().addTemplate({
        id: uid(),
        name: sortName,
        items,
        group: undefined,
      });
      toast(`已保存为排序模板「${sortName}」`);
    }
  };

  // 左右宽度比例（可拖动，记忆在设置中；增量式避免按下时突跳）
  const split = settings.editorSplit ?? 0.5;
  const startSplitResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startRatio = split;
    const onMove = (ev: MouseEvent) => {
      const rect = editorAreaRef.current?.getBoundingClientRect();
      if (!rect) return;
      const ratio = startRatio + (ev.clientX - startX) / rect.width;
      settings.setEditorSplit(Math.min(0.75, Math.max(0.25, ratio)));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <div className="flex h-full flex-col">
      {/* 顶部工具面板：查找替换 + 分割 + 排序规则（单卡片） */}
      <div className="shrink-0 px-2 pt-2">
        <FindReplacePanel ref={panelRef} focusedEditor={focusedEditor} otherEditor={otherEditor} />
      </div>

      {/* 双编辑器区（窄屏纵向堆叠，宽屏左右并排） */}
      <div ref={editorAreaRef} className="flex min-h-0 flex-1 flex-col gap-1.5 p-2 lg:flex-row">
        <div
          className={cn(
            "min-h-0 flex-1 overflow-hidden rounded-md transition-shadow lg:min-w-0 lg:flex-none",
            focused === "left" ? "ring-2 ring-primary/70" : "ring-1 ring-border",
          )}
          style={{ flexBasis: `calc(${split * 100}% - 18px)` }}
          onDragOverCapture={handleEditorDragOver}
          onDropCapture={(e) => handleEditorDrop(e, "left")}
        >
          <Editor
            height="100%"
            language={detectLanguage(left)}
            theme={theme}
            onMount={(ed) => mountEditor(ed, "left")}
            onChange={(v) => setLeft(ws.id, v ?? "")}
            options={editorOptions}
          />
        </div>

        {/* 中间操作区：交换 / 复制 / 导出等（宽屏顶部对齐，窄屏居中） */}
        <div className="relative flex shrink-0 items-center justify-center gap-2 px-1 lg:w-9 lg:flex-col lg:justify-start lg:px-0">
          <div
            className="absolute inset-y-0 -left-1 z-10 hidden w-2 cursor-ew-resize rounded hover:bg-primary/20 lg:block"
            title="拖动调节左右宽度"
            onMouseDown={startSplitResize}
          />
          <div
            className="absolute inset-y-0 -right-1 z-10 hidden w-2 cursor-ew-resize rounded hover:bg-primary/20 lg:block"
            title="拖动调节左右宽度"
            onMouseDown={startSplitResize}
          />
          <Button
            variant="ghost"
            size="icon-sm"
            title="复制聚焦编辑器全部内容"
            onClick={copyFocusedContent}
          >
            <Copy />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            title="从剪贴板粘贴到聚焦编辑器"
            onClick={() => void pasteToFocused()}
          >
            <ClipboardPaste />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            title={diffOpen ? "对比弹窗已打开" : "进入对比模式"}
            onClick={() => setDiffOpen(true)}
            className={cn(diffOpen && "bg-accent text-accent-foreground")}
          >
            <FileDiff />
          </Button>
          <Button variant="ghost" size="icon-sm" title="交换内容" onClick={() => swapSides(ws.id)}>
            {/* 窄屏上下堆叠时用上下交换图标，宽屏左右并排用左右交换图标 */}
            <ArrowUpDown className="lg:hidden" />
            <ArrowLeftRight className="hidden lg:block" />
          </Button>
          <Button variant="ghost" size="icon-sm" title="复制到另一侧" onClick={copyLeftToRight}>
            <ChevronDown className="lg:hidden" />
            <ChevronRight className="hidden lg:block" />
          </Button>
          <Button variant="ghost" size="icon-sm" title="复制到另一侧" onClick={copyRightToLeft}>
            <ChevronUp className="lg:hidden" />
            <ChevronLeft className="hidden lg:block" />
          </Button>

          {/* 导出聚焦编辑器（选区优先）到暂存区 / 模板 */}
          <Button
            variant="ghost"
            size="icon-sm"
            title="聚焦编辑器 → 暂存区"
            onClick={() => importFromFocused("staging")}
          >
            <Inbox />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            title="聚焦编辑器 → 文本模板"
            onClick={() => importFromFocused("text-template")}
          >
            <FileText />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            title="聚焦编辑器 → 排序模板"
            onClick={() => importFromFocused("sort-template")}
          >
            <ListOrdered />
          </Button>

          {/* 宽屏竖排时把清空按钮推到底部（窄屏横排自动居中，不占位） */}
          <div className="hidden lg:block lg:flex-1" />

          <Button
            variant="ghost"
            size="icon-sm"
            title="清空聚焦编辑器"
            className="text-destructive hover:text-destructive"
            onClick={clearFocusedContent}
          >
            <Trash2 />
          </Button>
        </div>

        <div
          className={cn(
            "min-h-0 flex-1 overflow-hidden rounded-md transition-shadow lg:min-w-0",
            focused === "right" ? "ring-2 ring-primary/70" : "ring-1 ring-border",
          )}
          onDragOverCapture={handleEditorDragOver}
          onDropCapture={(e) => handleEditorDrop(e, "right")}
        >
          <Editor
            height="100%"
            language={detectLanguage(right)}
            theme={theme}
            onMount={(ed) => mountEditor(ed, "right")}
            onChange={(v) => setRight(ws.id, v ?? "")}
            options={editorOptions}
          />
        </div>
      </div>

      {/* 对比弹窗：只读 DiffEditor，不影响下方双编辑器 */}
      <Dialog open={diffOpen} onOpenChange={setDiffOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>对比模式</DialogTitle>
          </DialogHeader>
          <div className="h-[65vh] overflow-hidden rounded-md ring-1 ring-border">
            <DiffEditor
              height="100%"
              original={left}
              modified={right}
              language={detectLanguage(left)}
              theme={theme}
              options={{
                ...editorOptions,
                readOnly: true,
                renderSideBySide: true,
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
