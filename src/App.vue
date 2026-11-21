<script setup lang="ts">
import {
  computed,
  defineAsyncComponent,
  defineComponent,
  h,
  onBeforeUnmount,
  onMounted,
  watch,
} from "vue";
import { NConfigProvider, dateZhCN, darkTheme, lightTheme, zhCN } from "naive-ui";
import TitleBar from "@/components/shared/TitleBar.vue";
import ToolsRail from "@/components/shared/ToolsRail.vue";
import StatusBar from "@/components/shared/StatusBar.vue";
import StagingPanel from "@/components/shared/StagingPanel.vue";
import SettingsDialog from "@/components/shared/SettingsDialog.vue";
import ToastViewport from "@/components/shared/ToastViewport.vue";
import PwaUpdatePrompt from "@/components/shared/PwaUpdatePrompt.vue";
import CommandPalette from "@/components/shared/CommandPalette.vue";
import { useWorkspaceStore } from "@/stores/workspace";
import { useSettingsStore } from "@/stores/settings";
import { useUiStore } from "@/stores/ui";
import { startMultiTabGuard } from "@/lib/multiTab";
import { createNaiveThemeOverrides } from "@/lib/naiveTheme";
import { initTheme, resolveTheme } from "@/lib/theme";

const EditorLoading = defineComponent({
  name: "EditorLoading",
  setup: () => () =>
    h(
      "div",
      { class: "flex h-full items-center justify-center text-xs text-muted-foreground" },
      "正在加载编辑器…",
    ),
});

const EditorView = defineAsyncComponent({
  loader: () => import("@/views/editor/EditorView.vue"),
  loadingComponent: EditorLoading,
  delay: 0,
});

const wsStore = useWorkspaceStore();
const uiStore = useUiStore();
const settingsStore = useSettingsStore();
const pwaUpdateEnabled = import.meta.env.PROD;
let stopMultiTabGuard: (() => void) | null = null;

onMounted(() => {
  initTheme(settingsStore.theme);
  stopMultiTabGuard = startMultiTabGuard();
});

onBeforeUnmount(() => {
  stopMultiTabGuard?.();
  stopMultiTabGuard = null;
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
const resolvedTheme = computed(() => resolveTheme(settingsStore.theme));
const naiveTheme = computed(() => (resolvedTheme.value === "dark" ? darkTheme : lightTheme));
const themeOverrides = computed(() => createNaiveThemeOverrides(resolvedTheme.value === "dark"));
</script>

<template>
  <NConfigProvider
    :theme="naiveTheme"
    :theme-overrides="themeOverrides"
    :locale="zhCN"
    :date-locale="dateZhCN"
  >
    <div class="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <a
        href="#ww-editor-main"
        class="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[300] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-xs focus:text-primary-foreground focus:shadow-lg"
      >
        跳到编辑器
      </a>
      <h1 class="sr-only">一点微小的工作</h1>
      <div class="flex min-h-0 flex-1">
        <ToolsRail />
        <!-- 暂存区（全局共用）在编辑器左侧；窄屏降级为左侧悬浮抽屉 -->
        <StagingPanel />
        <div class="flex min-w-0 flex-1 flex-col">
          <TitleBar />
          <div class="flex min-h-0 flex-1">
            <!-- 编辑器常驻：切换工作区复用实例，避免重建闪烁 -->
            <main
              id="ww-editor-main"
              aria-label="编辑器工作区"
              tabindex="-1"
              class="min-w-0 flex-1 overflow-hidden"
            >
              <EditorView />
            </main>
          </div>
        </div>
      </div>
      <StatusBar />
      <SettingsDialog :open="uiStore.settingsOpen" @update:open="uiStore.setSettingsOpen($event)" />
      <PwaUpdatePrompt :enabled="pwaUpdateEnabled" />
      <ToastViewport />
      <CommandPalette />
    </div>
  </NConfigProvider>
</template>
