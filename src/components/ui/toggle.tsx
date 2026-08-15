import * as React from "react";
import { cn } from "@/lib/utils";

export interface ToggleProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

/** 小号开关按钮（激活态高亮），用于正则 / 大小写等选项 */
const Toggle = React.forwardRef<HTMLButtonElement, ToggleProps>(
  ({ className, active, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      aria-pressed={active}
      className={cn(
        "inline-flex h-7 items-center justify-center gap-1 rounded-md border px-2 text-xs font-medium transition-colors [&_svg]:size-3.5",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        className,
      )}
      {...props}
    />
  ),
);
Toggle.displayName = "Toggle";

export { Toggle };
