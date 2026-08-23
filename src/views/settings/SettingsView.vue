<script setup lang="ts">
import { ref } from "vue";
import favicon from "@/assets/favicon.svg";
import {
  Database,
  Download,
  ExternalLink,
  FileCode2,
  FileDown,
  FileText,
  Info,
  Palette,
  Trash2,
  Upload,
} from "@lucide/vue";
import Button from "@/components/ui/button.vue";
import ConfirmDialog from "@/components/shared/ConfirmDialog.vue";
import Input from "@/components/ui/input.vue";
import Toggle from "@/components/ui/toggle.vue";
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
import { useSettingsStore, DEFAULT_FONT_FAMILY } from "@/stores/settings";
import { useStagingStore } from "@/stores/staging";
import { useToastStore } from "@/stores/toast";
import type { BackupData, ThemeMode } from "@/types";

const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: "light", label: "浅色" },
  { value: "dark", label: "深色" },
  { value: "system", label: "跟随系统" },
];

const settingsStore = useSettingsStore();
const rulesStore = useRulesStore();
const stagingStore = useStagingStore();
const toast = useToastStore().push;

// 构建期注入的全局常量（vite define）：模板中不能直接访问，转发为组件变量
const BUILD_MODE = __BUILD_MODE__;
const BUILD_TIME = __BUILD_TIME__;

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
</script>

<template>
  <div class="p-4">
    <div class="mx-auto grid max-w-3xl gap-4 md:grid-cols-2">
      <!-- 左列：外观 + 关于 -->
      <div class="space-y-4">
        <section class="rounded-lg border border-border bg-card p-4">
          <h2 class="mb-3 flex items-center gap-1.5 text-sm font-semibold">
            <Palette class="size-4 text-muted-foreground" />
            外观
          </h2>
          <div class="space-y-3">
            <div class="flex items-center gap-2">
              <span class="w-24 shrink-0 text-xs text-muted-foreground">主题</span>
              <div class="flex gap-1.5">
                <Toggle
                  v-for="opt in THEME_OPTIONS"
                  :key="opt.value"
                  :active="settingsStore.theme === opt.value"
                  @click="settingsStore.setTheme(opt.value)"
                >
                  {{ opt.label }}
                </Toggle>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <span class="w-24 shrink-0 text-xs text-muted-foreground">编辑器字号</span>
              <Input
                type="number"
                min="10"
                max="24"
                :value="settingsStore.fontSize"
                @input="
                  settingsStore.setFontSize(Number(($event.target as HTMLInputElement).value) || 14)
                "
                class="h-7 w-20 text-xs"
              />
              <span class="text-xs text-muted-foreground">10 – 24 px</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="w-24 shrink-0 text-xs text-muted-foreground">自动换行</span>
              <Toggle
                :active="settingsStore.wordWrap"
                @click="settingsStore.setWordWrap(!settingsStore.wordWrap)"
              >
                {{ settingsStore.wordWrap ? "开启" : "关闭" }}
              </Toggle>
            </div>
            <div class="flex items-center gap-2">
              <span class="w-24 shrink-0 text-xs text-muted-foreground">编辑器字体</span>
              <Input
                :value="settingsStore.editorFontFamily"
                @input="
                  settingsStore.setEditorFontFamily(($event.target as HTMLInputElement).value)
                "
                class="h-7 flex-1 font-mono text-xs"
              />
              <Button
                variant="outline"
                size="sm"
                class="h-7 shrink-0 text-xs"
                @click="settingsStore.setEditorFontFamily(DEFAULT_FONT_FAMILY)"
              >
                恢复默认
              </Button>
            </div>
          </div>
        </section>

        <section class="rounded-lg border border-border bg-card p-4">
          <h2 class="mb-3 flex items-center gap-1.5 text-sm font-semibold">
            <Info class="size-4 text-muted-foreground" />
            关于
          </h2>
          <div class="flex items-center gap-3">
            <img :src="favicon" alt="一点微小的工作" class="h-12 w-12 rounded-full" />
            <div class="text-xs text-muted-foreground">
              <p class="text-sm font-semibold text-foreground">一点微小的工作</p>
              <p>版本 100.0.0{{ BUILD_MODE === "single" ? " 单文件版" : "" }} 🕯️</p>
              <p>
                构建时间
                {{
                  new Date(BUILD_TIME).toLocaleString("zh-CN", {
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  })
                }}
              </p>
            </div>
          </div>
          <div class="mt-3 flex flex-wrap gap-2">
            <!-- 单文件版本身就是单文件，不再提供下载入口 -->
            <a
              v-if="BUILD_MODE !== 'single'"
              href="./with-work-single.html"
              download="一点微小的工作.html"
              title="下载单文件版本（离线可运行）"
              class="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-border bg-transparent px-3 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <FileDown class="size-3.5" />
              下载单文件版
            </a>
            <a
              href="https://github.com/Lifeni/with-work"
              target="_blank"
              rel="noreferrer"
              title="在 GitHub 上查看源码"
              class="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-border bg-transparent px-3 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <ExternalLink class="size-3.5" />
              GitHub 仓库
            </a>
          </div>
        </section>
      </div>

      <!-- 右列：数据管理 -->
      <div class="space-y-4">
        <section class="rounded-lg border border-border bg-card p-4">
          <h2 class="mb-3 flex items-center gap-1.5 text-sm font-semibold">
            <Database class="size-4 text-muted-foreground" />
            数据管理
          </h2>
          <p class="mb-3 text-xs text-muted-foreground">
            所有工作区、暂存区、替换规则、模板与设置均自动保存在浏览器本地，可随时导出备份或清空。
          </p>
          <div class="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" class="h-7 text-xs" @click="exportBackup">
              <Download class="size-3.5" />
              导出全部备份
            </Button>
            <Button size="sm" variant="secondary" class="h-7 text-xs" @click="backupRef?.click()">
              <Upload class="size-3.5" />
              导入备份
            </Button>
            <Button size="sm" variant="outline" class="h-7 text-xs" @click="exportRules">
              <FileCode2 class="size-3.5" />
              导出替换规则
            </Button>
            <Button size="sm" variant="outline" class="h-7 text-xs" @click="rulesRef?.click()">
              <Upload class="size-3.5" />
              导入替换规则
            </Button>
            <Button size="sm" variant="outline" class="h-7 text-xs" @click="exportCurrentWorkspace">
              <FileText class="size-3.5" />
              导出当前工作区（.txt）
            </Button>
            <Button
              size="sm"
              variant="outline"
              class="h-7 text-xs text-destructive hover:text-destructive"
              @click="confirmClearStaging = true"
            >
              <Trash2 class="size-3.5" />
              清空暂存区
            </Button>
            <Button
              size="sm"
              variant="destructive"
              class="h-7 text-xs"
              @click="confirmClearAll = true"
            >
              <Trash2 class="size-3.5" />
              清空所有数据
            </Button>
          </div>
        </section>
      </div>
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
      @confirm="
        () => {
          stagingStore.clear();
          confirmClearStaging = false;
          toast('暂存区已清空');
        }
      "
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
  </div>
</template>
