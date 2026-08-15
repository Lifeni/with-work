import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ListState {
  source: string;
  reference: string;
  compare: string;
  setSource: (v: string) => void;
  setReference: (v: string) => void;
  setCompare: (v: string) => void;
  replaceAll: (d: { source: string; reference: string; compare: string }) => void;
}

export const useListStore = create<ListState>()(
  persist(
    (set) => ({
      source: "",
      reference: "",
      compare: "",

      setSource: (source) => set({ source }),

      setReference: (reference) => set({ reference }),

      setCompare: (compare) => set({ compare }),

      replaceAll: (d) => set(d),
    }),
    { name: "ww:list" },
  ),
);
