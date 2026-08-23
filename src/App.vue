<script setup lang="ts">
import { computed, onMounted, watch } from "vue";
import {
  NConfigProvider,
  dateZhCN,
  darkTheme,
  lightTheme,
  zhCN,
  type GlobalThemeOverrides,
} from "naive-ui";
import TitleBar from "@/components/shared/TitleBar.vue";
import ToolsRail from "@/components/shared/ToolsRail.vue";
import StatusBar from "@/components/shared/StatusBar.vue";
import StagingPanel from "@/components/shared/StagingPanel.vue";
import SettingsDialog from "@/components/shared/SettingsDialog.vue";
import ToastViewport from "@/components/shared/ToastViewport.vue";
import EditorView from "@/views/editor/EditorView.vue";
import { useWorkspaceStore } from "@/stores/workspace";
import { useSettingsStore } from "@/stores/settings";
import { useUiStore } from "@/stores/ui";
import { initTheme, resolveTheme } from "@/lib/theme";

const wsStore = useWorkspaceStore();
const uiStore = useUiStore();
const settingsStore = useSettingsStore();

onMounted(() => {
  initTheme(settingsStore.theme);
});

// 工作区全部关闭后自动新建一个，保证主区域始终有内容
watch(
  () => wsStore.workspaces.length,
  (n) => {
    if (n === 0) wsStore.createWorkspace();
  },
  { immediate: true },
);

// Naive UI 主题：与自身主题设置联动；主色对齐品牌图标（粉紫）色系
const naiveTheme = computed(() =>
  resolveTheme(settingsStore.theme) === "dark" ? darkTheme : lightTheme,
);
const themeOverrides = computed<GlobalThemeOverrides>(() => {
  const dark = resolveTheme(settingsStore.theme) === "dark";
  return {
    common: {
      // 覆盖 Naive 注入到 body 的默认字体，与项目 Inter 字体栈保持一致
      fontFamily: [
        "Inter",
        "MiSans",
        "HarmonyOS Sans SC",
        "Source Han Sans SC",
        "Noto Sans SC",
        "system-ui",
        "-apple-system",
        "Segoe UI",
        "sans-serif",
      ].join(","),
      primaryColor: dark ? "#a78bfa" : "#6d28d9",
      primaryColorHover: dark ? "#c4b5fd" : "#7c3aed",
      primaryColorPressed: dark ? "#a78bfa" : "#5b21b6",
      primaryColorSuppl: dark ? "#a78bfa" : "#6d28d9",
      borderRadius: "6px",
    },
  };
});
</script>

<template>
  <NConfigProvider
    :theme="naiveTheme"
    :theme-overrides="themeOverrides"
    :locale="zhCN"
    :date-locale="dateZhCN"
  >
    <div class="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <div class="flex min-h-0 flex-1">
        <ToolsRail />
        <!-- 暂存区（全局共用）在编辑器左侧；窄屏降级为左侧悬浮抽屉 -->
        <StagingPanel />
        <div class="flex min-w-0 flex-1 flex-col">
          <TitleBar />
          <div class="flex min-h-0 flex-1">
            <!-- 编辑器常驻：切换工作区复用实例，避免重建闪烁 -->
            <main class="min-w-0 flex-1 overflow-hidden">
              <EditorView />
            </main>
          </div>
        </div>
      </div>
      <StatusBar />
      <SettingsDialog :open="uiStore.settingsOpen" @update:open="uiStore.setSettingsOpen($event)" />
      <ToastViewport />
    </div>
  </NConfigProvider>
</template>
