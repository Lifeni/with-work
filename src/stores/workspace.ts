import { ref } from "vue";
import { defineStore } from "pinia";
import type { Workspace } from "@/types";

let seq = 0;
const nextId = () => `ws-${Date.now().toString(36)}-${(seq++).toString(36)}`;

export const useWorkspaceStore = defineStore("workspace", () => {
  const workspaces = ref<Workspace[]>([]);
  const activeId = ref<string | null>(null);

  function createWorkspace(): string {
    const id = nextId();
    const ws: Workspace = {
      id,
      name: `工作区 ${workspaces.value.length + 1}`,
      left: "",
      right: "",
    };
    workspaces.value = [...workspaces.value, ws];
    activeId.value = id;
    return id;
  }

  function deleteWorkspace(id: string) {
    const next = workspaces.value.filter((w) => w.id !== id);
    if (activeId.value === id) {
      const idx = workspaces.value.findIndex((w) => w.id === id);
      const after = next[Math.min(idx, next.length - 1)] ?? null;
      activeId.value = after ? after.id : null;
    }
    workspaces.value = next;
  }

  function renameWorkspace(id: string, name: string) {
    workspaces.value = workspaces.value.map((w) =>
      w.id === id ? { ...w, name: name || w.name } : w,
    );
  }

  function setActive(id: string) {
    activeId.value = id;
  }

  function setLeft(id: string, left: string) {
    workspaces.value = workspaces.value.map((w) => (w.id === id ? { ...w, left } : w));
  }

  function setRight(id: string, right: string) {
    workspaces.value = workspaces.value.map((w) => (w.id === id ? { ...w, right } : w));
  }

  function swapSides(id: string) {
    workspaces.value = workspaces.value.map((w) =>
      w.id === id ? { ...w, left: w.right ?? "", right: w.left ?? "" } : w,
    );
  }

  function replaceAll(next: Workspace[]) {
    workspaces.value = next;
    activeId.value = next[0]?.id ?? null;
  }

  return {
    workspaces,
    activeId,
    createWorkspace,
    deleteWorkspace,
    renameWorkspace,
    setActive,
    setLeft,
    setRight,
    swapSides,
    replaceAll,
  };
});
