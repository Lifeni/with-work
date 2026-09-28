<script setup lang="ts">
import { ref } from "vue";
import { LayoutSidebarLeftCollapse, LayoutSidebarLeftExpand, Plus, Trash, X } from "@vicons/tabler";
import Button from "@/components/ui/button.vue";
import ConfirmDialog from "@/components/shared/ConfirmDialog.vue";
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
const pendingCloseWorkspace = ref<{ id: string; name: string } | null>(null);

function commitRename(id: string, fallback: string) {
  wsStore.renameWorkspace(id, renameValue.value.trim() || fallback);
  renamingId.value = null;
}

/** 关闭工作区：有内容时先确认，空工作区直接关闭 */
function requestCloseWorkspace(w: Workspace) {
  if (w.left?.trim() || w.right?.trim()) {
    pendingCloseWorkspace.value = { id: w.id, name: w.name };
  } else {
    wsStore.deleteWorkspace(w.id);
  }
}

function confirmCloseWorkspace() {
  if (pendingCloseWorkspace.value) {
    wsStore.deleteWorkspace(pendingCloseWorkspace.value.id);
    toast("已关闭工作区");
  }
  pendingCloseWorkspace.value = null;
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
        :active="uiStore.stagingOpen"
        @click="uiStore.setStagingOpen(!uiStore.stagingOpen)"
      >
        <LayoutSidebarLeftCollapse v-if="uiStore.stagingOpen" />
        <LayoutSidebarLeftExpand v-else />
      </Button>
    </div>

    <!-- 工作区标签页（VS Code 风格：满高矩形，激活标签顶部高亮、底部与内容区相连） -->
    <div class="no-scrollbar flex min-w-0 flex-1 items-stretch overflow-x-auto">
      <template v-for="w in wsStore.workspaces" :key="w.id">
        <input
          v-if="renamingId === w.id"
          v-model="renameValue"
          autofocus
          @blur="commitRename(w.id, w.name)"
          @keydown.enter="commitRename(w.id, w.name)"
          @keydown.esc="renamingId = null"
          class="w-40 shrink-0 border-b border-primary bg-background px-3 text-xs outline-none"
        />
        <div
          v-else
          role="tab"
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
            title="关闭工作区"
            @click.stop="requestCloseWorkspace(w)"
            class="shrink-0 rounded-sm p-0.5 hover:bg-muted"
          >
            <X class="size-3" />
          </button>
        </div>
      </template>
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

    <ConfirmDialog
      :open="pendingCloseWorkspace !== null"
      title="关闭工作区"
      :description="
        pendingCloseWorkspace
          ? `工作区「${pendingCloseWorkspace.name}」中还有内容，确定关闭吗？关闭后将丢失这些内容。`
          : undefined
      "
      confirm-text="关闭"
      destructive
      @confirm="confirmCloseWorkspace"
      @cancel="pendingCloseWorkspace = null"
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
