import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { StagingItem } from "@/types";
import { uid } from "@/lib/utils";

interface StagingState {
  items: StagingItem[];
  add: (text: string) => void;
  remove: (id: string) => void;
  clear: () => void;
  replaceAll: (items: StagingItem[]) => void;
}

export const useStagingStore = create<StagingState>()(
  persist(
    (set) => ({
      items: [],

      add: (text) => {
        const trimmed = text.trim();
        if (!trimmed) return;
        set((s) => ({
          items: [{ id: uid(), text: trimmed, createdAt: Date.now() }, ...s.items],
        }));
      },

      remove: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),

      clear: () => set({ items: [] }),

      replaceAll: (items) => set({ items }),
    }),
    { name: "ww:staging" },
  ),
);
