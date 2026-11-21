import { supportsSaveFilePicker } from "@/lib/fileAccess";
import {
  saveWorkspaceAs,
  saveWorkspaceToBoundFile,
  suggestedTextFileName,
} from "@/lib/fileWorkspace";
import { findFileForWorkspace } from "@/lib/recentFiles";
import { getActiveEditor } from "@/lib/editorBridge";
import { downloadText } from "@/lib/utils";
import { useToastStore } from "@/stores/toast";
import { useWorkspaceStore } from "@/stores/workspace";

/** 文件名时间戳：2026-08-15-221530 */
function fileTimestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

export function useFileActions() {
  const workspaceStore = useWorkspaceStore();
  const toast = useToastStore().push;

  function focusedText(): string {
    const editor = getActiveEditor();
    return editor?.getModel()?.getValue() ?? "";
  }

  function activeWorkspaceName(): string {
    return (
      workspaceStore.workspaces.find((workspace) => workspace.id === workspaceStore.activeId)
        ?.name ?? "工作区"
    );
  }

  /** Ctrl+S：优先写回原文件；未绑定文件时保持下载行为 */
  async function saveFocused() {
    const workspaceId = workspaceStore.activeId;
    if (workspaceId) {
      const workspace = workspaceStore.workspaces.find((item) => item.id === workspaceId);
      const binding = findFileForWorkspace(workspaceId);
      if (workspace && binding) {
        const text = binding.side === "right" ? (workspace.right ?? "") : (workspace.left ?? "");
        const result = await saveWorkspaceToBoundFile(workspaceId, text);
        if (result.ok) {
          toast(`已保存到「${result.name}」`);
          return;
        }
        toast(result.error ?? "保存到原文件失败");
        return;
      }
    }

    const text = focusedText();
    if (!text.trim()) {
      toast("没有文本");
      return;
    }
    downloadText(`${activeWorkspaceName()}-${fileTimestamp()}.txt`, text);
    toast("已保存到下载");
  }

  /** Ctrl+Shift+S：系统“另存为”，成功后把工作区绑定到新文件 */
  async function saveFocusedAs(side: "left" | "right") {
    const text = focusedText();
    if (!text.trim()) {
      toast("没有文本");
      return;
    }

    const workspaceId = workspaceStore.activeId;
    if (!workspaceId) {
      toast("没有可保存的工作区");
      return;
    }

    const name = activeWorkspaceName();
    if (!supportsSaveFilePicker()) {
      downloadText(suggestedTextFileName(name), text);
      toast("当前浏览器不支持另存为，已下载文本");
      return;
    }

    const result = await saveWorkspaceAs(workspaceId, name, text, side);
    if (result.ok) {
      toast(`已保存到「${result.name}」`);
    } else if (!result.cancelled) {
      toast(result.error ?? "另存为失败");
    }
  }

  return { saveFocused, saveFocusedAs };
}
