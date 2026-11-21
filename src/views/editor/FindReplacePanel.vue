<script setup lang="ts">
import { ref } from "vue";
import type * as monaco from "monaco-editor";
import ToolbarVisibilityMenu from "@/components/shared/ToolbarVisibilityMenu.vue";
import FindReplaceBar from "@/views/editor/FindReplaceBar.vue";
import ListToolsControls from "@/views/editor/ListToolsControls.vue";
import { EDITOR_TOOLBAR_GROUPS } from "@/views/editor/editorToolbarGroups";
import { useSettingsStore } from "@/stores/settings";

interface Props {
  focusedEditor: monaco.editor.IStandaloneCodeEditor | null;
}

defineProps<Props>();
const settingsStore = useSettingsStore();
const findReplaceRef = ref<InstanceType<typeof FindReplaceBar> | null>(null);

function updateHiddenEditorToolbarItems(ids: string[]) {
  settingsStore.setHiddenEditorToolbarItems(ids);
}

function open() {
  findReplaceRef.value?.open();
}

defineExpose({ open });
</script>

<template>
  <div class="rounded-lg border border-border bg-card p-1.5">
    <div class="flex min-w-0 items-center gap-2">
      <div
        data-ww-toolbar
        role="toolbar"
        aria-label="文本查找与处理"
        class="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 py-0.5 2xl:flex-nowrap 2xl:gap-2"
      >
        <FindReplaceBar ref="findReplaceRef" :focused-editor="focusedEditor" />
        <ListToolsControls :focused-editor="focusedEditor" />
      </div>

      <ToolbarVisibilityMenu
        :groups="EDITOR_TOOLBAR_GROUPS"
        :hidden-ids="settingsStore.hiddenEditorToolbarItems"
        title="自定义顶部工具栏"
        trigger-variant="outline"
        @update:hiddenIds="updateHiddenEditorToolbarItems"
      />
    </div>
  </div>
</template>
