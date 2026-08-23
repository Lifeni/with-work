<script setup lang="ts">
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from "reka-ui";
import { X } from "@lucide/vue";
import { cn } from "@/lib/utils";

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
</script>

<template>
  <DialogRoot :open="props.open" @update:open="(v: boolean) => emit('update:open', v)">
    <DialogPortal>
      <DialogOverlay class="ww-overlay fixed inset-0 z-[90] bg-black/50" />
      <DialogContent
        :class="
          cn(
            'ww-dialog-content fixed left-1/2 top-1/2 z-[95] flex max-h-[85vh] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-lg border border-border bg-card p-5 text-card-foreground shadow-xl',
            props.contentClass,
          )
        "
      >
        <div v-if="props.title" class="flex flex-col gap-1.5 text-left">
          <DialogTitle class="text-base font-semibold leading-none">
            {{ props.title }}
          </DialogTitle>
          <DialogDescription v-if="props.description" class="text-xs text-muted-foreground">
            {{ props.description }}
          </DialogDescription>
        </div>
        <slot />
        <div v-if="$slots.footer" class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <slot name="footer" />
        </div>
        <DialogClose
          class="absolute right-3 top-3 rounded-sm p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground focus:outline-none"
        >
          <X class="size-4" />
        </DialogClose>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
