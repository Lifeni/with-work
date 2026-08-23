<script setup lang="ts">
import { onMounted, watch } from "vue";
import { TooltipProvider } from "@/components/ui/tooltip";
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
import { initTheme } from "@/lib/theme";

const wsStore = useWorkspaceStore();
const uiStore = useUiStore();

onMounted(() => {
  initTheme(useSettingsStore().theme);
});

// 工作区全部关闭后自动新建一个，保证主区域始终有内容
watch(
  () => wsStore.workspaces.length,
  (n) => {
    if (n === 0) wsStore.createWorkspace();
  },
  { immediate: true },
);
</script>

<template>
  <TooltipProvider :delay-duration="300">
    <div class="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <div class="flex min-h-0 flex-1">
        <ToolsRail />
        <div class="flex min-w-0 flex-1 flex-col">
          <TitleBar />
          <div class="flex min-h-0 flex-1">
            <!-- 编辑器常驻：切换工作区复用实例，避免重建闪烁 -->
            <main class="min-w-0 flex-1 overflow-hidden">
              <EditorView />
            </main>
          </div>
        </div>
        <StagingPanel />
      </div>
      <StatusBar />
      <SettingsDialog :open="uiStore.settingsOpen" @update:open="uiStore.setSettingsOpen($event)" />
      <ToastViewport />
    </div>
  </TooltipProvider>
</template>
