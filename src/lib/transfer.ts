import { useWorkspaceStore } from "@/stores/workspace";
import { useToastStore } from "@/stores/toast";

export type ImportTarget = "diff-left" | "diff-right";

/** 暂存区条目 → 双栏编辑器（对比左侧 / 右侧）的导入入口 */
export function importText(target: ImportTarget, text: string) {
  const wsStore = useWorkspaceStore();
  const toast = useToastStore().push;
  const activeId = wsStore.activeId;

  if (target === "diff-left") {
    if (activeId) wsStore.setLeft(activeId, text);
    toast("已导入到对比左侧");
  } else {
    if (activeId) wsStore.setRight(activeId, text);
    toast("已导入到对比右侧");
  }
}
