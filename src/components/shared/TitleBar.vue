<script setup lang="ts">
import { computed, ref, type Component } from "vue";
import {
  Download,
  FileCode,
  FileText,
  Folder,
  DeviceFloppy,
  Moon,
  Plus,
  ArrowForwardUp,
  Settings,
  Sun,
  Trash,
  ArrowBackUp,
  Upload,
  TextWrap,
  X,
} from "@vicons/tabler";
import Button from "@/components/ui/button.vue";
import ConfirmDialog from "@/components/shared/ConfirmDialog.vue";
import DropdownMenu from "@/components/ui/dropdown-menu.vue";

interface MenuItem {
  key: string;
  label?: string;
  icon?: Component;
  danger?: boolean;
  checked?: boolean;
  divider?: boolean;
}
import { cn } from "@/lib/utils";
import { getActiveEditor } from "@/lib/editorBridge";
import { useWorkspaceStore } from "@/stores/workspace";
import { useSettingsStore } from "@/stores/settings";
import { useUiStore } from "@/stores/ui";
import { useToastStore } from "@/stores/toast";
import {
  applyBackup,
  clearAllData,
  exportBackup,
  exportCurrentWorkspace,
  exportRules,
  exportTemplates,
  parseBackup,
  parseRules,
  parseTemplates,
} from "@/lib/backup";
import { useRulesStore } from "@/stores/rules";
import { useTemplatesStore } from "@/stores/templates";
import type { BackupData, ThemeMode } from "@/types";

const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: "light", label: "浅色" },
  { value: "dark", label: "深色" },
  { value: "system", label: "跟随系统" },
];

/** 主题菜单项（当前主题打勾） */
const themeMenuOptions = computed<MenuItem[]>(() =>
  THEME_OPTIONS.map((opt) => ({
    key: opt.value,
    label: opt.label,
    checked: settingsStore.theme === opt.value,
  })),
);

/** 数据菜单项（导入 / 导出 / 备份 / 清空） */
const dataMenuOptions: MenuItem[] = [
  { key: "export-backup", label: "导出全部备份", icon: Download },
  { key: "import-backup", label: "导入备份", icon: Upload },
  { key: "sep1", divider: true },
  { key: "export-rules", label: "导出替换规则", icon: FileCode },
  { key: "import-rules", label: "导入替换规则", icon: Folder },
  { key: "sep2", divider: true },
  { key: "export-templates", label: "导出排序模板", icon: FileCode },
  { key: "import-templates", label: "导入排序模板", icon: Folder },
  { key: "sep3", divider: true },
  { key: "export-workspace", label: "导出当前工作区", icon: FileText },
  { key: "sep4", divider: true },
  { key: "clear-all", label: "清空所有数据", icon: Trash, danger: true },
];

function onDataMenuSelect(key: string) {
  switch (key) {
    case "export-backup":
      exportBackup();
      break;
    case "import-backup":
      backupRef.value?.click();
      break;
    case "export-rules":
      exportRules();
      break;
    case "import-rules":
      rulesRef.value?.click();
      break;
    case "export-templates":
      exportTemplates();
      break;
    case "import-templates":
      templatesRef.value?.click();
      break;
    case "export-workspace":
      exportCurrentWorkspace();
      break;
    case "clear-all":
      confirmClearAll.value = true;
      break;
  }
}

const wsStore = useWorkspaceStore();
const settingsStore = useSettingsStore();
const uiStore = useUiStore();
const rulesStore = useRulesStore();
const templatesStore = useTemplatesStore();
const toast = useToastStore().push;

const renamingId = ref<string | null>(null);
const renameValue = ref("");
const pendingBackup = ref<BackupData | null>(null);
const confirmImport = ref(false);
const confirmClearAll = ref(false);
const backupRef = ref<HTMLInputElement | null>(null);
const rulesRef = ref<HTMLInputElement | null>(null);
const templatesRef = ref<HTMLInputElement | null>(null);

function commitRename(id: string, fallback: string) {
  wsStore.renameWorkspace(id, renameValue.value.trim() || fallback);
  renamingId.value = null;
}

/** 编辑操作（作用于当前聚焦的编辑器） */
const undoFocused = () => getActiveEditor()?.trigger("toolbar", "undo", null);
const redoFocused = () => getActiveEditor()?.trigger("toolbar", "redo", null);

const onBackupFile = (e: Event) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  void file.text().then((raw) => {
    const res = parseBackup(raw);
    if (!res.ok) {
      toast(res.error);
      return;
    }
    pendingBackup.value = res.data;
    confirmImport.value = true;
  });
};

const onRulesFile = (e: Event) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  void file.text().then((raw) => {
    const res = parseRules(raw);
    if (!res.ok) {
      toast(res.error);
      return;
    }
    rulesStore.replaceAll(res.rules);
    toast(`已导入 ${res.rules.length} 条替换规则`);
  });
};

