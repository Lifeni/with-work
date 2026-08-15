import * as monaco from "monaco-editor";
import { detectLanguage } from "./detect";
import { useWorkspaceStore } from "@/stores/workspace";

/**
 * 工作区 → Monaco Model 缓存。
 * Monaco 的 undo/redo 栈挂在 Model 上：每个工作区持有独立的左右 Model，
 * 切换工作区时换绑 Model 即可保留各自的撤销历史（类似 VS Code 每文件独立撤销）。
 */

interface WorkspaceModels {
  left: monaco.editor.ITextModel;
  right: monaco.editor.ITextModel;
}

const cache = new Map<string, WorkspaceModels>();

/** 获取工作区的模型对；首次访问时创建（内容来自 store），之后复用缓存 */
export function getWorkspaceModels(wsId: string): WorkspaceModels | null {
  const cached = cache.get(wsId);
  if (cached) return cached;
  const ws = useWorkspaceStore.getState().workspaces.find((w) => w.id === wsId);
  if (!ws) return null;
  const left = monaco.editor.createModel(ws.left ?? "", detectLanguage(ws.left ?? ""));
  const right = monaco.editor.createModel(ws.right ?? "", detectLanguage(ws.right ?? ""));
  const pair = { left, right };
  cache.set(wsId, pair);
  return pair;
}

/** 清理已不存在工作区的模型（删除工作区时调用，防内存泄漏） */
export function cleanupWorkspaceModels(existingIds: Set<string>) {
  for (const id of [...cache.keys()]) {
    if (!existingIds.has(id)) {
      const pair = cache.get(id);
      pair?.left.dispose();
      pair?.right.dispose();
      cache.delete(id);
    }
  }
}

/** 测试辅助：销毁并清空全部缓存 */
export function resetWorkspaceModels() {
  for (const pair of cache.values()) {
    pair.left.dispose();
    pair.right.dispose();
  }
  cache.clear();
}
