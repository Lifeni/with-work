<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, onUnmounted, ref, watch } from "vue";
import type { Component } from "vue";
import { Download, FileText, Folder, Plus, Search, Settings, Unlink, X } from "@vicons/tabler";
import { applyTool } from "@/lib/applyTool";
import { exportBackup } from "@/lib/backup";
import { openRecentInNewWorkspace } from "@/lib/fileWorkspace";
import {
  findFileForWorkspace,
  loadRecentFiles,
  recentFiles,
  unbindFileForWorkspace,
} from "@/lib/recentFiles";
import { useToastStore } from "@/stores/toast";
import { useUiStore } from "@/stores/ui";
import { useWorkspaceStore } from "@/stores/workspace";
import { tools } from "@/tools/registry";

interface PaletteItem {
  id: string;
  label: string;
  description?: string;
  group: string;
  icon: Component;
  run: () => void | Promise<void>;
}

const uiStore = useUiStore();
const wsStore = useWorkspaceStore();
const toast = useToastStore().push;
const query = ref("");
const selected = ref(0);
const searchRef = ref<HTMLInputElement | null>(null);
const dialogRef = ref<HTMLDivElement | null>(null);
let previousFocus: HTMLElement | null = null;

const actionItems: PaletteItem[] = [
  {
    id: "action-new-workspace",
    label: "新建工作区",
    description: "创建一个空白工作区",
    group: "操作",
    icon: Plus,
    run: () => {
      wsStore.createWorkspace();
      toast("已新建工作区");
    },
  },
  {
    id: "action-open-file",
    label: "打开文本文件",
    description: "用系统文件选择器读取到新工作区",
    group: "操作",
    icon: Folder,
    run: () => window.dispatchEvent(new CustomEvent("ww-open-text-file")),
  },
  {
    id: "action-save-file",
    label: "保存当前工作区到文件",
    description: "绑定了原文件时直接写回，否则下载",
    group: "操作",
    icon: Download,
    run: () => window.dispatchEvent(new CustomEvent("ww-save-text-file")),
  },
  {
    id: "action-save-file-as",
    label: "另存为文本文件",
    description: "选择新位置并绑定当前工作区",
    group: "操作",
    icon: Download,
    run: () => window.dispatchEvent(new CustomEvent("ww-save-text-file-as")),
  },
  {
    id: "action-settings",
    label: "打开设置",
    group: "操作",
    icon: Settings,
    run: () => uiStore.setSettingsOpen(true),
  },
  {
    id: "action-export-backup",
    label: "导出全部备份",
    group: "数据",
    icon: Download,
    run: exportBackup,
  },
];

const toolItems = computed<PaletteItem[]>(() =>
  tools
    .filter((tool) => !tool.needsConfig)
    .map((tool) => ({
      id: `tool-${tool.id}`,
      label: tool.name,
      description: tool.description,
      group: "文本工具",
      icon: tool.icon,
      run: () => {
        if (!wsStore.activeId) wsStore.createWorkspace();
        const result = applyTool(tool, (input) => tool.run(input));
        toast(result?.message ?? "没有可处理的工作区");
      },
    })),
);

const workspaceItems = computed<PaletteItem[]>(() =>
  wsStore.workspaces.map((workspace) => ({
    id: `workspace-${workspace.id}`,
    label: workspace.name,
    description: workspace.id === wsStore.activeId ? "当前工作区" : "切换工作区",
    group: "工作区",
    icon: FileText,
    run: () => wsStore.setActive(workspace.id),
  })),
);

const recentFileItems = computed<PaletteItem[]>(() =>
  recentFiles.value.map((file) => ({
    id: `recent-file-${file.id}`,
    label: file.name,
    description: "从最近文件重新打开到新工作区",
    group: "最近文件",
    icon: FileText,
    run: async () => {
      const result = await openRecentInNewWorkspace(file);
      toast(result.ok ? `已打开「${result.name}」` : (result.error ?? "无法打开最近文件"));
    },
  })),
);

const bindingActionItems = computed<PaletteItem[]>(() => {
  const workspaceId = wsStore.activeId;
  const binding = workspaceId ? findFileForWorkspace(workspaceId) : undefined;
  if (!workspaceId || !binding) return [];
  return [
    {
      id: "action-unbind-file",
      label: "解除当前文件绑定",
      description: `以后 Ctrl/Cmd+S 将下载副本，不再覆盖「${binding.name}」`,
      group: "文件",
      icon: Unlink,
      run: async () => {
        await unbindFileForWorkspace(workspaceId);
        toast(`已解除「${binding.name}」的文件绑定`);
      },
    },
  ];
});

const allItems = computed(() => [
  ...actionItems,
  ...toolItems.value,
  ...recentFileItems.value,
  ...bindingActionItems.value,
  ...workspaceItems.value,
]);

const filteredItems = computed(() => {
  const keyword = query.value.trim().toLocaleLowerCase("zh-CN");
  if (!keyword) return allItems.value;
  return allItems.value.filter((item) =>
    `${item.label} ${item.description ?? ""} ${item.group}`
      .toLocaleLowerCase("zh-CN")
      .includes(keyword),
  );
});

