<script setup lang="ts">
import { NInput } from "naive-ui";
import { cn } from "@/lib/utils";

/** Input：Naive n-input 封装（默认 small 尺寸，紧凑工具栏排版） */
const props = withDefaults(defineProps<{ modelValue?: string }>(), { modelValue: "" });
const emit = defineEmits<{ "update:modelValue": [value: string] }>();

function onUpdate(value: string) {
  emit("update:modelValue", value);
}
</script>

<template>
  <NInput
    :value="props.modelValue"
    :class="cn($attrs.class as string)"
    v-bind="{ ...$attrs, class: undefined, ...{ 'aria-label': undefined } }"
    size="small"
    @update:value="onUpdate"
  />
</template>
