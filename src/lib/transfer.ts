import { useWorkspaceStore } from "@/stores/workspace";
import { useDiffStore } from "@/stores/diff";
import { useListStore } from "@/stores/list";
import { useToastStore } from "@/stores/toast";

export type ImportTarget =
  "editor" | "diff-left" | "diff-right" | "list-source" | "list-reference" | "list-compare";

/** 暂存区条目 → 各工具的导入入口 */
export function importText(target: ImportTarget, text: string) {
  const ws = useWorkspaceStore.getState();
  const toast = useToastStore.getState().push;
  const activeId = ws.activeId;

  switch (target) {
    case "editor":
      if (activeId) {
        ws.setContent(activeId, text);
        ws.setView(activeId, "editor");
      }
      toast("已导入到编辑器");
      break;
    case "diff-left":
      useDiffStore.getState().setLeft(text);
      if (activeId) ws.setView(activeId, "diff");
      toast("已导入到对比左侧");
      break;
    case "diff-right":
      useDiffStore.getState().setRight(text);
      if (activeId) ws.setView(activeId, "diff");
      toast("已导入到对比右侧");
      break;
    case "list-source":
      useListStore.getState().setSource(text);
      if (activeId) ws.setView(activeId, "list");
      toast("已导入到列表工具·源文本");
      break;
    case "list-reference":
      useListStore.getState().setReference(text);
      if (activeId) ws.setView(activeId, "list");
      toast("已导入到列表工具·参考列表");
      break;
    case "list-compare":
      useListStore.getState().setCompare(text);
      if (activeId) ws.setView(activeId, "list");
      toast("已导入到列表工具·对比列表");
      break;
  }
}
