<script setup lang="ts">
import { ref } from "vue";
import {
  Check,
  Download,
  FileCode2,
  FileText,
  FolderOpen,
  HardDrive,
  Moon,
  Plus,
  Redo2,
  Settings,
  Sun,
  Trash2,
  Undo2,
  Upload,
  WrapText,
  X,
} from "@lucide/vue";
import Button from "@/components/ui/button.vue";
import ConfirmDialog from "@/components/shared/ConfirmDialog.vue";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  dropdownContentClass,
  dropdownItemClass,
} from "@/components/ui/dropdown-menu";
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
        <Undo2 />
      </Button>
      <Button variant="ghost" size="icon-sm" title="重做" @click="redoFocused">
        <Redo2 />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        :title="settingsStore.wordWrap ? '自动换行：开启' : '自动换行：关闭'"
        @click="settingsStore.setWordWrap(!settingsStore.wordWrap)"
        :class="cn(settingsStore.wordWrap && 'bg-accent text-accent-foreground')"
      >
        <WrapText class="size-3.5" />
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
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button variant="ghost" size="icon-sm" title="切换主题">
            <Moon v-if="settingsStore.theme === 'dark'" class="size-3.5" />
            <Sun v-else class="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" :class="cn(dropdownContentClass, 'w-32')">
          <DropdownMenuItem
            v-for="opt in THEME_OPTIONS"
            :key="opt.value"
            @select="settingsStore.setTheme(opt.value)"
            :class="dropdownItemClass"
          >
            <span class="flex-1">{{ opt.label }}</span>
            <Check v-if="settingsStore.theme === opt.value" class="size-3.5" />
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button variant="ghost" size="icon-sm" title="数据（导入 / 导出 / 备份）">
            <HardDrive />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" :class="cn(dropdownContentClass, 'w-48')">
          <DropdownMenuItem :class="dropdownItemClass" @select="exportBackup">
            <Download /> 导出全部备份
          </DropdownMenuItem>
          <DropdownMenuItem :class="dropdownItemClass" @select="backupRef?.click()">
            <Upload /> 导入备份
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem :class="dropdownItemClass" @select="exportRules">
            <FileCode2 /> 导出替换规则
          </DropdownMenuItem>
          <DropdownMenuItem :class="dropdownItemClass" @select="rulesRef?.click()">
            <FolderOpen /> 导入替换规则
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem :class="dropdownItemClass" @select="exportTemplates">
            <FileCode2 /> 导出排序模板
          </DropdownMenuItem>
          <DropdownMenuItem :class="dropdownItemClass" @select="templatesRef?.click()">
            <FolderOpen /> 导入排序模板
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem :class="dropdownItemClass" @select="exportCurrentWorkspace">
            <FileText /> 导出当前工作区
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            :class="cn(dropdownItemClass, 'text-destructive focus:text-destructive')"
            @select="confirmClearAll = true"
          >
            <Trash2 /> 清空所有数据
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        variant="ghost"
        size="icon-sm"
        title="设置"
        :aria-pressed="uiStore.settingsOpen"
        @click="uiStore.setSettingsOpen(!uiStore.settingsOpen)"
        :class="cn(uiStore.settingsOpen && 'bg-accent text-accent-foreground')"
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
