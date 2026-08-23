<script setup lang="ts">
import { cn } from "@/lib/utils";

const props = withDefaults(defineProps<{ active?: boolean; type?: "button" | "submit" }>(), {
  active: false,
  type: "button",
});
</script>

<template>
  <button
    :type="props.type"
    :aria-pressed="props.active"
    :class="
      cn(
        'inline-flex h-7 items-center justify-center gap-1 rounded-md border px-2 text-xs font-medium transition-colors [&_svg]:size-3.5',
        props.active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground',
        $attrs.class as string,
      )
    "
    v-bind="{ ...$attrs, class: undefined }"
  >
    <slot />
  </button>
</template>