const onTemplatesFile = (e: Event) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  void file.text().then((raw) => {
    const res = parseTemplates(raw);
    if (!res.ok) {
      toast(res.error);
      return;
    }
    templatesStore.replaceAll(res.templates);
    toast(`已导入 ${res.templates.length} 个排序模板`);
  });
};
</script>

<template>
  <header class="flex h-9 shrink-0 items-stretch bg-card">
    <!-- 编辑操作：撤销 / 重做 / 自动换行（作用于聚焦编辑器） -->
    <div class="flex shrink-0 items-center gap-0.5 border-b border-r border-border px-1.5">
      <Button variant="ghost" size="icon-sm" title="撤销 (Ctrl+Z)" @click="undoFocused">
        <ArrowBackUp />
      </Button>
      <Button variant="ghost" size="icon-sm" title="重做" @click="redoFocused">
        <ArrowForwardUp />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        :title="settingsStore.wordWrap ? '自动换行：开启' : '自动换行：关闭'"
        @click="settingsStore.setWordWrap(!settingsStore.wordWrap)"
        :active="settingsStore.wordWrap"
      >
        <TextWrap class="size-3.5" />
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
              'group relative flex min-w-24 max-w-52 shrink-0 cursor-pointer select-none items-center gap-1.5 border-r border-border/60 px-3 text-xs transition-colors',
              w.id === wsStore.activeId && !uiStore.settingsOpen
                ? 'bg-background font-medium'
                : 'border-b border-border text-muted-foreground hover:bg-accent/60',
            )
          "
        >
          <span
            v-if="w.id === wsStore.activeId && !uiStore.settingsOpen"
            class="absolute inset-x-0 top-0 h-0.5 bg-primary"
          />
          <span class="truncate">{{ w.name }}</span>
          <button
            type="button"
            title="关闭工作区"
            @click.stop="wsStore.deleteWorkspace(w.id)"
            class="rounded-sm p-0.5 opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
          >
            <X class="size-3" />
          </button>
        </div>
      </template>
      <button
        type="button"
        title="新建工作区"
        @click="wsStore.createWorkspace()"
        class="flex shrink-0 items-center border-b border-border px-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      >
        <Plus class="size-4" />
      </button>
      <!-- 空白区域补齐底部边线（与各 tab 的 border-b 连成一线） -->
      <div aria-hidden class="min-w-4 flex-1 border-b border-border" />
    </div>

    <div class="flex shrink-0 items-center gap-1 border-b border-l border-border px-2">
      <DropdownMenu
        :options="themeMenuOptions"
        @select="settingsStore.setTheme($event as ThemeMode)"
      >
        <button
          type="button"
          aria-label="切换主题"
          class="flex h-7 w-7 items-center justify-center rounded-md bg-transparent text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <Moon v-if="settingsStore.theme === 'dark'" class="size-3.5" />
          <Sun v-else class="size-3.5" />
        </button>
      </DropdownMenu>

      <DropdownMenu :options="dataMenuOptions" @select="onDataMenuSelect">
        <button
          type="button"
          aria-label="数据（导入 / 导出 / 备份）"
          class="flex h-7 w-7 items-center justify-center rounded-md bg-transparent text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <DeviceFloppy />
        </button>
      </DropdownMenu>

      <Button
        variant="ghost"
        size="icon-sm"
        title="设置"
        :aria-pressed="uiStore.settingsOpen"
        @click="uiStore.setSettingsOpen(!uiStore.settingsOpen)"
        :active="uiStore.settingsOpen"
      >
        <Settings class="size-3.5" />
      </Button>
    </div>

    <input
      ref="backupRef"
      type="file"
      accept=".json,application/json"
      class="hidden"
      @change="onBackupFile"
    />
    <input
      ref="rulesRef"
      type="file"
      accept=".json,application/json"
      class="hidden"
      @change="onRulesFile"
    />
    <input
      ref="templatesRef"
      type="file"
      accept=".json,application/json"
      class="hidden"
      @change="onTemplatesFile"
    />

    <ConfirmDialog
      :open="confirmImport"
      title="导入备份"
      description="导入备份将覆盖当前的全部数据（工作区、暂存区、规则、模板、设置），确定继续吗？"
      confirm-text="覆盖导入"
      destructive
      @confirm="
        () => {
          if (pendingBackup) {
            applyBackup(pendingBackup);
            toast('备份已导入');
          }
          confirmImport = false;
          pendingBackup = null;
        }
      "
      @cancel="
        () => {
          confirmImport = false;
          pendingBackup = null;
        }
      "
    />
    <ConfirmDialog
      :open="confirmClearAll"
      title="清空所有数据"
      description="将删除本地保存的全部工作区、暂存区、规则与设置，此操作不可恢复。"
      confirm-text="全部清空"
      destructive
      @confirm="clearAllData()"
      @cancel="confirmClearAll = false"
    />
  </header>
</template>
