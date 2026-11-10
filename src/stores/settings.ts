import { ref } from "vue";
import { defineStore } from "pinia";
import type { AppSettings, ThemeMode } from "@/types";
import { applyTheme } from "@/lib/theme";
import { DEFAULT_FONT_FAMILY, DEFAULT_FONT_SIZE } from "@/lib/settingsMigration";
import { DEFAULT_HIDDEN_TEXT_TOOL_IDS } from "@/tools/toolbarVisibility";

// 默认值定义收敛在 lib/settingsMigration.ts（持久化恢复与备份导入共用）；
// 修改默认字号 / 字体请改那个文件，这里仅转出以兼容既有引用
export { DEFAULT_FONT_FAMILY };

export const useSettingsStore = defineStore("settings", () => {
  const theme = ref<ThemeMode>("system");
  const fontSize = ref(DEFAULT_FONT_SIZE);
  const wordWrap = ref(true);
  const editorFontFamily = ref(DEFAULT_FONT_FAMILY);
  const stagingWidth = ref<number | undefined>(undefined);
  const editorSplit = ref<number | undefined>(undefined);
  const stagingTemplateHeight = ref<number | undefined>(undefined);
  const hiddenEditorToolbarItems = ref<string[]>([]);
  const hiddenTextToolIds = ref<string[]>([...DEFAULT_HIDDEN_TEXT_TOOL_IDS]);

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

  function setHiddenEditorToolbarItems(ids: string[]) {
    hiddenEditorToolbarItems.value = [...new Set(ids)];
  }

  function setHiddenTextToolIds(ids: string[]) {
    hiddenTextToolIds.value = [...new Set(ids)];
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
    if (partial.hiddenEditorToolbarItems !== undefined) {
      setHiddenEditorToolbarItems(partial.hiddenEditorToolbarItems);
    }
    if (partial.hiddenTextToolIds !== undefined) {
      setHiddenTextToolIds(partial.hiddenTextToolIds);
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
    hiddenEditorToolbarItems,
    hiddenTextToolIds,
    setTheme,
    setFontSize,
    setWordWrap,
    setEditorFontFamily,
    setStagingWidth,
    setEditorSplit,
    setStagingTemplateHeight,
    setHiddenEditorToolbarItems,
    setHiddenTextToolIds,
    replaceAll,
  };
});
