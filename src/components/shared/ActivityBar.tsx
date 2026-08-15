import { FileDiff, FileText, ListOrdered, Settings, type LucideIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/stores/workspace";
import type { ViewId } from "@/types";

const VIEWS: { id: ViewId; label: string; icon: LucideIcon }[] = [
  { id: "editor", label: "编辑器", icon: FileText },
  { id: "diff", label: "文本对比", icon: FileDiff },
  { id: "list", label: "列表工具", icon: ListOrdered },
  { id: "settings", label: "设置", icon: Settings },
];

export function ActivityBar() {
  const activeId = useWorkspaceStore((s) => s.activeId);
  const view = useWorkspaceStore((s) => s.workspaces.find((w) => w.id === s.activeId)?.view ?? "editor");
  const setView = useWorkspaceStore((s) => s.setView);

  return (
    <aside className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-border bg-card py-2">
      {VIEWS.map((v) => (
        <Tooltip key={v.id}>
          <TooltipTrigger asChild>
            <button
              title={v.label}
              onClick={() => activeId && setView(activeId, v.id)}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-md transition-colors",
                view === v.id
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-accent-foreground",
              )}
            >
              <v.icon className="size-5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">{v.label}</TooltipContent>
        </Tooltip>
      ))}
    </aside>
  );
}
