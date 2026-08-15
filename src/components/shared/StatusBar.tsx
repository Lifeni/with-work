import { useEffect, useState } from "react";
import { Check, Inbox, Moon, Sun } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn, formatTime } from "@/lib/utils";
import { useWorkspaceStore } from "@/stores/workspace";
import { useSettingsStore } from "@/stores/settings";
import { useStatusStore } from "@/stores/status";
import { useStagingStore } from "@/stores/staging";
import { useUiStore } from "@/stores/ui";
import { VIEW_LABELS, type ThemeMode } from "@/types";

const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: "light", label: "浅色" },
  { value: "dark", label: "深色" },
  { value: "system", label: "跟随系统" },
];

export function StatusBar() {
  const ws = useWorkspaceStore((s) => s.workspaces.find((w) => w.id === s.activeId));
  const { line, col } = useStatusStore();
  const stagingCount = useStagingStore((s) => s.items.length);
  const stagingOpen = useUiStore((s) => s.stagingOpen);
  const toggleStaging = useUiStore((s) => s.toggleStaging);
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);

  const [savedAt, setSavedAt] = useState(() => new Date());
  useEffect(() => {
    setSavedAt(new Date());
  }, [ws?.content]);

  return (
    <footer className="flex h-6 shrink-0 items-center gap-3 border-t border-border bg-muted px-3 text-[11px] text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span className="font-medium text-foreground/80">{ws?.name ?? "—"}</span>
        <span>·</span>
        <span>{VIEW_LABELS[ws?.view ?? "editor"]}</span>
      </span>
      <span className="font-mono">
        行 {line} · 列 {col}
      </span>
      <span>{ws?.content.length ?? 0} 字符</span>

      <div className="flex-1" />

      <button
        onClick={toggleStaging}
        className={cn(
          "flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-accent",
          stagingOpen && "bg-accent text-accent-foreground",
        )}
      >
        <Inbox className="size-3" />
        暂存区 ({stagingCount})
      </button>
      <span className="flex items-center gap-1">
        <Check className="size-3" />
        已自动保存 {formatTime(savedAt.getTime())}
      </span>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            title="切换主题"
            className="flex items-center rounded px-1.5 py-0.5 hover:bg-accent"
          >
            {theme === "dark" ? <Moon className="size-3" /> : <Sun className="size-3" />}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="mb-1 w-32">
          {THEME_OPTIONS.map((opt) => (
            <DropdownMenuItem key={opt.value} onClick={() => setTheme(opt.value)}>
              <span className="flex-1">{opt.label}</span>
              {theme === opt.value && <Check className="size-3.5" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </footer>
  );
}
