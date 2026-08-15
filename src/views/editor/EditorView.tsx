import { useEffect, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import { ArrowLeftRight, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FindReplacePanel, type FindReplaceHandle } from "@/views/editor/FindReplacePanel";
import { detectLanguage } from "@/lib/detect";
import { setActiveEditor } from "@/lib/editorBridge";
import { cn } from "@/lib/utils";
import { useDiffStore } from "@/stores/diff";
import { useSettingsStore } from "@/stores/settings";
import { useStatusStore } from "@/stores/status";

type Side = "left" | "right";

export default function EditorView() {
  const left = useDiffStore((s) => s.left);
  const right = useDiffStore((s) => s.right);
  const setLeft = useDiffStore((s) => s.setLeft);
  const setRight = useDiffStore((s) => s.setRight);
  const swap = useDiffStore((s) => s.swap);
  const settings = useSettingsStore();
  const setCursor = useStatusStore((s) => s.setCursor);

  const [leftEditor, setLeftEditor] = useState<monaco.editor.IStandaloneCodeEditor | null>(null);
  const [rightEditor, setRightEditor] = useState<monaco.editor.IStandaloneCodeEditor | null>(null);
  const [focused, setFocused] = useState<Side>("left");
  const panelRef = useRef<FindReplaceHandle>(null);

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
    ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, () =>
      panelRef.current?.open("main"),
    );
    ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyH, () =>
      panelRef.current?.open("main"),
    );
  };

  // 卸载时注销全局编辑器引用（全局工具会回退到直接读写工作区内容）
  useEffect(() => () => setActiveEditor(null), []);

  // 查找替换与列表工具的目标：当前聚焦的编辑器（边框高亮者）
  const focusedEditor = focused === "left" ? leftEditor : rightEditor;
  const otherEditor = focused === "left" ? rightEditor : leftEditor;

  const copyLeftToRight = () => setRight(left);
  const copyRightToLeft = () => setLeft(right);

  return (
    <div className="flex h-full flex-col">
      <FindReplacePanel ref={panelRef} focusedEditor={focusedEditor} otherEditor={otherEditor} />

      <div className="flex min-h-0 flex-1 gap-1.5 p-1.5">
        {/* 左侧编辑器 */}
        <div
          className={cn(
            "min-w-0 flex-1 overflow-hidden rounded-md transition-shadow",
            focused === "left" ? "ring-2 ring-primary/70" : "ring-1 ring-border",
          )}
        >
          <Editor
            height="100%"
            value={left}
            language={detectLanguage(left)}
            theme={theme}
            onMount={(ed) => mountEditor(ed, "left")}
            onChange={(v) => setLeft(v ?? "")}
            options={editorOptions}
          />
        </div>

        {/* 中间操作区：交换 / 左右互传 */}
        <div className="flex w-9 shrink-0 flex-col items-center justify-center gap-2">
          <Button variant="outline" size="icon-sm" title="交换左右内容" onClick={swap}>
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

        {/* 右侧编辑器 */}
        <div
          className={cn(
            "min-w-0 flex-1 overflow-hidden rounded-md transition-shadow",
            focused === "right" ? "ring-2 ring-primary/70" : "ring-1 ring-border",
          )}
        >
          <Editor
            height="100%"
            value={right}
            language={detectLanguage(right)}
            theme={theme}
            onMount={(ed) => mountEditor(ed, "right")}
            onChange={(v) => setRight(v ?? "")}
            options={editorOptions}
          />
        </div>
      </div>
    </div>
  );
}
