<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import { LayoutSidebarLeftCollapse, LayoutSidebarLeftExpand, Plus, Trash, X } from "@vicons/tabler";
import { NDropdown } from "naive-ui";
import Button from "@/components/ui/button.vue";
import ConfirmDialog from "@/components/shared/ConfirmDialog.vue";
import {
  dropdownMenuProps,
  dropdownNodeProps,
  focusFirstDropdownItem,
  restoreDropdownTriggerFocus,
  toDropdownOptions,
  type DropdownItem,
} from "@/components/ui/dropdown";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/stores/workspace";
import { useUiStore } from "@/stores/ui";
import { useToastStore } from "@/stores/toast";
import type { Workspace } from "@/types";

/** 顶栏：暂存区开关 + 工作区标签页（新建/设置/数据入口已移至左侧品牌栏） */
const wsStore = useWorkspaceStore();
const uiStore = useUiStore();
const toast = useToastStore().push;

const renamingId = ref<string | null>(null);
const renameValue = ref("");
const confirmClearWorkspaces = ref(false);
const pendingCloseWorkspaces = ref<Workspace[]>([]);
const tabContextOpen = ref(false);
const tabContextX = ref(0);
const tabContextY = ref(0);
const tabContextId = ref<string | null>(null);
let tabContextTrigger: HTMLElement | null = null;
const tabContextMenuProps = dropdownMenuProps("工作区操作菜单");

const tabContextIndex = computed(() =>
  wsStore.workspaces.findIndex((workspace) => workspace.id === tabContextId.value),
);
const tabContextOptions = computed(() => {
  const index = tabContextIndex.value;
  const items: DropdownItem[] = [
    { key: "rename", label: "重命名" },
    { key: "close", label: "关闭" },
    { key: "separator-1", divider: true },
    {
      key: "close-others",
      label: "关闭其他",
      disabled: wsStore.workspaces.length <= 1,
    },
    {
      key: "close-right",
      label: "关闭右侧",
      disabled: index < 0 || index >= wsStore.workspaces.length - 1,
    },
  ];
  return toDropdownOptions(items);
});
const pendingCloseDescription = computed(() => {
  const targets = pendingCloseWorkspaces.value;
  if (targets.length === 0) return "";
  if (targets.length === 1) {
    return `工作区「${targets[0].name}」中还有内容，确定关闭吗？关闭后将丢失这些内容。`;
  }
  const nonEmptyCount = targets.filter(
    (workspace) => workspace.left?.trim() || workspace.right?.trim(),
  ).length;
  return `将关闭 ${targets.length} 个工作区，其中 ${nonEmptyCount} 个还有内容。关闭后将丢失这些内容，确定继续吗？`;
});

function commitRename(id: string, fallback: string) {
  wsStore.renameWorkspace(id, renameValue.value.trim() || fallback);
  renamingId.value = null;
}

function closeWorkspaces(targets: Workspace[]) {
  if (targets.length === 0) return;
  if (targets.some((workspace) => workspace.left?.trim() || workspace.right?.trim())) {
    pendingCloseWorkspaces.value = targets;
    return;
  }
  for (const workspace of targets) wsStore.deleteWorkspace(workspace.id);
}

/** 关闭工作区：有内容时先确认，空工作区直接关闭 */
function requestCloseWorkspace(workspace: Workspace) {
  closeWorkspaces([workspace]);
}

function confirmCloseWorkspaces() {
  const count = pendingCloseWorkspaces.value.length;
  for (const workspace of pendingCloseWorkspaces.value) wsStore.deleteWorkspace(workspace.id);
  if (count > 0) toast(count === 1 ? "已关闭工作区" : `已关闭 ${count} 个工作区`);
  pendingCloseWorkspaces.value = [];
}

function openTabContextAt(workspace: Workspace, x: number, y: number, trigger?: HTMLElement) {
  wsStore.setActive(workspace.id);
  uiStore.setSettingsOpen(false);
  tabContextTrigger = trigger ?? null;
  tabContextId.value = workspace.id;
  tabContextOpen.value = false;
  void nextTick(() => {
    tabContextX.value = x;
    tabContextY.value = y;
    tabContextOpen.value = true;
    focusFirstDropdownItem(tabContextTrigger);
  });
}

