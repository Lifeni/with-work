import type { Component } from "vue";

export interface ToolbarVisibilityItem {
  id: string;
  label: string;
  icon?: Component;
}

export interface ToolbarVisibilityGroup {
  key: string;
  label: string;
  items: ToolbarVisibilityItem[];
}

/** 与顶部功能重复、默认不出现在悬浮栏的工具 */
export const DEFAULT_HIDDEN_TEXT_TOOL_IDS = ["split-list", "apply-rule"];

export function toolbarItemIds(groups: ToolbarVisibilityGroup[]): string[] {
  return groups.flatMap((group) => group.items.map((item) => item.id));
}
