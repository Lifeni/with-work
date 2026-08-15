import { useRef, useState } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import { Redo2, Search, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { FindReplacePanel, type FindReplaceHandle } from "@/views/editor/FindReplacePanel";
import { useSettingsStore } from "@/stores/settings";
import { useStatusStore } from "@/stores/status";
import { useToastStore } from "@/stores/toast";
import { useWorkspaceStore } from "@/stores/workspace";

const LANGUAGES = [
  { value: "plaintext", label: "纯文本" },
  { value: "markdown", label: "Markdown" },
  { value: "json", label: "JSON" },
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
  { value: "yaml", label: "YAML" },
  { value: "xml", label: "XML" },
  { value: "python", label: "Python" },
  { value: "sql", label: "SQL" },
  { value: "shell", label: "Shell" },
];

export default function EditorView() {
  const ws = useWorkspaceStore((s) => s.workspaces.find((w) => w.id === s.activeId));
  const setContent = useWorkspaceStore((s) => s.setContent);
  const setLanguage = useWorkspaceStore((s) => s.setLanguage);
  const settings = useSettingsStore();
  const setCursor = useStatusStore((s) => s.setCursor);
  const toast = useToastStore((s) => s.push);

  const [editor, setEditor] = useState<monaco.editor.IStandaloneCodeEditor | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [confirmClear, setConfirmClear] = useState(false);
  const panelRef = useRef<FindReplaceHandle>(null);

  const handleMount: OnMount = (ed) => {
    setEditor(ed);
    ed.onDidChangeCursorPosition((e) => setCursor(e.position.lineNumber, e.position.column));
    ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, () => {
      setPanelOpen(true);
      panelRef.current?.open("find");
    });
    ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyH, () => {
      setPanelOpen(true);
      panelRef.current?.open("replace");
    });
  };

  if (!ws) return null;

  const theme =
    settings.theme === "dark"
      ? "vs-dark"
      : settings.theme === "light"
        ? "light"
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "vs-dark"
          : "light";

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1.5 border-b border-border px-2 py-1.5">
        <Button
          variant={panelOpen ? "secondary" : "ghost"}
          size="sm"
          className="h-7 text-xs"
          onClick={() => setPanelOpen(!panelOpen)}
        >
          <Search className="size-3.5" />
          查找替换
        </Button>
        <select
          value={ws.language}
          onChange={(e) => {
            setLanguage(ws.id, e.target.value);
            const model = editor?.getModel();
            if (model) monaco.editor.setModelLanguage(model, e.target.value);
          }}
          className="h-7 rounded-md border border-border bg-transparent px-2 text-xs outline-none transition-colors hover:bg-accent"
        >
          {LANGUAGES.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="icon-sm"
          title="撤销 (Ctrl+Z)"
          onClick={() => editor?.trigger("toolbar", "undo", null)}
        >
          <Undo2 />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          title="重做"
          onClick={() => editor?.trigger("toolbar", "redo", null)}
        >
          <Redo2 />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          title="清空内容"
          className="text-destructive hover:text-destructive"
          onClick={() => setConfirmClear(true)}
        >
          <Trash2 />
        </Button>
      </div>

      {panelOpen && (
        <FindReplacePanel
          ref={panelRef}
          editor={editor}
          initialMode="find"
        />
      )}

      <div className="min-h-0 flex-1">
        <Editor
          height="100%"
          value={ws.content}
          language={ws.language}
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
      </div>

      <ConfirmDialog
        open={confirmClear}
        title="清空当前工作区"
        description={`确定要清空「${ws.name}」的全部内容吗？此操作不可撤销。`}
        confirmText="清空"
        destructive
        onConfirm={() => {
          setContent(ws.id, "");
          setConfirmClear(false);
          toast("已清空");
        }}
        onCancel={() => setConfirmClear(false)}
      />
    </div>
  );
}
