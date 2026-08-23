<script setup lang="ts">
import { computed } from "vue";
import { NTag } from "naive-ui";
import { cn } from "@/lib/utils";

/** Badge：Naive n-tag 的薄封装（圆角胶囊），保持原 variant 语义 */
const props = withDefaults(
  defineProps<{
    variant?: "default" | "secondary" | "outline" | "destructive";
  }>(),
  { variant: "default" },
);

const tagType = computed(() => {
  switch (props.variant) {
    case "default":
      return "primary";
    case "outline":
      return "default";
    case "destructive":
      return "error";
    default:
      return "default";
  }
});
</script>

<template>
  <NTag
    size="small"
    :type="tagType"
    :bordered="props.variant !== 'outline'"
    :class="cn('!m-0 !rounded-full !px-1 !py-0 !text-[10px] leading-3.5', $attrs.class as string)"
    v-bind="{ ...$attrs, class: undefined }"
  >
    <slot />
  </NTag>
</template>
