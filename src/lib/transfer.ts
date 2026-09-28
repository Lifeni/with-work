import { useWorkspaceStore } from "@/stores/workspace";
import { useToastStore } from "@/stores/toast";

export type ImportTarget = "diff-left" | "diff-right";

/** 暂存区条目 → 双栏编辑器（对比左侧 / 右侧）的导入入口 */
export function importText(target: ImportTarget, text: string) {
  const wsStore = useWorkspaceStore();
  const toast = useToastStore().push;
  const activeId = wsStore.activeId;

  // 没有激活工作区时无处写入：如实提示，避免「已导入」的成功假象
  if (!activeId) {
    toast("没有可导入的工作区");
    return;
  }

  if (target === "diff-left") {
    wsStore.setLeft(activeId, text);
    toast("已导入到对比左侧");
  } else {
    wsStore.setRight(activeId, text);
    toast("已导入到对比右侧");
  }
}
