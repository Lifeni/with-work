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
      {/* 模式切换（单编辑器 / 双编辑器对比）与双模式操作 */}
      <div className="flex h-8 shrink-0 items-center gap-1.5 border-b border-border px-2">
        <div className="flex shrink-0 rounded-md border border-border bg-card p-0.5 text-xs">
          <button
            className={cn(
              "flex items-center gap-1 rounded px-2 py-0.5",
              mode === "single" ? "bg-accent font-medium" : "text-muted-foreground",
            )}
            onClick={() => setEditorMode(ws.id, "single")}
          >
            <Rows2 className="size-3" />
            单编辑器
          </button>
          <button
            className={cn(
              "flex items-center gap-1 rounded px-2 py-0.5",
              mode === "dual" ? "bg-accent font-medium" : "text-muted-foreground",
            )}
            onClick={enterDual}
          >
            <Columns2 className="size-3" />
            双编辑器
          </button>
        </div>
        {mode === "dual" ? (
          <>
            <Badge variant="secondary">差异 {changes} 处</Badge>
            <div className="flex-1" />
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={swap}>
              <ArrowLeftRight className="size-3.5" />
              交换左右
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={applyRightToWorkspace}
            >
              <Check className="size-3.5" />
              应用到工作区
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-destructive hover:text-destructive"
              onClick={() => setConfirmClearDiff(true)}
            >
              <Trash2 className="size-3.5" />
              清空两侧
            </Button>
          </>
        ) : (
          <div className="flex-1" />
        )}
      </div>

      <FindReplacePanel ref={panelRef} editor={findTarget} />

      <div className="min-h-0 flex-1">
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
