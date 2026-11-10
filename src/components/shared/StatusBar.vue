<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import { Check } from "@vicons/tabler";
import { formatTime } from "@/lib/utils";
import { useWorkspaceStore } from "@/stores/workspace";
import { useStatusStore } from "@/stores/status";
import { useUiStore } from "@/stores/ui";

const wsStore = useWorkspaceStore();
const statusStore = useStatusStore();
const uiStore = useUiStore();

const ws = computed(() => wsStore.workspaces.find((w) => w.id === wsStore.activeId));
const left = computed(() => ws.value?.left ?? "");
const right = computed(() => ws.value?.right ?? "");

// 内容变化即视为“已自动保存”时刻
const contentKey = computed(() => `${left.value}\u0000${right.value}`);
const savedAt = ref(new Date());
let savedAtTimer: ReturnType<typeof setTimeout> | null = null;
watch(contentKey, () => {
  if (savedAtTimer) clearTimeout(savedAtTimer);
  // 避免连续输入时 live region 每个按键都播报一次；停下来后再确认已保存。
  savedAtTimer = setTimeout(() => {
    savedAt.value = new Date();
    savedAtTimer = null;
  }, 400);
});
onUnmounted(() => {
  if (savedAtTimer) clearTimeout(savedAtTimer);
});
</script>

<template>
  <footer
    class="flex h-6 shrink-0 items-center gap-3 border-t border-border bg-muted px-3 text-[11px] text-muted-foreground"
  >
    <template v-if="uiStore.settingsOpen">
      <span class="flex items-center gap-1.5">
        <span class="font-medium text-foreground/80">设置</span>
        <span>·</span>
        <span>弹窗</span>
      </span>
    </template>
    <template v-else>
      <span class="font-medium text-foreground/80">{{ ws?.name ?? "—" }}</span>
    </template>
    <span class="hidden md:inline">行 {{ statusStore.line }} · 列 {{ statusStore.col }}</span>
    <span class="hidden sm:inline">左 {{ left.length }} 字符 · 右 {{ right.length }} 字符</span>

    <div class="flex-1" />
    <span class="flex items-center gap-1" role="status" aria-live="polite">
      <Check class="size-3" aria-hidden="true" />
      已自动保存 {{ formatTime(savedAt.getTime()) }}
    </span>
  </footer>
</template>
