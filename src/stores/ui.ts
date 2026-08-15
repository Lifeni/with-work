import { create } from "zustand";

interface UiState {
  stagingOpen: boolean;
  settingsOpen: boolean;
  toggleStaging: () => void;
  setStagingOpen: (v: boolean) => void;
  setSettingsOpen: (v: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  stagingOpen: true,
  settingsOpen: false,
  toggleStaging: () => set((s) => ({ stagingOpen: !s.stagingOpen })),
  setStagingOpen: (stagingOpen) => set({ stagingOpen }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
}));
