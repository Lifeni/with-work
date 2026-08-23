<script setup lang="ts">
import { cn } from "@/lib/utils";

const props = withDefaults(defineProps<{ modelValue?: string }>(), { modelValue: "" });
const emit = defineEmits<{ "update:modelValue": [value: string] }>();

function onInput(e: Event) {
  emit("update:modelValue", (e.target as HTMLTextAreaElement).value);
}
</script>

<template>
  <textarea
    :value="props.modelValue"
    @input="onInput"
    :class="
      cn(
        'flex min-h-16 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        $attrs.class as string,
      )
    "
    v-bind="{ ...$attrs, class: undefined }"
  />
</template>
