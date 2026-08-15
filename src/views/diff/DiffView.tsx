import { useState } from "react";
import { DiffEditor, type DiffOnMount } from "@monaco-editor/react";
import { ArrowLeftRight, Check, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useDiffStore } from "@/stores/diff";
import { useSettingsStore } from "@/stores/settings";
import { useToastStore } from "@/stores/toast";
import { useWorkspaceStore } from "@/stores/workspace";

export default function DiffView() {
  const left = useDiffStore((s) => s.left);
  const right = useDiffStore((s) => s.right);
  const setLeft = useDiffStore((s) => s.setLeft);
  const setRight = useDiffStore((s) => s.setRight);
  const swap = useDiffStore((s) => s.swap);
  const clear = useDiffStore((s) => s.clear);
  const activeId = useWorkspaceStore((s) => s.activeId);
  const setContent = useWorkspaceStore((s) => s.setContent);
  const settings = useSettingsStore();
  const toast = useToastStore((s) => s.push);

  const [changes, setChanges] = useState(0);
  const [confirmApply, setConfirmApply] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const handleMount: DiffOnMount = (diffEditor) => {
    const original = diffEditor.getOriginalEditor();
    const modified = diffEditor.getModifiedEditor();
    const sync = () => {
      setLeft(original.getValue());
      setRight(modified.getValue());
    };
    original.onDidChangeModelContent(sync);
    modified.onDidChangeModelContent(sync);
    diffEditor.onDidUpdateDiff(() => {
      setChanges(diffEditor.getLineChanges()?.length ?? 0);
    });
  };

  const theme =
    settings.theme === "dark"
      ? "vs-dark"
      : settings.theme === "light"
        ? "light"
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "vs-dark"
          : "light";

  const applyToWorkspace = () => {
    if (activeId) {
      setContent(activeId, right);
      toast("已应用右侧内容到当前工作区");
    }
    setConfirmApply(false);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1.5 border-b border-border px-2 py-1.5">
        <span className="text-xs font-medium">文本对比</span>
        <Badge variant="secondary">差异 {changes} 处</Badge>
        <div className="flex-1" />
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={swap}>
          <ArrowLeftRight className="size-3.5" />
          交换左右
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="h-7 text-xs"
          onClick={() => setConfirmApply(true)}
        >
          <Check className="size-3.5" />
          应用到工作区
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-destructive hover:text-destructive"
          onClick={() => setConfirmClear(true)}
        >
          <Trash2 className="size-3.5" />
          清空
        </Button>
      </div>

      <div className="flex items-center justify-between px-3 py-1 text-[11px] text-muted-foreground">
        <span>左侧（原文）</span>
        <span>右侧（修改后）</span>
      </div>

      <div className="relative min-h-0 flex-1">
        <DiffEditor
          original={left}
          modified={right}
          theme={theme}
          language="plaintext"
          onMount={handleMount}
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
        {!left && !right && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <p className="rounded-md bg-card/90 px-4 py-2 text-xs text-muted-foreground shadow">
              在两侧粘贴文本，或从暂存区「导入到对比」开始
            </p>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmApply}
        title="应用到工作区"
        description="将右侧（修改后）的内容覆盖到当前工作区编辑器，确定吗？"
        confirmText="应用"
        onConfirm={applyToWorkspace}
        onCancel={() => setConfirmApply(false)}
      />
      <ConfirmDialog
        open={confirmClear}
        title="清空对比内容"
        description="将清空左侧与右侧的全部文本。"
        confirmText="清空"
        destructive
        onConfirm={() => {
          clear();
          setChanges(0);
          setConfirmClear(false);
        }}
        onCancel={() => setConfirmClear(false)}
      />
    </div>
  );
}
