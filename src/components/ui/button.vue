<script setup lang="ts">
import { computed, useAttrs } from "vue";
import { NButton } from "naive-ui";
import { cn } from "@/lib/utils";

/**
 * Button：Naive UI n-button 的薄封装，保持原有 variant/size 语义。
 * 尺寸映射：default→medium、sm→small、lg→large；图标按钮使用 circle。
 * Tailwind 尺寸类对 n-button 无效（高度由 --n-height 控制），需要微调时
 * 传入 style 覆盖（如 :style="{ '--n-height': '26px' }"）。
 */

const props = withDefaults(
  defineProps<{
    type?: "button" | "submit" | "reset";
    variant?: "default" | "secondary" | "outline" | "ghost" | "destructive";
    size?: "default" | "sm" | "lg" | "icon" | "icon-sm";
  }>(),
  { type: "button", variant: "default", size: "default" },
);

const attrs = useAttrs();

const naiveType = computed(() => {
  switch (props.variant) {
    case "secondary":
      return "default";
    case "outline":
      return "tertiary";
    case "ghost":
      return "tertiary";
    case "destructive":
      return "error";
    default:
      return "primary";
  }
});

// ghost 无边框（tertiary 默认带浅描边，去掉以贴近原视觉效果）
const bordered = computed(
  () => (props.variant === "ghost" ? false : undefined) as boolean | undefined,
);

const naiveSize = computed(() => {
  switch (props.size) {
    case "sm":
      return "small";
    case "lg":
      return "large";
    case "icon":
      return "medium";
    case "icon-sm":
      return "small";
    default:
      return "medium";
  }
});

const circle = computed(() => props.size === "icon" || props.size === "icon-sm");

// 透传原生属性：disabled 转 n-button prop，其余（title 等）直接下发
const forwarding = computed(() => {
  const { disabled, class: _cls, ...rest } = attrs as Record<string, unknown>;
  return { disabled: Boolean(disabled), rest, className: _cls };
});
</script>

<template>
  <NButton
    :attr-type="props.type"
    :type="naiveType"
    :size="naiveSize"
    :circle="circle"
    :bordered="bordered"
    :disabled="forwarding.disabled"
    :class="cn(forwarding.className as string, 'align-middle')"
    v-bind="{ ...forwarding.rest }"
  >
    <slot />
  </NButton>
</template>