function openTabContextMenu(event: MouseEvent, workspace: Workspace) {
  event.preventDefault();
  event.stopPropagation();
  openTabContextAt(workspace, event.clientX, event.clientY, event.currentTarget as HTMLElement);
}

function openTabContextFromKeyboard(event: KeyboardEvent, workspace: Workspace) {
  if (event.key !== "ContextMenu" && !(event.shiftKey && event.key === "F10")) return;
  event.preventDefault();
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  openTabContextAt(workspace, rect.left + 24, rect.bottom, event.currentTarget as HTMLElement);
}

function handleTabKeydown(event: KeyboardEvent, workspace: Workspace) {
  openTabContextFromKeyboard(event, workspace);
  if (event.defaultPrevented || event.target !== event.currentTarget) return;

  const tabs = Array.from(
    (event.currentTarget as HTMLElement).parentElement?.querySelectorAll<HTMLElement>(
      '[role="tab"]',
    ) ?? [],
  );
  const currentIndex = tabs.indexOf(event.currentTarget as HTMLElement);
  if (currentIndex < 0) return;

  let nextIndex: number | null = null;
  if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % tabs.length;
  else if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
  else if (event.key === "Home") nextIndex = 0;
  else if (event.key === "End") nextIndex = tabs.length - 1;
  if (nextIndex === null) return;

  event.preventDefault();
  const nextTab = tabs[nextIndex];
  const nextId = wsStore.workspaces[nextIndex]?.id;
  if (!nextTab || !nextId) return;
  wsStore.setActive(nextId);
  uiStore.setSettingsOpen(false);
  void nextTick(() => {
    nextTab.focus();
    nextTab.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  });
}

function selectTabContext(key: string) {
  tabContextOpen.value = false;
  const index = tabContextIndex.value;
  const target = wsStore.workspaces.find((workspace) => workspace.id === tabContextId.value);
  if (!target) return;

  switch (key) {
    case "rename":
      renamingId.value = target.id;
      renameValue.value = target.name;
      break;
    case "close":
      requestCloseWorkspace(target);
      break;
    case "close-others":
      closeWorkspaces(wsStore.workspaces.filter((workspace) => workspace.id !== target.id));
      break;
    case "close-right":
      if (index >= 0) closeWorkspaces(wsStore.workspaces.slice(index + 1));
      break;
  }
  restoreDropdownTriggerFocus();
}

function updateTabContextOpen(show: boolean) {
  tabContextOpen.value = show;
  if (!show) restoreDropdownTriggerFocus();
}

function toggleStagingPanel() {
  const opening = !uiStore.stagingOpen;
  uiStore.setStagingOpen(opening);
  if (!opening || !window.matchMedia("(max-width: 1023px)").matches) return;
  void nextTick(() => {
    document
      .querySelector<HTMLElement>('#ww-staging-panel button[aria-label="折叠暂存区"]')
      ?.focus();
  });
}

/** 清空全部工作区（清完后自动新建一个空工作区） */
function clearWorkspaces() {
  for (const w of [...wsStore.workspaces]) wsStore.deleteWorkspace(w.id);
  confirmClearWorkspaces.value = false;
  toast("已清空全部工作区");
}
</script>

