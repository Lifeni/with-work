import { useEffect, useRef, useState } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import { DiffEditor, type DiffOnMount } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import { ArrowLeftRight, Check, Columns2, Rows2, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { FindReplacePanel, type FindReplaceHandle } from "@/views/editor/FindReplacePanel";
import { detectLanguage } from "@/lib/detect";
import { setActiveEditor } from "@/lib/editorBridge";
import { cn } from "@/lib/utils";
import { useDiffStore } from "@/stores/diff";
import { useSettingsStore } from "@/stores/settings";
import { useStatusStore } from "@/stores/status";
import { useToastStore } from "@/stores/toast";
import { useWorkspaceStore } from "@/stores/workspace";
import type { EditorMode } from "@/types";

export default function EditorView() {
  const ws = useWorkspaceStore((s) => s.workspaces.find((w) => w.id === s.activeId));
  const setContent = useWorkspaceStore((s) => s.setContent);
  const setEditorMode = useWorkspaceStore((s) => s.setEditorMode);
  const settings = useSettingsStore();
  const setCursor = useStatusStore((s) => s.setCursor);
  const toast = useToastStore((s) => s.push);
  const diffLeft = useDiffStore((s) => s.left);
  const diffRight = useDiffStore((s) => s.right);
  const setDiffLeft = useDiffStore((s) => s.setLeft);
  const setDiffRight = useDiffStore((s) => s.setRight);
  const swap = useDiffStore((s) => s.swap);
  const clearDiff = useDiffStore((s) => s.clear);

  const [editor, setEditor] = useState<monaco.editor.IStandaloneCodeEditor | null>(null);
  const [dualEditor, setDualEditor] = useState<monaco.editor.IStandaloneCodeEditor | null>(null);
  const [changes, setChanges] = useState(0);
  const [confirmClearDiff, setConfirmClearDiff] = useState(false);
  const panelRef = useRef<FindReplaceHandle>(null);

  const mode: EditorMode = ws?.editorMode ?? "single";

  const handleMount: OnMount = (ed) => {
    setEditor(ed);
    setActiveEditor(ed);
    ed.onDidChangeCursorPosition((e) => setCursor(e.position.lineNumber, e.position.column));
    ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, () =>
      panelRef.current?.open("find"),
    );
    ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyH, () =>
      panelRef.current?.open("replace"),
    );
  };

  const handleDiffMount: DiffOnMount = (diffEditor) => {
    const original = diffEditor.getOriginalEditor();
    const modified = diffEditor.getModifiedEditor();
    setDualEditor(modified);
    setActiveEditor(modified);
    const syncOriginal = () => setDiffLeft(original.getValue());
    const syncModified = () => setDiffRight(modified.getValue());
    original.onDidChangeModelContent(syncOriginal);
    modified.onDidChangeModelContent(syncModified);
    modified.onDidChangeCursorPosition((e) => setCursor(e.position.lineNumber, e.position.column));
    diffEditor.onDidUpdateDiff(() => setChanges(diffEditor.getLineChanges()?.length ?? 0));
  };

  // 卸载时注销全局编辑器引用（全局工具会回退到直接读写工作区内容）
  useEffect(() => () => setActiveEditor(null), []);

  if (!ws) return null;

  const theme =
    settings.theme === "dark"
      ? "vs-dark"
      : settings.theme === "light"
        ? "light"
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "vs-dark"
          : "light";

  // 查找替换面板的目标编辑器：单模式用主编辑器，双模式用右侧（修改后）编辑器
  const findTarget = mode === "dual" ? dualEditor : editor;

  const enterDual = () => {
    // 首次进入双编辑器且两侧为空时，用当前工作区内容初始化
    const s = useDiffStore.getState();
    if (s.left === "" && s.right === "") {
      setDiffLeft(ws.content);
      setDiffRight(ws.content);
    }
    setEditorMode(ws.id, "dual");
  };

  const applyRightToWorkspace = () => {
    setContent(ws.id, diffRight);
    toast("已应用右侧内容到当前工作区");
  };

  return (
    <div className="flex h-full flex-col">
      <FindReplacePanel ref={panelRef} editor={findTarget} />

      <div className="relative min-h-0 flex-1">
        {mode === "single" ? (
          <Editor
            height="100%"
            value={ws.content}
            language={detectLanguage(ws.content)}
            theme={theme}
            onMount={handleMount}
            onChange={(v) => setContent(ws.id, v ?? "")}
            options={{
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
            }}
          />
        ) : (
          <DiffEditor
            original={diffLeft}
            modified={diffRight}
            theme={theme}
            language="plaintext"
            onMount={handleDiffMount}
            options={{
              originalEditable: true,
              renderSideBySide: true,
              minimap: { enabled: false },
              fontSize: settings.fontSize,
              fontFamily: settings.editorFontFamily,
              wordWrap: settings.wordWrap ? "on" : "off",
              automaticLayout: true,
              scrollBeyondLastLine: false,
              renderOverviewRuler: false,
            }}
          />
        )}
        {/* 模式切换悬浮按钮：单/双编辑器 + 双模式操作（差异/交换/应用/清空） */}
        <div className="pointer-events-none absolute inset-x-0 bottom-2.5 z-20 flex justify-end px-3">
          <div className="pointer-events-auto flex items-center gap-1 rounded-lg border border-border bg-card/95 p-1 shadow-lg backdrop-blur">
            <div className="flex items-center rounded-md bg-muted p-0.5">
              <button
                title="单编辑器"
                onClick={() => setEditorMode(ws.id, "single")}
                className={cn(
                  "flex h-6 w-7 items-center justify-center rounded transition-colors",
                  mode === "single"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Rows2 className="size-3.5" />
              </button>
              <button
                title="双编辑器（对比）"
                onClick={enterDual}
                className={cn(
                  "flex h-6 w-7 items-center justify-center rounded transition-colors",
                  mode === "dual"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Columns2 className="size-3.5" />
              </button>
            </div>
            {mode === "dual" && (
              <>
                <span className="h-4 w-px bg-border" />
                <Badge variant="secondary" className="font-mono">
                  差异 {changes}
                </Badge>
                <Button variant="ghost" size="icon-sm" title="交换左右" onClick={swap}>
                  <ArrowLeftRight />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title="应用到工作区（右侧）"
                  onClick={applyRightToWorkspace}
                >
                  <Check />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title="清空两侧"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setConfirmClearDiff(true)}
                >
                  <Trash2 />
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmClearDiff}
        title="清空对比内容"
        description="将清空双编辑器左右两侧的文本。"
        confirmText="清空"
        destructive
        onConfirm={() => {
          clearDiff();
          setChanges(0);
          setConfirmClearDiff(false);
        }}
        onCancel={() => setConfirmClearDiff(false)}
      />
    </div>
  );
}
