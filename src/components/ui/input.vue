<script setup lang="ts">
import { computed, useAttrs } from "vue";
import { NInput } from "naive-ui";
import { cn } from "@/lib/utils";

/** Input：Naive n-input 封装（默认 small 尺寸，紧凑工具栏排版） */
const props = withDefaults(defineProps<{ modelValue?: string }>(), { modelValue: "" });
const emit = defineEmits<{ "update:modelValue": [value: string] }>();
const attrs = useAttrs();

const NATIVE_INPUT_ATTRS = new Set([
  "id",
  "name",
  "autocomplete",
  "autocapitalize",
  "inputmode",
  "spellcheck",
]);

const inputProps = computed(() => {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(attrs)) {
    if (key.startsWith("aria-") || NATIVE_INPUT_ATTRS.has(key)) result[key] = value;
  }
  return result;
});

const rootAttrs = computed(() => {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "class" || key.startsWith("aria-") || NATIVE_INPUT_ATTRS.has(key)) continue;
    result[key] = value;
  }
  return result;
});

function onUpdate(value: string) {
  emit("update:modelValue", value);
}
</script>

<template>
  <NInput
    :value="props.modelValue"
    :style="{ '--n-font-size': '12px' }"
    :class="cn(attrs.class as string)"
    :input-props="inputProps"
    v-bind="rootAttrs"
    bordered
    size="small"
    @update:value="onUpdate"
  />
</template>
