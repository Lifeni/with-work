import { useWorkspaceStore } from "@/stores/workspace";
import { useDiffStore } from "@/stores/diff";
import { useListStore } from "@/stores/list";
import { useToastStore } from "@/stores/toast";

export type ImportTarget = "diff-left" | "diff-right" | "list-reference";

/** 暂存区条目 → 各工具的导入入口 */
export function importText(target: ImportTarget, text: string) {
  const ws = useWorkspaceStore.getState();
  const toast = useToastStore.getState().push;
  const activeId = ws.activeId;

  switch (target) {
    case "diff-left":
      useDiffStore.getState().setLeft(text);
      if (activeId) {
        ws.setEditorMode(activeId, "dual");
        ws.setView(activeId, "editor");
      }
      toast("已导入到对比左侧（双编辑器模式）");
      break;
    case "diff-right":
      useDiffStore.getState().setRight(text);
      if (activeId) {
        ws.setEditorMode(activeId, "dual");
        ws.setView(activeId, "editor");
      }
      toast("已导入到对比右侧（双编辑器模式）");
      break;
    case "list-reference":
      useListStore.getState().setReference(text);
      if (activeId) ws.setView(activeId, "editor");
      toast("已导入到列表工具·参考列表");
      break;
  }
}
