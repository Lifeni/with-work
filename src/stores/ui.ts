import { create } from "zustand";

interface UiState {
  stagingOpen: boolean;
  toggleStaging: () => void;
  setStagingOpen: (v: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  stagingOpen: true,
  toggleStaging: () => set((s) => ({ stagingOpen: !s.stagingOpen })),
  setStagingOpen: (stagingOpen) => set({ stagingOpen }),
}));
