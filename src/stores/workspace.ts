import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { EditorMode, ViewId, Workspace } from "@/types";

let seq = 0;
const nextId = () => `ws-${Date.now().toString(36)}-${(seq++).toString(36)}`;

interface WorkspaceState {
  workspaces: Workspace[];
  activeId: string | null;
  createWorkspace: () => string;
  deleteWorkspace: (id: string) => void;
  renameWorkspace: (id: string, name: string) => void;
  setActive: (id: string) => void;
  setContent: (id: string, content: string) => void;
  setLanguage: (id: string, language: string) => void;
  setEditorMode: (id: string, editorMode: EditorMode) => void;
  setLeft: (id: string, left: string) => void;
  setRight: (id: string, right: string) => void;
  swapSides: (id: string) => void;
  setView: (id: string, view: ViewId) => void;
  replaceAll: (workspaces: Workspace[]) => void;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      workspaces: [],
      activeId: null,

      createWorkspace: () => {
        const id = nextId();
        const ws: Workspace = {
          id,
          name: `工作区 ${get().workspaces.length + 1}`,
          content: "",
          language: "auto",
          editorMode: "single",
          left: "",
          right: "",
          view: "editor",
        };
        set((s) => ({ workspaces: [...s.workspaces, ws], activeId: id }));
        return id;
      },

      deleteWorkspace: (id) =>
        set((s) => {
          const workspaces = s.workspaces.filter((w) => w.id !== id);
          let activeId = s.activeId;
          if (activeId === id) {
            const idx = s.workspaces.findIndex((w) => w.id === id);
            const next = workspaces[Math.min(idx, workspaces.length - 1)] ?? null;
            activeId = next ? next.id : null;
          }
          return { workspaces, activeId };
        }),

      renameWorkspace: (id, name) =>
        set((s) => ({
          workspaces: s.workspaces.map((w) => (w.id === id ? { ...w, name: name || w.name } : w)),
        })),

      setActive: (id) => set({ activeId: id }),

      setContent: (id, content) =>
        set((s) => ({
          workspaces: s.workspaces.map((w) => (w.id === id ? { ...w, content } : w)),
        })),

      setLanguage: (id, language) =>
        set((s) => ({
          workspaces: s.workspaces.map((w) => (w.id === id ? { ...w, language } : w)),
        })),

      setEditorMode: (id, editorMode) =>
        set((s) => ({
          workspaces: s.workspaces.map((w) => (w.id === id ? { ...w, editorMode } : w)),
        })),

      setLeft: (id, left) =>
        set((s) => ({
          workspaces: s.workspaces.map((w) => (w.id === id ? { ...w, left } : w)),
        })),

      setRight: (id, right) =>
        set((s) => ({
          workspaces: s.workspaces.map((w) => (w.id === id ? { ...w, right } : w)),
        })),

      swapSides: (id) =>
        set((s) => ({
          workspaces: s.workspaces.map((w) =>
            w.id === id ? { ...w, left: w.right ?? "", right: w.left ?? "" } : w,
          ),
        })),

      setView: (id, view) =>
        set((s) => ({
          workspaces: s.workspaces.map((w) => (w.id === id ? { ...w, view } : w)),
        })),

      replaceAll: (workspaces) => set({ workspaces, activeId: workspaces[0]?.id ?? null }),
    }),
    { name: "ww:workspaces" },
  ),
);