watch([() => uiStore.commandPaletteOpen, filteredItems], () => {
  selected.value = 0;
});

watch(
  () => uiStore.commandPaletteOpen,
  (open) => {
    if (open) {
      previousFocus = document.activeElement as HTMLElement | null;
      uiStore.setSettingsOpen(false);
      query.value = "";
      selected.value = 0;
      document.body.style.overflow = "hidden";
      void nextTick(() => searchRef.value?.focus());
    } else {
      document.body.style.overflow = "";
      previousFocus?.focus();
      previousFocus = null;
    }
  },
);

onBeforeUnmount(() => {
  if (uiStore.commandPaletteOpen) document.body.style.overflow = "";
});

function close() {
  uiStore.setCommandPaletteOpen(false);
}

function execute(item: PaletteItem) {
  close();
  void item.run();
}

function onSearchKeydown(event: KeyboardEvent) {
  if (event.key === "ArrowDown") {
    event.preventDefault();
    if (filteredItems.value.length > 0) {
      selected.value = (selected.value + 1) % filteredItems.value.length;
    }
    return;
  }
  if (event.key === "ArrowUp") {
    event.preventDefault();
    if (filteredItems.value.length > 0) {
      selected.value =
        (selected.value - 1 + filteredItems.value.length) % filteredItems.value.length;
    }
    return;
  }
  if (event.key === "Enter") {
    event.preventDefault();
    const item = filteredItems.value[selected.value];
    if (item) execute(item);
    return;
  }
  if (event.key === "Escape") {
    event.preventDefault();
    close();
  }
}

function onDialogKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.preventDefault();
    close();
    return;
  }
  if (event.key !== "Tab") return;
  const focusables = [
    ...(dialogRef.value?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ) ?? []),
  ];
  if (focusables.length === 0) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function onGlobalKeydown(event: KeyboardEvent) {
  if (
    (event.ctrlKey || event.metaKey) &&
    !event.shiftKey &&
    !event.altKey &&
    event.key.toLowerCase() === "k"
  ) {
    event.preventDefault();
    event.stopPropagation();
    uiStore.setCommandPaletteOpen(!uiStore.commandPaletteOpen);
  }
}

onMounted(() => {
  void loadRecentFiles();
  window.addEventListener("keydown", onGlobalKeydown, true);
});
onUnmounted(() => window.removeEventListener("keydown", onGlobalKeydown, true));
</script>

<template>
  <Teleport to="body">
    <div
      v-if="uiStore.commandPaletteOpen"
      class="fixed inset-0 z-[2000] flex items-start justify-center bg-black/35 p-4 pt-[12vh]"
      @mousedown.self="close"
    >
      <div
        ref="dialogRef"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ww-command-title"
        class="ww-dialog-content ww-pop-in flex max-h-[75vh] w-full max-w-xl flex-col gap-3 rounded-lg border border-border bg-card p-4 text-card-foreground shadow-xl"
        @keydown="onDialogKeydown"
      >
        <div class="flex items-center justify-between gap-3">
          <div>
            <h2 id="ww-command-title" class="m-0 text-sm font-semibold">命令面板</h2>
            <p class="m-0 mt-0.5 text-xs text-muted-foreground">搜索工具、工作区或操作</p>
          </div>
          <button
            type="button"
            aria-label="关闭命令面板"
            class="rounded-sm p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            @click="close"
          >
            <X class="size-4" />
          </button>
        </div>
        <div class="flex items-center gap-2 rounded-md border border-border bg-background px-3">
          <Search class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            ref="searchRef"
            v-model="query"
            role="combobox"
            aria-label="搜索命令"
            aria-controls="ww-command-list"
            :aria-expanded="filteredItems.length > 0"
            :aria-activedescendant="filteredItems.length > 0 ? `ww-command-${selected}` : undefined"
            placeholder="搜索工具、工作区或操作…"
            class="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            @keydown="onSearchKeydown"
          />
          <kbd
            class="shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground"
          >
            Esc
          </kbd>
        </div>

        <div
          v-if="filteredItems.length > 0"
          id="ww-command-list"
          role="listbox"
          aria-label="命令结果"
          class="max-h-[55vh] overflow-y-auto"
        >
          <button
            v-for="(item, index) in filteredItems"
            :id="`ww-command-${index}`"
            :key="item.id"
            type="button"
            role="option"
            :aria-selected="index === selected"
            class="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors"
            :class="index === selected ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/60'"
            @mouseenter="selected = index"
            @click="execute(item)"
          >
            <component :is="item.icon" class="size-4 shrink-0 text-muted-foreground" />
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm">{{ item.label }}</span>
              <span v-if="item.description" class="block truncate text-xs text-muted-foreground">
                {{ item.description }}
              </span>
            </span>
            <span class="shrink-0 text-[10px] text-muted-foreground">{{ item.group }}</span>
          </button>
        </div>
        <p v-else class="py-8 text-center text-xs text-muted-foreground">没有匹配的命令</p>

        <p class="m-0 text-[10px] text-muted-foreground">↑↓ 选择 · Enter 执行 · Esc 关闭</p>
      </div>
    </div>
  </Teleport>
</template>
