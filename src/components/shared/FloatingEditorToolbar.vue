<script setup lang="ts">
import { ref } from "vue";
import { ArrowBackUp, ArrowForwardUp } from "@vicons/tabler";
import Button from "@/components/ui/button.vue";
import ToolDialog from "@/components/shared/ToolDialog.vue";
import { applyTool } from "@/lib/applyTool";
import { getActiveEditor } from "@/lib/editorBridge";
import { useToastStore } from "@/stores/toast";
import { tools, type GlobalTool } from "@/tools/registry";

/**
 * 悬浮工具栏：跟随聚焦的编辑器，悬浮在其底部。
 * 文本工具（选区优先，无选区处理全文，Ctrl+Z 可撤销）+ 撤销/重做。
 */
const toast = useToastStore().push;

const dialogTool = ref<GlobalTool | null>(null);

const undoFocused = () => getActiveEditor()?.trigger("toolbar", "undo", null);
const redoFocused = () => getActiveEditor()?.trigger("toolbar", "redo", null);

function runTool(tool: GlobalTool) {
  if (tool.needsConfig) {
    dialogTool.value = tool;
    return;
  }
  const res = applyTool(tool, (input) => tool.run(input));
  if (res) toast(res.message);
}
</script>

<template>
  <div
    class="pointer-events-auto absolute bottom-2 left-1/2 z-20 flex max-w-[calc(100%-16px)] -translate-x-1/2 items-center gap-0.5 overflow-x-auto rounded-lg border border-border bg-card px-1.5 py-1 shadow-lg no-scrollbar ww-pop-in"
  >
    <!-- 文本工具（选区优先，无选区处理全文） -->
    <template v-for="t in tools.filter((x) => !x.hideFromRail)" :key="t.id">
      <Button
        variant="ghost"
        size="icon-sm"
        :title="t.name"
        @click="runTool(t)"
        class="shrink-0"
      >
        <component :is="t.icon" />
      </Button>
    </template>

    <span class="mx-0.5 h-4 w-px shrink-0 bg-border" />

    <Button variant="ghost" size="icon-sm" title="撤销 (Ctrl+Z)" class="shrink-0" @click="undoFocused">
      <ArrowBackUp />
    </Button>
    <Button variant="ghost" size="icon-sm" title="重做" class="shrink-0" @click="redoFocused">
      <ArrowForwardUp />
    </Button>
  </div>

  <ToolDialog :key="dialogTool?.id ?? 'none'" :tool="dialogTool" @close="dialogTool = null" />
</template>