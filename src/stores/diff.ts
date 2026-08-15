import { create } from "zustand";
import { persist } from "zustand/middleware";

interface DiffState {
  left: string;
  right: string;
  setLeft: (v: string) => void;
  setRight: (v: string) => void;
  swap: () => void;
  clear: () => void;
  replaceAll: (d: { left: string; right: string }) => void;
}

export const useDiffStore = create<DiffState>()(
  persist(
    (set) => ({
      left: "",
      right: "",

      setLeft: (left) => set({ left }),

      setRight: (right) => set({ right }),

      swap: () => set((s) => ({ left: s.right, right: s.left })),

      clear: () => set({ left: "", right: "" }),

      replaceAll: (d) => set(d),
    }),
    { name: "ww:diff" },
  ),
);
