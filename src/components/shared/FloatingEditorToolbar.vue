<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import { ArrowBackUp, ArrowForwardUp, EyeOff, PlayerPlay, Settings } from "@vicons/tabler";
import { NDropdown } from "naive-ui";
import Button from "@/components/ui/button.vue";
import ToolDialog from "@/components/shared/ToolDialog.vue";
import ToolbarVisibilityMenu from "@/components/shared/ToolbarVisibilityMenu.vue";
import {
  dropdownMenuProps,
  dropdownNodeProps,
  focusFirstDropdownItem,
  restoreDropdownTriggerFocus,
  toDropdownOptions,
} from "@/components/ui/dropdown";
import { applyTool } from "@/lib/applyTool";
import { getActiveEditor } from "@/lib/editorBridge";
import { useSettingsStore } from "@/stores/settings";
import { useToastStore } from "@/stores/toast";
import { tools, type GlobalTool, type ToolCategory } from "@/tools/registry";
import type { ToolbarVisibilityGroup } from "@/tools/toolbarVisibility";

/**
 * 悬浮工具栏：跟随聚焦的编辑器，悬浮在其底部。
 * 文本工具（选区优先，无选区处理全文，Ctrl+Z 可撤销）+ 撤销/重做。
 */
const toast = useToastStore().push;
const settingsStore = useSettingsStore();

const dialogTool = ref<GlobalTool | null>(null);
const contextTool = ref<GlobalTool | null>(null);
const contextShow = ref(false);
const contextX = ref(0);
const contextY = ref(0);
let contextTrigger: HTMLElement | null = null;
const contextMenuProps = dropdownMenuProps("工具操作菜单");

const TOOL_CATEGORIES: ToolCategory[] = ["行处理", "文本转换", "分割与规则"];
const visibilityGroups: ToolbarVisibilityGroup[] = TOOL_CATEGORIES.map((category) => ({
  key: category,
  label: category,
  items: tools
    .filter((tool) => tool.category === category)
    .map((tool) => ({ id: tool.id, label: tool.name, icon: tool.icon })),
}));
const defaultHiddenToolIds = tools.filter((tool) => tool.defaultHidden).map((tool) => tool.id);
const visibleTools = computed(() =>
  tools.filter((tool) => !settingsStore.hiddenTextToolIds.includes(tool.id)),
);
const contextMenuOptions = computed(() =>
  toDropdownOptions([
    ...(contextTool.value
      ? [
          { key: "run", label: "运行工具", icon: PlayerPlay },
          ...(contextTool.value.needsConfig
            ? [{ key: "configure", label: "打开配置…", icon: Settings }]
            : []),
          { key: "separator", divider: true },
          { key: "hide", label: "从工具栏隐藏", icon: EyeOff },
        ]
      : []),
  ]),
);

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

function updateHiddenTextTools(ids: string[]) {
  settingsStore.setHiddenTextToolIds(ids);
}

function openToolContextMenu(event: MouseEvent, tool: GlobalTool) {
  event.preventDefault();
  event.stopPropagation();
  contextTool.value = tool;
  contextTrigger = event.currentTarget as HTMLElement;
  contextShow.value = false;
  void nextTick(() => {
    contextX.value = event.clientX;
    contextY.value = event.clientY;
    contextShow.value = true;
    focusFirstDropdownItem(contextTrigger);
  });
}

function openToolContextFromKeyboard(event: KeyboardEvent, tool: GlobalTool) {
  if (event.key !== "ContextMenu" && !(event.shiftKey && event.key === "F10")) return;
  event.preventDefault();
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  contextTool.value = tool;
  contextTrigger = event.currentTarget as HTMLElement;
  contextShow.value = false;
  void nextTick(() => {
    contextX.value = rect.left;
    contextY.value = rect.bottom;
    contextShow.value = true;
    focusFirstDropdownItem(contextTrigger);
  });
}

function selectToolContext(key: string | number) {
  const tool = contextTool.value;
  contextShow.value = false;
  if (!tool) return;

  if (key === "run") {
    runTool(tool);
  } else if (key === "configure") {
    dialogTool.value = tool;
  } else if (key === "hide") {
    settingsStore.setHiddenTextToolIds([...settingsStore.hiddenTextToolIds, tool.id]);
    toast(`已从工具栏隐藏「${tool.name}」`);
  }
  restoreDropdownTriggerFocus();
}
</script>

<template>
  <div
    class="pointer-events-auto absolute bottom-2 left-1/2 z-20 flex max-w-[calc(100%-16px)] -translate-x-1/2 items-center gap-0.5 overflow-x-auto rounded-lg border border-border bg-card px-1.5 py-1 shadow-lg no-scrollbar ww-pop-in"
  >
    <!-- 文本工具（选区优先，无选区处理全文） -->
    <template v-for="t in visibleTools" :key="t.id">
      <Button
        variant="ghost"
        size="icon-sm"
        :title="t.name"
        @click="runTool(t)"
        @contextmenu="openToolContextMenu($event, t)"
        @keydown="openToolContextFromKeyboard($event, t)"
        class="shrink-0"
      >
        <component :is="t.icon" />
      </Button>
    </template>

    <ToolbarVisibilityMenu
      :groups="visibilityGroups"
      :hidden-ids="settingsStore.hiddenTextToolIds"
      :default-hidden-ids="defaultHiddenToolIds"
      title="自定义文字工具栏"
      @update:hiddenIds="updateHiddenTextTools"
    />

    <span class="mx-0.5 h-4 w-px shrink-0 bg-border" />

    <Button
      variant="ghost"
      size="icon-sm"
      title="撤销 (Ctrl+Z)"
      class="shrink-0"
      @click="undoFocused"
    >
      <ArrowBackUp />
    </Button>
    <Button variant="ghost" size="icon-sm" title="重做" class="shrink-0" @click="redoFocused">
      <ArrowForwardUp />
    </Button>
  </div>

  <NDropdown
    trigger="manual"
    size="small"
    placement="bottom-start"
    :show="contextShow"
    :x="contextX"
    :y="contextY"
    :options="contextMenuOptions"
    :menu-props="contextMenuProps"
    :node-props="dropdownNodeProps"
    @select="selectToolContext"
    @update:show="
      (show: boolean) => {
        contextShow = show;
        if (!show) restoreDropdownTriggerFocus();
      }
    "
    @clickoutside="
      () => {
        contextShow = false;
        restoreDropdownTriggerFocus();
      }
    "
  />

  <ToolDialog :key="dialogTool?.id ?? 'none'" :tool="dialogTool" @close="dialogTool = null" />
</template>
