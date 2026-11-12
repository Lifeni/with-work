import { h, nextTick, type Component } from "vue";
import {
  NIcon,
  type DropdownDividerOption,
  type DropdownGroupOption,
  type DropdownOption,
  type DropdownProps,
} from "naive-ui";

type DropdownMixedOption = DropdownOption | DropdownGroupOption | DropdownDividerOption;

export interface DropdownItem {
  key: string;
  label?: string;
  icon?: Component;
  danger?: boolean;
  checked?: boolean;
  divider?: boolean;
  disabled?: boolean;
}

export function toDropdownOptions(options: DropdownItem[]): DropdownMixedOption[] {
  return options.map((option) => {
    if (option.divider) {
      return { type: "divider", key: option.key };
    }
    const Icon = option.icon;
    return {
      key: option.key,
      label: option.label,
      disabled: option.disabled,
      icon: Icon ? () => h(NIcon, null, { default: () => h(Icon) }) : undefined,
      props: option.danger ? { class: "text-destructive" } : undefined,
    };
  });
}

type DropdownNodeProps = (
  option: DropdownOption | DropdownGroupOption,
) => Record<string, string | number | undefined>;

export const dropdownNodeProps: DropdownNodeProps = (option) => {
  const type = (option as { type?: string }).type;
  const disabled = (option as { disabled?: boolean }).disabled;
  return {
    role: type === "divider" ? "separator" : "menuitem",
    tabindex: type === "divider" ? undefined : -1,
    "aria-disabled": disabled ? "true" : undefined,
  };
};

let dropdownTrigger: HTMLElement | null = null;

function focusableDropdownItems(menu: HTMLElement) {
  return Array.from(
    menu.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])'),
  );
}

function setDropdownItemFocus(items: HTMLElement[], index: number) {
  items.forEach((item, itemIndex) => {
    item.tabIndex = itemIndex === index ? 0 : -1;
  });
  items[index]?.focus();
}

function normalizedTrigger(trigger: HTMLElement | null | undefined) {
  if (!trigger) return null;
  if (trigger.matches("button, a[href], [tabindex]")) return trigger;
  return trigger.querySelector<HTMLElement>("button, a[href], [tabindex]") ?? trigger;
}

/** 浮层打开后把键盘焦点送入第一个可用菜单项。 */
export function focusFirstDropdownItem(trigger?: HTMLElement | null) {
  const nextTrigger = normalizedTrigger(trigger);
  if (nextTrigger) dropdownTrigger = nextTrigger;
  void nextTick(() => {
    const menus = document.querySelectorAll<HTMLElement>('[role="menu"]');
    const menu = menus.item(menus.length - 1);
    if (!menu) return;
    const items = focusableDropdownItems(menu);
    if (items.length > 0) setDropdownItemFocus(items, 0);
  });
}

/** 菜单因 Esc / 选择项关闭后，把焦点还给仍存在的触发按钮。 */
export function restoreDropdownTriggerFocus() {
  void nextTick(() => {
    const active = document.activeElement as HTMLElement | null;
    const focusOutsideMenu =
      active &&
      active !== document.body &&
      active.isConnected &&
      !active.closest('[role="menu"]') &&
      active !== dropdownTrigger;
    if (focusOutsideMenu) return;
    if (dropdownTrigger?.isConnected) dropdownTrigger.focus();
  });
}

function handleDropdownMenuKeydown(event: KeyboardEvent) {
  const menu = event.currentTarget as HTMLElement;
  const items = focusableDropdownItems(menu);
  if (items.length === 0) return;
  const currentIndex = items.indexOf(document.activeElement as HTMLElement);
  let nextIndex: number | null = null;

  if (event.key === "ArrowDown")
    nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % items.length;
  else if (event.key === "ArrowUp")
    nextIndex = currentIndex <= 0 ? items.length - 1 : currentIndex - 1;
  else if (event.key === "Home") nextIndex = 0;
  else if (event.key === "End") nextIndex = items.length - 1;

  if (nextIndex !== null) {
    event.preventDefault();
    event.stopPropagation();
    setDropdownItemFocus(items, nextIndex);
    return;
  }

  if ((event.key === "Enter" || event.key === " ") && currentIndex >= 0) {
    event.preventDefault();
    event.stopPropagation();
    const clickTarget =
      items[currentIndex].querySelector<HTMLElement>("[data-dropdown-option]") ??
      items[currentIndex];
    clickTarget.click();
  } else if (event.key === "Escape") {
    restoreDropdownTriggerFocus();
  }
}

/** NDropdown 的菜单根节点没有默认 ARIA 语义，这里通过官方 menuProps 补齐。 */
export function dropdownMenuProps(label: string) {
  // Naive 的 DropdownMenuProps 类型把 HTMLAttributes 与纯字符串/数字索引相交，
  // 导致合法的事件处理器被索引签名拒绝；运行时 menuProps 会正常 merge 到菜单根节点。
  return (() => ({
    role: "menu",
    class: "ww-menu-text",
    "aria-label": label,
    "aria-orientation": "vertical",
    onKeydown: handleDropdownMenuKeydown,
  })) as unknown as NonNullable<DropdownProps["menuProps"]>;
}
