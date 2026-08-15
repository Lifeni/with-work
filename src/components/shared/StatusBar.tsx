import { useState } from "react";
import { Check, Inbox } from "lucide-react";
import { cn, formatTime } from "@/lib/utils";
import { useWorkspaceStore } from "@/stores/workspace";
import { useStatusStore } from "@/stores/status";
import { useStagingStore } from "@/stores/staging";
import { useUiStore } from "@/stores/ui";

export function StatusBar() {
  const ws = useWorkspaceStore((s) => s.workspaces.find((w) => w.id === s.activeId));
  const { line, col } = useStatusStore();
  const stagingCount = useStagingStore((s) => s.items.length);
  const stagingOpen = useUiStore((s) => s.stagingOpen);
  const toggleStaging = useUiStore((s) => s.toggleStaging);
  const settingsOpen = useUiStore((s) => s.settingsOpen);
  const left = ws?.left ?? "";
  const right = ws?.right ?? "";

  // 内容变化即视为“已自动保存”时刻（渲染期调整状态，避免 effect 连锁渲染）
  const contentKey = `${left}\u0000${right}`;
  const [lastSavedContent, setLastSavedContent] = useState(contentKey);
  const [savedAt, setSavedAt] = useState(() => new Date());
  if (contentKey !== lastSavedContent) {
    setLastSavedContent(contentKey);
    setSavedAt(new Date());
  }

  return (
    <footer className="flex h-6 shrink-0 items-center gap-3 border-t border-border bg-muted px-3 text-[11px] text-muted-foreground">
      {settingsOpen ? (
        <span className="flex items-center gap-1.5">
          <span className="font-medium text-foreground/80">设置</span>
          <span>·</span>
          <span>弹窗</span>
        </span>
      ) : (
        <span className="font-medium text-foreground/80">{ws?.name ?? "—"}</span>
      )}
      <span className="hidden font-mono md:inline">
        行 {line} · 列 {col}
      </span>
      <span className="hidden sm:inline">
        左 {left.length} · 右 {right.length} 字符
      </span>

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
    </footer>
  );
}
