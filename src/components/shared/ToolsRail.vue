<script setup lang="ts">
import { ref } from "vue";
import { Download, Settings, Trash, Upload } from "@vicons/tabler";
import ConfirmDialog from "@/components/shared/ConfirmDialog.vue";
import DropdownMenu from "@/components/ui/dropdown-menu.vue";
import favicon from "@/assets/favicon.svg";
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
import { cn } from "@/lib/utils";
import { useRulesStore } from "@/stores/rules";
import { useTemplatesStore } from "@/stores/templates";
import { useToastStore } from "@/stores/toast";
import { useUiStore } from "@/stores/ui";
import type { BackupData } from "@/types";

/**
 * 左侧品牌栏：Logo + 竖排标题（中文左列 / 英文右列 底部对齐）；
 * 底部为全局入口：设置、导出、导入（原数据下拉拆分为二）。
 */
const uiStore = useUiStore();
const toast = useToastStore().push;

const pendingBackup = ref<BackupData | null>(null);
const confirmImport = ref(false);
const confirmClearAll = ref(false);
const backupRef = ref<HTMLInputElement | null>(null);
const rulesRef = ref<HTMLInputElement | null>(null);
const templatesRef = ref<HTMLInputElement | null>(null);

/** 导出菜单项 */
const exportMenuOptions = [
  { key: "export-backup", label: "导出全部备份", icon: Download },
  { key: "sep1", divider: true },
  { key: "export-rules", label: "导出替换规则", icon: Download },
  { key: "sep2", divider: true },
  { key: "export-templates", label: "导出排序模板", icon: Download },
  { key: "sep3", divider: true },
  { key: "export-workspace", label: "导出当前工作区", icon: Download },
];

/** 导入菜单项（含清空所有数据） */
const importMenuOptions = [
  { key: "import-backup", label: "导入备份", icon: Upload },
  { key: "sep1", divider: true },
  { key: "import-rules", label: "导入替换规则", icon: Upload },
  { key: "sep2", divider: true },
  { key: "import-templates", label: "导入排序模板", icon: Upload },
  { key: "sep3", divider: true },
  { key: "clear-all", label: "清空所有数据", icon: Trash, danger: true },
];

function onExportMenuSelect(key: string) {
  switch (key) {
    case "export-backup":
      exportBackup();
      break;
    case "export-rules":
      exportRules();
      break;
    case "export-templates":
      exportTemplates();
      break;
    case "export-workspace":
      exportCurrentWorkspace();
      break;
  }
}

function onImportMenuSelect(key: string) {
  switch (key) {
    case "import-backup":
      backupRef.value?.click();
      break;
    case "import-rules":
      rulesRef.value?.click();
      break;
    case "import-templates":
      templatesRef.value?.click();
      break;
    case "clear-all":
      confirmClearAll.value = true;
      break;
  }
}

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
    useRulesStore().replaceAll(res.rules);
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
    useTemplatesStore().replaceAll(res.templates);
    toast(`已导入 ${res.templates.length} 个排序模板`);
  });
};
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

    <!-- 底部全局入口：导入、导出、设置 -->
    <div class="flex min-h-0 w-full flex-1 flex-col items-center justify-end gap-1 pb-1">
      <DropdownMenu :options="importMenuOptions" @select="onImportMenuSelect">
        <button
          type="button"
          title="导入"
          aria-label="导入"
          class="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <Upload class="size-[18px]" />
        </button>
      </DropdownMenu>
      <DropdownMenu :options="exportMenuOptions" @select="onExportMenuSelect">
        <button
          type="button"
          title="导出"
          aria-label="导出"
          class="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <Download class="size-[18px]" />
        </button>
      </DropdownMenu>
      <button
        type="button"
        title="设置"
        aria-label="设置"
        :aria-pressed="uiStore.settingsOpen"
        @click="uiStore.setSettingsOpen(!uiStore.settingsOpen)"
        :class="
          cn(
            'flex h-7 w-7 items-center justify-center rounded-md transition-colors',
            uiStore.settingsOpen
              ? 'bg-accent text-accent-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
          )
        "
      >
        <Settings class="size-[18px]" />
      </button>
    </div>

    <input ref="backupRef" type="file" accept=".json,application/json" class="hidden" @change="onBackupFile" />
    <input ref="rulesRef" type="file" accept=".json,application/json" class="hidden" @change="onRulesFile" />
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
  </aside>
</template>