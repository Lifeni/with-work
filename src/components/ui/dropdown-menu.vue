<script setup lang="ts">
import { computed, ref } from "vue";
import { NDropdown } from "naive-ui";
import {
  dropdownMenuProps,
  dropdownNodeProps,
  focusFirstDropdownItem,
  restoreDropdownTriggerFocus,
  toDropdownOptions,
  type DropdownItem,
} from "@/components/ui/dropdown";

/** 点击下拉：定位、外部关闭和键盘操作交给 Naive UI。 */
const props = withDefaults(
  defineProps<{
    options: DropdownItem[];
    align?: "start" | "end";
    ariaLabel?: string;
  }>(),
  { options: () => [], align: "end", ariaLabel: "操作菜单" },
);

const emit = defineEmits<{ select: [key: string] }>();
const naiveOptions = computed(() => toDropdownOptions(props.options));
const menuProps = dropdownMenuProps(props.ariaLabel);
const open = ref(false);
const triggerRef = ref<HTMLElement | null>(null);

function updateOpen(show: boolean) {
  open.value = show;
  if (show) focusFirstDropdownItem(triggerRef.value);
  else restoreDropdownTriggerFocus();
}
</script>

<template>
  <NDropdown
    trigger="click"
    size="small"
    :placement="props.align === 'end' ? 'bottom-end' : 'bottom-start'"
    :options="naiveOptions"
    :menu-props="menuProps"
    :node-props="dropdownNodeProps"
    @select="(key: string | number) => emit('select', String(key))"
    @update:show="updateOpen"
  >
    <span ref="triggerRef" class="inline-flex">
      <slot :open="open" />
    </span>
  </NDropdown>
</template>
