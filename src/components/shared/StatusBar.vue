<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Check, Inbox } from "@lucide/vue";
import { cn, formatTime } from "@/lib/utils";
import { useWorkspaceStore } from "@/stores/workspace";
import { useStatusStore } from "@/stores/status";
import { useStagingStore } from "@/stores/staging";
import { useUiStore } from "@/stores/ui";

const wsStore = useWorkspaceStore();
const statusStore = useStatusStore();
const stagingStore = useStagingStore();
const uiStore = useUiStore();

const ws = computed(() => wsStore.workspaces.find((w) => w.id === wsStore.activeId));
const left = computed(() => ws.value?.left ?? "");
const right = computed(() => ws.value?.right ?? "");

// 内容变化即视为“已自动保存”时刻
const contentKey = computed(() => `${left.value}\u0000${right.value}`);
const lastSavedContent = ref(contentKey.value);
const savedAt = ref(new Date());
watch(contentKey, () => {
  lastSavedContent.value = contentKey.value;
  savedAt.value = new Date();
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
    <span class="hidden sm:inline">左 {{ left.length }} · 右 {{ right.length }} 字符</span>

    <div class="flex-1" />

    <button
      type="button"
      @click="uiStore.toggleStaging()"
      :class="
        cn(
          'flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-accent',
          uiStore.stagingOpen && 'bg-accent text-accent-foreground',
        )
      "
    >
      <Inbox class="size-3" />
      暂存区 ({{ stagingStore.items.length }})
    </button>
    <span class="flex items-center gap-1">
      <Check class="size-3" />
      已自动保存 {{ formatTime(savedAt.getTime()) }}
    </span>
  </footer>
</template>
