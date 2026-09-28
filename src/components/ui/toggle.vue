<script setup lang="ts">
import { useAttrs } from "vue";
import { cn } from "@/lib/utils";

/**
 * Toggle：开关按钮（原生实现，Naive 无对应小控件）。
 * title 属性作为原生 title 透传（与 Button 组件一致，使用浏览器原生提示）。
 */
const props = withDefaults(defineProps<{ active?: boolean; type?: "button" | "submit" }>(), {
  active: false,
  type: "button",
});

const attrs = useAttrs();
const rest = (() => {
  const { class: _c, ...remain } = attrs as Record<string, unknown>;
  return remain;
})();
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
    v-bind="rest"
  >
    <slot />
  </button>
</template>
