<script setup lang="ts">
import { useAttrs } from "vue";
import { NInput } from "naive-ui";
import { cn } from "@/lib/utils";

/** Textarea：Naive n-input type=textarea 封装 */
const props = withDefaults(defineProps<{ modelValue?: string; rows?: number }>(), {
  modelValue: "",
  rows: 3,
});
const emit = defineEmits<{ "update:modelValue": [value: string] }>();

// 分离 attrs：rows 由 prop 管理，避免与 v-bind 重复
const attrs = useAttrs();
const rest = (() => {
  const { class: _c, rows: _r, ...remain } = attrs as Record<string, unknown>;
  return remain;
})();

function onUpdate(value: string) {
  emit("update:modelValue", value);
}
</script>

<template>
  <NInput
    type="textarea"
    :value="props.modelValue"
    :rows="props.rows"
    :class="cn(attrs.class as string)"
    v-bind="rest"
    size="small"
    @update:value="onUpdate"
  />
</template>
