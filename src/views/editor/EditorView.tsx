import { useEffect, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import { ArrowLeftRight, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FindReplacePanel, type FindReplaceHandle } from "@/views/editor/FindReplacePanel";
import { detectLanguage } from "@/lib/detect";
import { setActiveEditor } from "@/lib/editorBridge";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/stores/settings";
import { useStatusStore } from "@/stores/status";
import { useWorkspaceStore } from "@/stores/workspace";

type Side = "left" | "right";

export default function EditorView() {
  const ws = useWorkspaceStore((s) => s.workspaces.find((w) => w.id === s.activeId));
  const setLeft = useWorkspaceStore((s) => s.setLeft);
  const setRight = useWorkspaceStore((s) => s.setRight);
  const swapSides = useWorkspaceStore((s) => s.swapSides);
  const settings = useSettingsStore();
  const setCursor = useStatusStore((s) => s.setCursor);

  const [leftEditor, setLeftEditor] = useState<monaco.editor.IStandaloneCodeEditor | null>(null);
  const [rightEditor, setRightEditor] = useState<monaco.editor.IStandaloneCodeEditor | null>(null);
  const [focused, setFocused] = useState<Side>("left");
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
  };

  const mountEditor = (ed: monaco.editor.IStandaloneCodeEditor, side: Side) => {
    if (side === "left") setLeftEditor(ed);
    else setRightEditor(ed);
    setActiveEditor(ed);
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

  if (!ws) return null;

  const left = ws.left ?? "";
  const right = ws.right ?? "";
  // 查找替换与列表工具的目标：当前聚焦的编辑器（边框高亮者）
  const focusedEditor = focused === "left" ? leftEditor : rightEditor;
  const otherEditor = focused === "left" ? rightEditor : leftEditor;

  const copyLeftToRight = () => setRight(ws.id, left);
  const copyRightToLeft = () => setLeft(ws.id, right);

  // 左右宽度比例（可拖动，记忆在设置中）
  const split = settings.editorSplit ?? 0.5;
  const startSplitResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const onMove = (ev: MouseEvent) => {
      const rect = editorAreaRef.current?.getBoundingClientRect();
      if (!rect) return;
      const ratio = (ev.clientX - rect.left) / rect.width;
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
      <div className="shrink-0 px-1.5 pt-1.5">
        <FindReplacePanel ref={panelRef} focusedEditor={focusedEditor} otherEditor={otherEditor} />
      </div>

      {/* 双编辑器区（窄屏纵向堆叠，宽屏左右并排） */}
      <div ref={editorAreaRef} className="flex min-h-0 flex-1 flex-col gap-1.5 p-1.5 lg:flex-row">
        <div
          className={cn(
            "min-h-0 flex-1 overflow-hidden rounded-md transition-shadow lg:min-w-0 lg:flex-none",
            focused === "left" ? "ring-2 ring-primary/70" : "ring-1 ring-border",
          )}
          style={{ flexBasis: `calc(${split * 100}% - 18px)` }}
        >
          <Editor
            height="100%"
            value={left}
            language={detectLanguage(left)}
            theme={theme}
            onMount={(ed) => mountEditor(ed, "left")}
            onChange={(v) => setLeft(ws.id, v ?? "")}
            options={editorOptions}
          />
        </div>

        {/* 中间操作区：交换 / 左右互传 / 拖动调节宽度 */}
        <div className="relative flex shrink-0 items-center justify-center gap-2 px-1 lg:w-9 lg:flex-col lg:px-0">
          <div
            className="absolute inset-y-0 -left-2 hidden w-4 cursor-ew-resize lg:block"
            title="拖动调节左右宽度"
            onMouseDown={startSplitResize}
          />
          <div
            className="absolute inset-y-0 -right-2 hidden w-4 cursor-ew-resize lg:block"
            title="拖动调节左右宽度"
            onMouseDown={startSplitResize}
          />
          <Button
            variant="outline"
            size="icon-sm"
            title="交换左右内容"
            onClick={() => swapSides(ws.id)}
          >
            <ArrowLeftRight />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            title="左侧内容复制到右侧"
            onClick={copyLeftToRight}
          >
            <ChevronRight />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            title="右侧内容复制到左侧"
            onClick={copyRightToLeft}
          >
            <ChevronLeft />
          </Button>
        </div>

        <div
          className={cn(
            "min-h-0 flex-1 overflow-hidden rounded-md transition-shadow lg:min-w-0",
            focused === "right" ? "ring-2 ring-primary/70" : "ring-1 ring-border",
          )}
        >
          <Editor
            height="100%"
            value={right}
            language={detectLanguage(right)}
            theme={theme}
            onMount={(ed) => mountEditor(ed, "right")}
            onChange={(v) => setRight(ws.id, v ?? "")}
            options={editorOptions}
          />
        </div>
      </div>
    </div>
  );
}
