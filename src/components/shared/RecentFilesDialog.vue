<script setup lang="ts">
import { computed } from "vue";
import { FileText, Trash } from "@vicons/tabler";
import AppDialog from "@/components/ui/dialog.vue";
import Button from "@/components/ui/button.vue";
import { forgetRecentFile, recentFiles } from "@/lib/recentFiles";
import { useToastStore } from "@/stores/toast";

defineProps<{ open: boolean }>();
const emit = defineEmits<{ "update:open": [value: boolean] }>();
const toast = useToastStore().push;
const items = computed(() => recentFiles.value);

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

async function remove(id: string, name: string) {
  await forgetRecentFile(id);
  toast(`已从最近历史移除「${name}」`);
}
</script>

<template>
  <AppDialog
    :open="open"
    title="最近文件"
    description="从最近历史移除不会解除当前工作区的文件绑定。"
    content-class="max-w-xl"
    @update:open="(value: boolean) => emit('update:open', value)"
  >
    <div v-if="items.length > 0" class="max-h-72 space-y-1.5 overflow-y-auto">
      <div
        v-for="file in items"
        :key="file.id"
        class="flex items-center gap-2 rounded-md border border-border px-2.5 py-2"
      >
        <FileText class="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span class="min-w-0 flex-1 truncate text-xs" :title="file.name">{{ file.name }}</span>
        <span class="shrink-0 text-[11px] text-muted-foreground">
          {{ formatDate(file.lastOpenedAt) }}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          :title="`从历史移除 ${file.name}`"
          @click="remove(file.id, file.name)"
        >
          <Trash class="size-3" />
        </Button>
      </div>
    </div>
    <p v-else class="py-6 text-center text-xs text-muted-foreground">暂无最近文件</p>
  </AppDialog>
</template>
