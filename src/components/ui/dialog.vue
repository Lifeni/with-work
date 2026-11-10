<script setup lang="ts">
import { useId } from "vue";
import { NModal } from "naive-ui";
import { X } from "@vicons/tabler";
import { cn } from "@/lib/utils";

/**
 * AppDialog：Naive n-modal 承载的自绘对话框。
 * 卡片结构与原实现一致（Tailwind 语义色 + ww-dialog-content 动画），
 * n-modal 提供遮罩 / ESC / 焦点管理 / Teleport。
 */
const props = withDefaults(
  defineProps<{
    open: boolean;
    title?: string;
    description?: string;
    contentClass?: string;
  }>(),
  { title: undefined, description: undefined, contentClass: undefined },
);

const emit = defineEmits<{ "update:open": [value: boolean] }>();
const descriptionId = useId();
</script>

<template>
  <NModal
    :show="props.open"
    display-directive="if"
    transform-origin="center"
    @update:show="(v: boolean) => emit('update:open', v)"
  >
    <div
      role="dialog"
      aria-modal="true"
      :aria-label="props.title ?? '对话框'"
      :aria-describedby="props.description ? descriptionId : undefined"
      :class="
        cn(
          'ww-dialog-content relative flex max-h-[85vh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-lg border border-border bg-card p-5 text-card-foreground shadow-xl',
          props.contentClass,
        )
      "
    >
      <div v-if="props.title" class="flex flex-col gap-1.5 text-left">
        <h2 class="m-0 text-base font-semibold leading-none">{{ props.title }}</h2>
        <p v-if="props.description" :id="descriptionId" class="m-0 text-xs text-muted-foreground">
          {{ props.description }}
        </p>
      </div>
      <slot />
      <div v-if="$slots.footer" class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <slot name="footer" />
      </div>
      <button
        type="button"
        aria-label="关闭对话框"
        @click="emit('update:open', false)"
        class="absolute right-3 top-3 rounded-sm p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      >
        <X class="size-4" />
      </button>
    </div>
  </NModal>
</template>
