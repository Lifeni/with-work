import { useEffect, useRef, useState } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import { FindReplacePanel, type FindReplaceHandle } from "@/views/editor/FindReplacePanel";
import { detectLanguage } from "@/lib/detect";
import { setActiveEditor } from "@/lib/editorBridge";
import { useSettingsStore } from "@/stores/settings";
import { useStatusStore } from "@/stores/status";
import { useWorkspaceStore } from "@/stores/workspace";

export default function EditorView() {
  const ws = useWorkspaceStore((s) => s.workspaces.find((w) => w.id === s.activeId));
  const setContent = useWorkspaceStore((s) => s.setContent);
  const settings = useSettingsStore();
  const setCursor = useStatusStore((s) => s.setCursor);

  const [editor, setEditor] = useState<monaco.editor.IStandaloneCodeEditor | null>(null);
  const panelRef = useRef<FindReplaceHandle>(null);

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

  return (
    <div className="flex h-full flex-col">
      <FindReplacePanel ref={panelRef} editor={editor} />
      <div className="min-h-0 flex-1">
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
      </div>
    </div>
  );
}
