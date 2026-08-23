<script setup lang="ts">
import { ref } from "vue";
import favicon from "@/assets/favicon.svg";
import ToolDialog from "@/components/shared/ToolDialog.vue";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  tooltipContentClass,
} from "@/components/ui/tooltip";
import { applyTool } from "@/lib/applyTool";
import { useToastStore } from "@/stores/toast";
import { tools, type GlobalTool } from "@/tools/registry";

/** 左侧竖向导航栏（Photoshop 式工具面板）：品牌区（竖排标题）+ 常用工具 */
const toast = useToastStore().push;
const dialogTool = ref<GlobalTool | null>(null);

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
  <aside
    class="flex w-12 shrink-0 flex-col items-center gap-1.5 border-r border-border bg-card py-2.5"
  >
    <!-- 品牌区：Logo + 中文左列 / 英文右列 竖排（底部对齐） -->
    <div class="flex shrink-0 flex-col items-center gap-2">
      <img :src="favicon" alt="With Work" class="h-8 w-8 rounded-full" />
      <div class="flex items-end gap-0">
        <span class="text-[11px] font-semibold leading-[1.5]" style="writing-mode: vertical-rl">
          一点微小的工作
        </span>
        <span
          class="text-[9px] leading-[1.5] text-muted-foreground"
          style="writing-mode: vertical-rl"
        >
          With Work
        </span>
      </div>
    </div>

    <div class="mt-1 h-px w-7 shrink-0 bg-border" />

    <!-- 常用工具（有选区处理选区，否则处理全文；Ctrl+Z 可撤销） -->
    <div class="flex min-h-0 w-full flex-1 flex-col items-center gap-1 overflow-y-auto pb-2">
      <Tooltip v-for="t in tools.filter((x) => !x.hideFromRail)" :key="t.id">
        <TooltipTrigger as-child>
          <button
            type="button"
            :title="t.name"
            @click="runTool(t)"
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <component :is="t.icon" class="size-5" />
          </button>
        </TooltipTrigger>
        <TooltipContent :class="tooltipContentClass" side="right">{{ t.name }}</TooltipContent>
      </Tooltip>
    </div>

    <ToolDialog :key="dialogTool?.id ?? 'none'" :tool="dialogTool" @close="dialogTool = null" />
  </aside>
</template>
