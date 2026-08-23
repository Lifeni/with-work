import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "reka-ui";

// 下拉菜单：业务组件直接使用 reka-ui 原语 + 这里的样式常量，避免多层包装
export const DropdownMenu = DropdownMenuRoot;
export { DropdownMenuTrigger, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel };

export type { DropdownMenuContentProps } from "reka-ui";

export const dropdownContentClass =
  "z-[100] min-w-44 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-lg";

export const dropdownItemClass =
  "relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:size-3.5";

export const dropdownLabelClass = "px-2 py-1.5 text-xs font-medium text-muted-foreground";

export { DropdownMenuContent };
