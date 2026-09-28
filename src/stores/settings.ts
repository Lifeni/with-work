import { ref } from "vue";
import { defineStore } from "pinia";
import type { AppSettings, ThemeMode } from "@/types";
import { applyTheme } from "@/lib/theme";
import { DEFAULT_FONT_FAMILY, DEFAULT_FONT_SIZE } from "@/lib/settingsMigration";

// 默认值定义收敛在 lib/settingsMigration.ts（持久化恢复与备份导入共用）
export { DEFAULT_FONT_FAMILY };

export const useSettingsStore = defineStore("settings", () => {
  const theme = ref<ThemeMode>("system");
  const fontSize = ref(DEFAULT_FONT_SIZE);
  const wordWrap = ref(true);
  const editorFontFamily = ref(DEFAULT_FONT_FAMILY);
  const stagingWidth = ref<number | undefined>(undefined);
  const editorSplit = ref<number | undefined>(undefined);
  const stagingTemplateHeight = ref<number | undefined>(undefined);

  function setTheme(mode: ThemeMode) {
    theme.value = mode;
    applyTheme(mode);
  }

  function setFontSize(size: number) {
    fontSize.value = size;
  }

  function setWordWrap(v: boolean) {
    wordWrap.value = v;
  }

  function setEditorFontFamily(family: string) {
    editorFontFamily.value = family;
  }

  function setStagingWidth(w: number) {
    stagingWidth.value = w;
  }

  function setEditorSplit(ratio: number) {
    editorSplit.value = ratio;
  }

  function setStagingTemplateHeight(h: number) {
    stagingTemplateHeight.value = h;
  }

  function replaceAll(partial: AppSettings) {
    if (partial.theme !== undefined) theme.value = partial.theme;
    if (partial.fontSize !== undefined) fontSize.value = partial.fontSize;
    if (partial.wordWrap !== undefined) wordWrap.value = partial.wordWrap;
    if (partial.editorFontFamily !== undefined) editorFontFamily.value = partial.editorFontFamily;
    if (partial.stagingWidth !== undefined) stagingWidth.value = partial.stagingWidth;
    if (partial.editorSplit !== undefined) editorSplit.value = partial.editorSplit;
    if (partial.stagingTemplateHeight !== undefined) {
      stagingTemplateHeight.value = partial.stagingTemplateHeight;
    }
  }

  return {
    theme,
    fontSize,
    wordWrap,
    editorFontFamily,
    stagingWidth,
    editorSplit,
    stagingTemplateHeight,
    setTheme,
    setFontSize,
    setWordWrap,
    setEditorFontFamily,
    setStagingWidth,
    setEditorSplit,
    setStagingTemplateHeight,
    replaceAll,
  };
});
