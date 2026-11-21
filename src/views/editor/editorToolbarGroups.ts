import {
  ArrowRight,
  ArrowUp,
  Highlight,
  ListNumbers,
  Replace,
  Scissors,
  Settings,
} from "@vicons/tabler";
import type { ToolbarVisibilityGroup } from "@/tools/toolbarVisibility";

export const EDITOR_TOOLBAR_GROUPS: ToolbarVisibilityGroup[] = [
  {
    key: "find-replace",
    label: "查找与替换",
    items: [
      { id: "find-options", label: "查找模式", icon: Highlight },
      { id: "find-navigation", label: "上一个 / 下一个", icon: ArrowUp },
      { id: "replace-rules", label: "替换规则", icon: Replace },
      { id: "replace-actions", label: "执行替换", icon: ArrowRight },
      { id: "replace-manage", label: "管理替换规则", icon: Settings },
    ],
  },
  {
    key: "text-tools",
    label: "文本处理",
    items: [
      { id: "split-join", label: "分割与组合", icon: Scissors },
      { id: "sort-rules", label: "排序模板", icon: ListNumbers },
      { id: "sort-manage", label: "管理排序模板", icon: Settings },
    ],
  },
];
