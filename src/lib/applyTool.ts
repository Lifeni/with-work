import { getActiveEditor } from "./editorBridge";
import { useWorkspaceStore } from "@/stores/workspace";
import type { GlobalTool } from "@/tools/registry";

/** 获取工具的处理输入：有选区取选区文本，否则取聚焦编辑器全文（回退工作区左栏） */
export function getToolInput(): string {
  const editor = getActiveEditor();
  const model = editor?.getModel();
  const selection = editor?.getSelection();
  if (editor && model) {
    if (selection && !selection.isEmpty()) return model.getValueInRange(selection);
    return model.getValue();
  }
  const s = useWorkspaceStore.getState();
  const ws = s.workspaces.find((w) => w.id === s.activeId);
  return ws?.left ?? ws?.content ?? "";
}

/** 执行工具：有选区替换选区，否则替换聚焦编辑器全文；编辑器内可 Ctrl+Z 撤销 */
export function applyTool(
  tool: GlobalTool,
  run: (input: string) => string,
): { message: string } | null {
  const wsState = useWorkspaceStore.getState();
  const activeId = wsState.activeId;
  if (!activeId) return null;

  const editor = getActiveEditor();
  const model = editor?.getModel();
  const selection = editor?.getSelection();
  const hasSelection = !!editor && !!model && !!selection && !selection.isEmpty();
  const input = hasSelection
    ? (model as NonNullable<typeof model>).getValueInRange(
        selection as NonNullable<typeof selection>,
      )
    : editor && model
      ? model.getValue()
      : (wsState.workspaces.find((w) => w.id === activeId)?.left ?? "");

  const output = run(input);
  if (input === output) {
    return { message: `「${tool.name}」：内容没有变化` };
  }

  if (editor && model) {
    const range = hasSelection && selection ? selection : model.getFullModelRange();
    editor.executeEdits("ww-tool", [{ range, text: output }]);
  } else {
    wsState.setLeft(activeId, output);
  }
  return { message: `已执行「${tool.name}」，Ctrl+Z 可撤销` };
}
