<script setup lang="ts">
import { computed, useAttrs } from "vue";
import { NButton } from "naive-ui";
import { cn } from "@/lib/utils";

/**
 * Button：Naive UI n-button 的薄封装，保持原有 variant/size 语义。
 * - 尺寸映射：default→medium、sm→small、lg→large；图标按钮使用固定宽高的圆角矩形。
 * - title 属性作为原生 title 透传，同时转为 aria-label（可访问性与测试定位）。
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

// 图标按钮：统一圆角矩形（不用 Naive 的 circle，避免圆形/矩形混用）；
// 固定宽高 + 去掉内边距保证图标完全居中（配合 index.css 的 .ww-icon-btn 强制规则）
const isIconSize = computed(() => props.size === "icon" || props.size === "icon-sm");
const sizeStyle = computed(() => {
  if (props.size === "icon") return { width: "36px", height: "36px" };
  if (props.size === "icon-sm") return { width: "26px", height: "26px" };
  return undefined;
});

// 次级/幽灵/描边按钮的图标与文字统一为 muted 灰色系（hover 转 accent）
const mutedStyle = computed(() => {
  if (props.variant === "default" || props.variant === "destructive" || props.active)
    return undefined;
  return {
    "--n-text-color": "var(--muted-foreground)",
    "--n-text-color-hover": "var(--accent-foreground)",
    "--n-text-color-pressed": "var(--accent-foreground)",
    "--n-text-color-focus": "var(--accent-foreground)",
  };
});

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

/** 合并激活态与尺寸样式（数字按钮统一紧凑字号；图标按钮去内边距并作用 muted 色） */
const mergedStyle = computed(() => {
  const base = { "--n-font-size": "12px" } as Record<string, string>;
  if (isIconSize.value) {
    base["--n-padding-left"] = "0";
    base["--n-padding-right"] = "0";
  }
  const muted = mutedStyle.value;
  if (muted) Object.assign(base, muted);
  if (props.active) Object.assign(base, activeStyle.value);
  if (sizeStyle.value) Object.assign(base, sizeStyle.value);
  return base;
});

// 分离 title（原生 title 透传 + aria-label），class 单独合并
const forwarding = computed(() => {
  const { title, disabled, class: _cls, ...rest } = attrs as Record<string, unknown>;
  const titleVal = typeof title === "string" ? title : undefined;
  return {
    title: titleVal,
    ariaLabel: titleVal,
    disabled: Boolean(disabled),
    rest: { ...rest, title: titleVal },
    className: _cls,
  };
});
</script>

<template>
  <NButton
    :attr-type="props.type"
    :type="naiveType"
    :size="naiveSize"
    :bordered="bordered"
    :disabled="forwarding.disabled"
    :aria-label="forwarding.ariaLabel"
    :style="mergedStyle"
    :class="cn(forwarding.className as string, 'align-middle', isIconSize && 'ww-icon-btn')"
    v-bind="forwarding.rest"
  >
    <slot />
  </NButton>
</template>