<template>
  <header class="flex h-9 shrink-0 items-stretch bg-card">
    <!-- 暂存区折叠 / 展开开关（暂存区在编辑器左侧） -->
    <div class="flex shrink-0 items-center border-b border-r border-border px-1.5">
      <Button
        variant="ghost"
        size="icon-sm"
        :title="uiStore.stagingOpen ? '收起暂存区' : '展开暂存区'"
        aria-controls="ww-staging-panel"
        :aria-expanded="uiStore.stagingOpen"
        :active="uiStore.stagingOpen"
        @click="toggleStagingPanel"
      >
        <LayoutSidebarLeftCollapse v-if="uiStore.stagingOpen" />
        <LayoutSidebarLeftExpand v-else />
      </Button>
    </div>

    <!-- 工作区标签页（VS Code 风格：满高矩形，激活标签顶部高亮、底部与内容区相连） -->
    <div class="no-scrollbar flex min-w-0 flex-1 items-stretch overflow-x-auto">
      <div role="tablist" aria-label="工作区标签" class="flex shrink-0 items-stretch">
        <template v-for="w in wsStore.workspaces" :key="w.id">
          <input
            v-if="renamingId === w.id"
            v-model="renameValue"
            autofocus
            aria-label="重命名工作区"
            @blur="commitRename(w.id, w.name)"
            @keydown.enter="commitRename(w.id, w.name)"
            @keydown.esc="renamingId = null"
            class="w-40 shrink-0 border-b border-primary bg-background px-3 text-xs outline-none"
          />
          <div
            v-else
            role="tab"
            :aria-label="w.name"
            aria-haspopup="menu"
            :aria-expanded="tabContextOpen && tabContextId === w.id"
            :tabindex="w.id === wsStore.activeId ? 0 : -1"
            :aria-selected="w.id === wsStore.activeId"
            @click="
              () => {
                wsStore.setActive(w.id);
                uiStore.setSettingsOpen(false);
              }
            "
            @dblclick="
              () => {
                renamingId = w.id;
                renameValue = w.name;
              }
            "
            @contextmenu="openTabContextMenu($event, w)"
            @keydown="handleTabKeydown($event, w)"
            :class="
              cn(
                'group relative flex min-w-24 max-w-52 shrink-0 cursor-pointer select-none items-center gap-1.5 pl-3 pr-1 text-xs transition-colors',
                w.id === wsStore.activeId && !uiStore.settingsOpen
                  ? 'border-r border-foreground/20 bg-background font-medium'
                  : 'border-b border-r border-border/60 text-muted-foreground hover:bg-accent/60',
              )
            "
          >
            <span
              v-if="w.id === wsStore.activeId && !uiStore.settingsOpen"
              class="absolute inset-x-0 top-0 h-0.5 bg-primary"
            />
            <span class="min-w-0 flex-1 truncate">{{ w.name }}</span>
            <!-- 关闭按钮：仅激活的工作区显示，靠近 tab 右缘 -->
            <button
              v-if="w.id === wsStore.activeId && !uiStore.settingsOpen"
              type="button"
              aria-label="关闭工作区"
              @click.stop="requestCloseWorkspace(w)"
              class="flex size-6 shrink-0 items-center justify-center rounded-sm hover:bg-muted"
            >
              <X class="size-3" />
            </button>
          </div>
        </template>
      </div>
      <div class="flex shrink-0 items-center border-b border-r border-border px-1.5">
        <Button
          variant="ghost"
          size="icon-sm"
          title="新建工作区"
          @click="wsStore.createWorkspace()"
        >
          <Plus />
        </Button>
      </div>
      <!-- 空白区域补齐底部边线（与各 tab 的 border-b 连成一线） -->
      <div aria-hidden class="min-w-4 flex-1 border-b border-border" />
    </div>

    <div class="flex shrink-0 items-center gap-1 border-b border-l border-border px-2">
      <Button
        variant="ghost"
        size="icon-sm"
        title="清空工作区"
        @click="confirmClearWorkspaces = true"
      >
        <Trash />
      </Button>
    </div>

    <NDropdown
      trigger="manual"
      size="small"
      placement="bottom-start"
      :show="tabContextOpen"
      :x="tabContextX"
      :y="tabContextY"
      :options="tabContextOptions"
      :menu-props="tabContextMenuProps"
      :node-props="dropdownNodeProps"
      @select="selectTabContext"
      @update:show="updateTabContextOpen"
      @clickoutside="updateTabContextOpen(false)"
    />

    <ConfirmDialog
      :open="pendingCloseWorkspaces.length > 0"
      title="关闭工作区"
      :description="pendingCloseDescription"
      confirm-text="关闭"
      destructive
      @confirm="confirmCloseWorkspaces"
      @cancel="pendingCloseWorkspaces = []"
    />
    <ConfirmDialog
      :open="confirmClearWorkspaces"
      title="清空工作区"
      :description="`确定清空全部 ${wsStore.workspaces.length} 个工作区吗？清空后将自动新建一个空工作区。`"
      confirm-text="清空"
      destructive
      @confirm="clearWorkspaces"
      @cancel="confirmClearWorkspaces = false"
    />
  </header>
</template>
