import { create } from "zustand";

interface StatusState {
  line: number;
  col: number;
  setCursor: (line: number, col: number) => void;
}

export const useStatusStore = create<StatusState>((set) => ({
  line: 1,
  col: 1,
  setCursor: (line, col) => set({ line, col }),
}));
