<script setup lang="ts">
import { computed, useAttrs } from "vue";
import { NButton, NTooltip } from "naive-ui";
import { cn } from "@/lib/utils";

/**
 * Button：Naive UI n-button 的薄封装，保持原有 variant/size 语义。
 * - 尺寸映射：default→medium、sm→small、lg→large；图标按钮使用 circle。
 * - title 属性自动转为 n-tooltip（Naive 风格提示），不再透传给原生 title。
 * - 激活态使用 ww-active 类（通过 CSS 变量覆盖 Naive 按钮色，避免被库样式覆盖）。
 */

const props = withDefaults(
  defineProps<{
    type?: "button" | "submit" | "reset";
    variant?: "default" | "secondary" | "outline" | "ghost" | "destructive";
    size?: "default" | "sm" | "lg" | "icon" | "icon-sm";
    /** 激活态：通过内联 CSS 变量覆盖按钮底色（Naive 按钮样式是内联变量，CSS 类无法覆盖） */
    active?: boolean;
  }>(),
  { type: "button", variant: "default", size: "default", active: false },
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

const activeStyle = computed(() =>
  props.active
    ? {
        "--n-color": "var(--accent)",
        "--n-color-hover": "var(--accent)",
        "--n-color-pressed": "var(--accent)",
        "--n-color-focus": "var(--accent)",
        "--n-text-color": "var(--accent-foreground)",
        "--n-text-color-hover": "var(--accent-foreground)",
        "--n-text-color-pressed": "var(--accent-foreground)",
        "--n-ripple-color": "var(--accent-foreground)",
      }
    : undefined,
);

// 分离 title（用于 tooltip，同时转为 aria-label 透传保留可访问性与测试定位）
const forwarding = computed(() => {
  const { title, disabled, class: _cls, ...rest } = attrs as Record<string, unknown>;
  return {
    title: typeof title === "string" ? title : undefined,
    ariaLabel: typeof title === "string" ? title : undefined,
    disabled: Boolean(disabled),
    rest,
    className: _cls,
  };
});
</script>

<template>
  <NTooltip v-if="forwarding.title" :delay="300" :disabled="false">
    <template #trigger>
      <NButton
        :attr-type="props.type"
        :type="naiveType"
        :size="naiveSize"
        :circle="circle"
        :bordered="bordered"
        :disabled="forwarding.disabled"
        :aria-label="forwarding.ariaLabel"
        :style="activeStyle"
        :class="cn(forwarding.className as string, 'align-middle')"
        v-bind="{ ...forwarding.rest }"
      >
        <slot />
      </NButton>
    </template>
    {{ forwarding.title }}
  </NTooltip>
  <NButton
    v-else
    :attr-type="props.type"
    :type="naiveType"
    :size="naiveSize"
    :circle="circle"
    :bordered="bordered"
    :disabled="forwarding.disabled"
    :aria-label="forwarding.ariaLabel"
    :style="activeStyle"
    :class="cn(forwarding.className as string, 'align-middle')"
    v-bind="{ ...forwarding.rest }"
  >
    <slot />
  </NButton>
</template>
