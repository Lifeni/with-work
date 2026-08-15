import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AppSettings, ThemeMode } from "@/types";
import { applyTheme } from "@/lib/theme";

interface SettingsState extends AppSettings {
  setTheme: (theme: ThemeMode) => void;
  setFontSize: (fontSize: number) => void;
  setWordWrap: (wordWrap: boolean) => void;
  setEditorFontFamily: (editorFontFamily: string) => void;
  setStagingWidth: (stagingWidth: number) => void;
  setEditorSplit: (editorSplit: number) => void;
  setStagingTemplateHeight: (stagingTemplateHeight: number) => void;
  replaceAll: (partial: AppSettings) => void;
}

export const DEFAULT_FONT_FAMILY = "ui-monospace, SF Mono, Cascadia Code, Consolas, monospace";

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: "system",
      fontSize: 14,
      wordWrap: true,
      editorFontFamily: DEFAULT_FONT_FAMILY,

      setTheme: (theme) => {
        set({ theme });
        applyTheme(theme);
      },

      setFontSize: (fontSize) => set({ fontSize }),

      setWordWrap: (wordWrap) => set({ wordWrap }),

      setEditorFontFamily: (editorFontFamily) => set({ editorFontFamily }),

      setStagingWidth: (stagingWidth) => set({ stagingWidth }),

      setEditorSplit: (editorSplit) => set({ editorSplit }),

      setStagingTemplateHeight: (stagingTemplateHeight) => set({ stagingTemplateHeight }),

      replaceAll: (partial) => set((s) => ({ ...s, ...partial })),
    }),
    { name: "ww:settings" },
  ),
);
