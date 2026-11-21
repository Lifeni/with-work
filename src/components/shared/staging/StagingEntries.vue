<script setup lang="ts">
import { ref } from "vue";
import { Copy, FileDiff, Pencil, Trash } from "@vicons/tabler";
import ConfirmDialog from "@/components/shared/ConfirmDialog.vue";
import TooltipIconButton from "@/components/ui/tooltip-icon-button.vue";
import { useCardDrag } from "@/hooks/useCardDrag";
import { hasDragType } from "@/lib/drag";
import { cn, formatTime } from "@/lib/utils";
import { importText } from "@/lib/transfer";
import { useStagingStore } from "@/stores/staging";
import { useToastStore } from "@/stores/toast";

const stagingStore = useStagingStore();
const toast = useToastStore().push;
const { startCardDrag } = useCardDrag();
const editingItemId = ref<string | null>(null);
const editDraft = ref("");
const pendingDelete = ref<{ id: string; name: string } | null>(null);
const dragOver = ref(false);

function startItemEdit(id: string) {
  const item = stagingStore.items.find((candidate) => candidate.id === id);
  if (!item) return;
  editingItemId.value = id;
  editDraft.value = item.text;
}

function saveItemEdit() {
  if (editingItemId.value) stagingStore.updateItem(editingItemId.value, editDraft.value);
  editingItemId.value = null;
}

function cancelItemEdit() {
  editingItemId.value = null;
}

function copyItem(text: string) {
  void navigator.clipboard.writeText(text);
  toast("已复制");
}

function handleDragOver(event: DragEvent) {
  if (!hasDragType(event.dataTransfer?.types, "text/plain")) return;
  event.preventDefault();
  event.dataTransfer!.dropEffect = "copy";
  dragOver.value = true;
}

function handleDrop(event: DragEvent) {
  event.preventDefault();
  dragOver.value = false;
  const transfer = event.dataTransfer;
  if (!transfer) return;
  if (transfer.getData("application/x-with-work-source") === "staging") return;
  const text = transfer.getData("text/plain");
  if (!text.trim()) return;
  stagingStore.add(text);
  toast("已拖入暂存区");
}
</script>

<template>
  <div
    data-testid="staging-drop-zone"
    :class="
      cn(
        'min-h-0 min-w-0 flex-1 space-y-2 overflow-y-auto p-3 transition-colors',
        dragOver && 'bg-accent/60',
      )
    "
    @dragover="handleDragOver"
    @dragleave="dragOver = false"
    @drop="handleDrop"
  >
    <div
      v-if="stagingStore.items.length === 0"
      class="flex h-32 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border text-xs text-muted-foreground"
    >
      <span>暂存区为空</span>
      <span>在上方粘贴文本即可暂存</span>
    </div>
    <template v-else>
      <div v-for="item in stagingStore.items" :key="item.id">
        <template v-if="editingItemId === item.id">
          <textarea
            v-model="editDraft"
            autofocus
            rows="3"
            aria-label="编辑暂存区条目"
            @keydown.enter.exact.prevent="saveItemEdit"
            @keydown.esc="cancelItemEdit"
            class="w-full resize-none rounded border border-border bg-background p-1.5 text-xs outline-none focus:ring-1 focus:ring-ring"
          />
          <div class="mt-1.5 flex items-center justify-end gap-1">
            <button
              type="button"
              title="保存"
              @click="saveItemEdit"
              class="min-h-6 rounded bg-primary px-2 py-1 text-xs text-primary-foreground hover:opacity-90"
            >
              保存
            </button>
            <button
              type="button"
              title="取消"
              @click="cancelItemEdit"
              class="min-h-6 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
            >
              取消
            </button>
          </div>
        </template>
        <template v-else>
          <div
            title="拖拽到编辑器可快速插入，双击可编辑"
            @dblclick="startItemEdit(item.id)"
            @pointerdown="
              (event: PointerEvent) => startCardDrag(event, { kind: 'staging', text: item.text })
            "
            class="cursor-grab select-none rounded-md border border-border bg-background p-2 active:cursor-grabbing"
          >
            <p class="line-clamp-3 whitespace-pre-wrap break-all text-xs">{{ item.text }}</p>
            <div class="mt-1.5 flex items-center gap-1 text-[10px] text-muted-foreground">
              <span>{{ item.text.length }} 字符</span>
              <span>·</span>
              <span>{{ formatTime(item.createdAt) }}</span>
              <div class="flex-1" />
              <TooltipIconButton
                title="编辑"
                @click="startItemEdit(item.id)"
                class="rounded p-0.5 hover:bg-accent hover:text-accent-foreground"
              >
                <Pencil class="size-3" />
              </TooltipIconButton>
              <TooltipIconButton
                title="复制"
                @click="copyItem(item.text)"
                class="rounded p-0.5 hover:bg-accent hover:text-accent-foreground"
              >
                <Copy class="size-3" />
              </TooltipIconButton>
              <TooltipIconButton
                title="导入到对比·左侧"
                @click="importText('diff-left', item.text)"
                class="rounded p-0.5 hover:bg-accent hover:text-accent-foreground"
              >
                <FileDiff class="size-3" />
              </TooltipIconButton>
              <TooltipIconButton
                title="导入到对比·右侧"
                @click="importText('diff-right', item.text)"
                class="rounded p-0.5 hover:bg-accent hover:text-accent-foreground"
              >
                <FileDiff class="size-3" />
              </TooltipIconButton>
              <TooltipIconButton
                title="删除此条目"
                @click="pendingDelete = { id: item.id, name: item.text.slice(0, 20) }"
                class="rounded p-0.5 text-destructive hover:bg-accent"
              >
                <Trash class="size-3" />
              </TooltipIconButton>
            </div>
          </div>
        </template>
      </div>
    </template>

    <ConfirmDialog
      :open="pendingDelete !== null"
      title="删除确认"
      :description="pendingDelete ? `确定删除暂存区条目「${pendingDelete.name}」吗？` : undefined"
      confirm-text="删除"
      destructive
      @confirm="
        () => {
          if (pendingDelete) stagingStore.remove(pendingDelete.id);
          toast('已删除');
          pendingDelete = null;
        }
      "
      @cancel="pendingDelete = null"
    />
  </div>
</template>
