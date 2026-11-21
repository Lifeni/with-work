<script setup lang="ts">
import { ref } from "vue";
import { Database, Download, FileCode, FileText, Trash, Upload } from "@vicons/tabler";
import Button from "@/components/ui/button.vue";
import ConfirmDialog from "@/components/shared/ConfirmDialog.vue";
import SectionCard from "@/components/ui/section-card.vue";
import {
  applyBackup,
  clearAllData,
  exportBackup,
  exportCurrentWorkspace,
  exportRules,
  parseBackup,
  parseRules,
} from "@/lib/backup";
import { useRulesStore } from "@/stores/rules";
import { useStagingStore } from "@/stores/staging";
import { useToastStore } from "@/stores/toast";
import type { BackupData } from "@/types";

const ACTION_BUTTON_CLASS = "h-7 w-full text-xs";

const rulesStore = useRulesStore();
const stagingStore = useStagingStore();
const toast = useToastStore().push;

const pendingBackup = ref<BackupData | null>(null);
const confirmImport = ref(false);
const confirmClearStaging = ref(false);
const confirmClearAll = ref(false);
const backupRef = ref<HTMLInputElement | null>(null);
const rulesRef = ref<HTMLInputElement | null>(null);

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

function clearStaging() {
  stagingStore.clear();
  confirmClearStaging.value = false;
  toast("暂存区已清空");
}
</script>

<template>
  <SectionCard title="数据管理" :icon="Database">
    <p class="mb-3 text-xs text-muted-foreground">
      所有工作区、暂存区、替换规则、模板与设置均自动保存在浏览器本地，可随时导出备份或清空。
    </p>
    <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <Button size="sm" variant="secondary" :class="ACTION_BUTTON_CLASS" @click="exportBackup">
        <Download class="size-3.5" />
        导出全部备份
      </Button>
      <Button
        size="sm"
        variant="secondary"
        :class="ACTION_BUTTON_CLASS"
        @click="backupRef?.click()"
      >
        <Upload class="size-3.5" />
        导入备份
      </Button>
      <Button size="sm" variant="outline" :class="ACTION_BUTTON_CLASS" @click="exportRules">
        <FileCode class="size-3.5" />
        导出替换规则
      </Button>
      <Button size="sm" variant="outline" :class="ACTION_BUTTON_CLASS" @click="rulesRef?.click()">
        <Upload class="size-3.5" />
        导入替换规则
      </Button>
      <Button
        size="sm"
        variant="outline"
        :class="ACTION_BUTTON_CLASS"
        @click="exportCurrentWorkspace"
      >
        <FileText class="size-3.5" />
        导出当前工作区（.txt）
      </Button>
      <Button
        size="sm"
        variant="outline"
        tone="destructive"
        :class="ACTION_BUTTON_CLASS"
        @click="confirmClearStaging = true"
      >
        <Trash class="size-3.5" />
        清空暂存区
      </Button>
      <Button
        size="sm"
        variant="destructive"
        :class="[ACTION_BUTTON_CLASS, 'sm:col-span-2']"
        @click="confirmClearAll = true"
      >
        <Trash class="size-3.5" />
        清空所有数据
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
      :open="confirmClearStaging"
      title="清空暂存区"
      description="将删除暂存区中的所有文本条目。"
      confirm-text="清空"
      destructive
      @confirm="clearStaging"
      @cancel="confirmClearStaging = false"
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
  </SectionCard>
</template>
