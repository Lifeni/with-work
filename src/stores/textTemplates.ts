import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { TextTemplate } from "@/types";

interface TextTemplatesState {
  templates: TextTemplate[];
  addTemplate: (t: TextTemplate) => void;
  updateTemplate: (t: TextTemplate) => void;
  removeTemplate: (id: string) => void;
  replaceAll: (templates: TextTemplate[]) => void;
}

/** 文本模板（自定义模板）：一段可复用文本，可拖拽/插入到编辑器 */
export const useTextTemplatesStore = create<TextTemplatesState>()(
  persist(
    (set) => ({
      templates: [],

      addTemplate: (t) => set((s) => ({ templates: [...s.templates, t] })),

      updateTemplate: (t) =>
        set((s) => ({ templates: s.templates.map((x) => (x.id === t.id ? t : x)) })),

      removeTemplate: (id) => set((s) => ({ templates: s.templates.filter((x) => x.id !== id) })),

      replaceAll: (templates) => set({ templates }),
    }),
    { name: "ww:text-templates" },
  ),
);
