<script setup lang="ts">
import { useAttrs } from "vue";
import Button from "@/components/ui/button.vue";
import { cn } from "@/lib/utils";

/**
 * Toggle：紧凑的开关键，底层复用 Naive n-button。
 * Naive 的 NSwitch / NCheckbox 体积不适合高密度工具栏，因此只保留按钮外观适配层。
 */
const props = withDefaults(
  defineProps<{ active?: boolean; type?: "button" | "submit"; iconOnly?: boolean }>(),
  {
    active: false,
    type: "button",
    iconOnly: false,
  },
);

const attrs = useAttrs();
const rest = (() => {
  const { class: _c, ...remain } = attrs as Record<string, unknown>;
  return remain;
})();
</script>

<template>
  <Button
    :type="props.type"
    :variant="props.active ? 'default' : 'outline'"
    :size="props.iconOnly ? 'icon-sm' : 'sm'"
    :aria-pressed="props.active"
    :class="
      cn(
        'items-center justify-center text-xs font-medium [&_svg]:size-3.5',
        props.iconOnly ? 'h-6.5 w-6.5 px-0' : 'h-7 gap-1 px-2',
        $attrs.class as string,
      )
    "
    v-bind="rest"
  >
    <slot />
  </Button>
</template>
