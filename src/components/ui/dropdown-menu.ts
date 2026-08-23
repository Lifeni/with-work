import { computed, defineComponent, h, type Component, type PropType } from "vue";
import { NDropdown, type DropdownOption } from "naive-ui";

export interface DropdownItem {
  key: string;
  label?: string;
  icon?: Component;
  /** 危险项（红色） */
  danger?: boolean;
  /** 选中态（显示对勾） */
  checked?: boolean;
  /** 分隔线 */
  divider?: boolean;
}

/**
 * DropdownMenu：Naive n-dropdown 的配置式封装。
 * 通过 options 数组描述菜单项，@select 回调返回选中 key；
 * 默认插槽提供触发元素（点击打开）。
 */
export const DropdownMenu = defineComponent({
  name: "DropdownMenu",
  props: {
    options: { type: Array as PropType<DropdownItem[]>, default: () => [] },
    align: { type: String as PropType<"start" | "end">, default: "end" },
  },
  emits: ["select"],
  setup(props, { slots, emit }) {
    const naiveOptions = computed<DropdownOption[]>(() =>
      props.options.map((o) =>
        o.divider
          ? { type: "divider", key: o.key }
          : {
              label: o.label,
              key: o.key,
              danger: o.danger,
              checked: o.checked,
              icon: o.icon ? () => h(o.icon as Component, { class: "size-3.5" }) : undefined,
            },
      ),
    );
    return () =>
      h(
        NDropdown,
        {
          options: naiveOptions.value,
          placement: props.align === "end" ? "bottom-end" : "bottom-start",
          trigger: "click",
          onSelect: (key: string) => emit("select", key),
        },
        { default: () => slots.default?.() },
      );
  },
});
