<script setup lang="ts">
import { Palette } from "@vicons/tabler";
import { NInputNumber, NRadioButton, NRadioGroup } from "naive-ui";
import Button from "@/components/ui/button.vue";
import Input from "@/components/ui/input.vue";
import SectionCard from "@/components/ui/section-card.vue";
import Toggle from "@/components/ui/toggle.vue";
import { useSettingsStore, DEFAULT_FONT_FAMILY } from "@/stores/settings";
import type { ThemeMode } from "@/types";

const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: "light", label: "浅色" },
  { value: "dark", label: "深色" },
  { value: "system", label: "跟随系统" },
];

const settingsStore = useSettingsStore();
</script>

<template>
  <SectionCard title="外观" :icon="Palette">
    <div class="space-y-3">
      <div class="grid gap-1.5 sm:grid-cols-[6rem_minmax(0,1fr)] sm:items-center sm:gap-2">
        <span class="text-xs text-muted-foreground">主题</span>
        <NRadioGroup
          class="ww-theme-switch min-w-0"
          aria-label="主题"
          :value="settingsStore.theme"
          size="small"
          @update:value="(value) => settingsStore.setTheme(value as ThemeMode)"
        >
          <NRadioButton v-for="opt in THEME_OPTIONS" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </NRadioButton>
        </NRadioGroup>
      </div>
      <div class="grid gap-1.5 sm:grid-cols-[6rem_minmax(0,1fr)] sm:items-center sm:gap-2">
        <span class="text-xs text-muted-foreground">编辑器字号</span>
        <div class="flex min-w-0 items-center gap-2">
          <NInputNumber
            :value="settingsStore.fontSize"
            :min="10"
            :max="24"
            :show-button="false"
            :input-props="{ 'aria-label': '编辑器字号' }"
            bordered
            size="small"
            class="w-24 ww-control-text"
            @update:value="(v: number | null) => settingsStore.setFontSize(v ?? 14)"
          />
          <span class="whitespace-nowrap text-xs text-muted-foreground">10 – 24 px</span>
        </div>
      </div>
      <div class="grid gap-1.5 sm:grid-cols-[6rem_minmax(0,1fr)] sm:items-center sm:gap-2">
        <span class="text-xs text-muted-foreground">自动换行</span>
        <div>
          <Toggle
            :active="settingsStore.wordWrap"
            title="自动换行"
            @click="settingsStore.setWordWrap(!settingsStore.wordWrap)"
          >
            {{ settingsStore.wordWrap ? "开启" : "关闭" }}
          </Toggle>
        </div>
      </div>
      <div class="grid gap-1.5 sm:grid-cols-[6rem_minmax(0,1fr)] sm:items-center sm:gap-2">
        <span class="text-xs text-muted-foreground">编辑器字体</span>
        <div class="flex min-w-0 flex-wrap items-center gap-2">
          <Input
            :model-value="settingsStore.editorFontFamily"
            aria-label="编辑器字体"
            @update:model-value="settingsStore.setEditorFontFamily"
            class="min-w-32 flex-1 font-mono"
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
    </div>
  </SectionCard>
</template>
