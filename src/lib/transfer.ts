import { useWorkspaceStore } from "@/stores/workspace";
import { useToastStore } from "@/stores/toast";

export type ImportTarget = "diff-left" | "diff-right";

/** 暂存区条目 → 双栏编辑器（对比左侧 / 右侧）的导入入口 */
export function importText(target: ImportTarget, text: string) {
  const ws = useWorkspaceStore.getState();
  const toast = useToastStore.getState().push;
  const activeId = ws.activeId;

  if (target === "diff-left") {
    if (activeId) ws.setLeft(activeId, text);
    toast("已导入到对比左侧");
  } else {
    if (activeId) ws.setRight(activeId, text);
    toast("已导入到对比右侧");
  }
}
