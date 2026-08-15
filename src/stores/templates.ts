import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SortTemplate } from "@/types";

interface TemplatesState {
  templates: SortTemplate[];
  addTemplate: (t: SortTemplate) => void;
  updateTemplate: (t: SortTemplate) => void;
  removeTemplate: (id: string) => void;
  replaceAll: (templates: SortTemplate[]) => void;
}

export const useTemplatesStore = create<TemplatesState>()(
  persist(
    (set) => ({
      templates: [],

      addTemplate: (t) => set((s) => ({ templates: [...s.templates, t] })),

      updateTemplate: (t) =>
        set((s) => ({ templates: s.templates.map((x) => (x.id === t.id ? t : x)) })),

      removeTemplate: (id) => set((s) => ({ templates: s.templates.filter((x) => x.id !== id) })),

      replaceAll: (templates) => set({ templates }),
    }),
    { name: "ww:templates" },
  ),
);
