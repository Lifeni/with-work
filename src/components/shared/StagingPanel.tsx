import { useState } from "react";
import {
  ArrowRightLeft,
  Copy,
  FileDiff,
  FileText,
  Import,
  ListOrdered,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { cn, formatTime } from "@/lib/utils";
import { importText, type ImportTarget } from "@/lib/transfer";
import { useStagingStore } from "@/stores/staging";
import { useToastStore } from "@/stores/toast";
import { useUiStore } from "@/stores/ui";

const IMPORT_TARGETS: { value: ImportTarget; label: string; icon: typeof FileText }[] = [
  { value: "editor", label: "编辑器（当前工作区）", icon: FileText },
  { value: "diff-left", label: "文本对比 · 左侧", icon: FileDiff },
  { value: "diff-right", label: "文本对比 · 右侧", icon: FileDiff },
  { value: "list-source", label: "列表工具 · 源文本", icon: ListOrdered },
  { value: "list-reference", label: "列表工具 · 参考列表", icon: ListOrdered },
  { value: "list-compare", label: "列表工具 · 对比列表", icon: ListOrdered },
];

export function StagingPanel() {
  const items = useStagingStore((s) => s.items);
  const add = useStagingStore((s) => s.add);
  const remove = useStagingStore((s) => s.remove);
  const clear = useStagingStore((s) => s.clear);
  const open = useUiStore((s) => s.stagingOpen);
  const setOpen = useUiStore((s) => s.setStagingOpen);
  const toast = useToastStore((s) => s.push);

  const [draft, setDraft] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);

  const copyItem = (text: string) => {
    void navigator.clipboard.writeText(text);
    toast("已复制");
  };

  return (
    <div
      className={cn(
        "fixed inset-y-0 right-0 z-40 flex w-80 flex-col border-l border-border bg-card shadow-2xl transition-transform duration-200",
        open ? "translate-x-0" : "translate-x-full",
      )}
    >
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <h2 className="text-sm font-semibold">全局暂存区</h2>
        <Badge variant="secondary">{items.length}</Badge>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="icon-sm"
          title="清空暂存区"
          onClick={() => setConfirmClear(true)}
        >
          <Trash2 className="size-3.5" />
        </Button>
        <Button variant="ghost" size="icon-sm" title="收起" onClick={() => setOpen(false)}>
          <X className="size-3.5" />
        </Button>
      </div>

      <div className="space-y-1.5 border-b border-border p-3">
        <Textarea
          rows={2}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="粘贴或输入文本，暂存后供各工具取用…"
          className="min-h-12 text-xs"
        />
        <Button
          size="sm"
          className="h-7 w-full text-xs"
          onClick={() => {
            add(draft);
            setDraft("");
            if (draft.trim()) toast("已添加到暂存区");
          }}
        >
          <Plus className="size-3.5" />
          添加
        </Button>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {items.length === 0 ? (
          <div className="flex h-32 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border text-xs text-muted-foreground">
            <span>暂存区为空</span>
            <span>在上方粘贴文本即可暂存</span>
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="rounded-md border border-border bg-background p-2">
              <p className="line-clamp-3 whitespace-pre-wrap break-all text-xs">{item.text}</p>
              <div className="mt-1.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                <span>{item.text.length} 字符</span>
                <span>·</span>
                <span>{formatTime(item.createdAt)}</span>
                <div className="flex-1" />
                <button
                  title="复制"
                  onClick={() => copyItem(item.text)}
                  className="rounded p-0.5 hover:bg-accent hover:text-accent-foreground"
                >
                  <Copy className="size-3" />
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      title="导入到工具"
                      className="flex items-center gap-0.5 rounded p-0.5 hover:bg-accent hover:text-accent-foreground"
                    >
                      <Import className="size-3" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>导入到</DropdownMenuLabel>
                    {IMPORT_TARGETS.map((t) => (
                      <DropdownMenuItem key={t.value} onClick={() => importText(t.value, item.text)}>
                        <t.icon />
                        {t.label}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => remove(item.id)}
                    >
                      <Trash2 />
                      删除此条目
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="flex items-center gap-1 border-t border-border px-3 py-1.5 text-[10px] text-muted-foreground">
        <ArrowRightLeft className="size-3" />
        暂存区为全局共用，所有工作区共享
      </div>

      <ConfirmDialog
        open={confirmClear}
        title="清空暂存区"
        description={`确定清空暂存区中的 ${items.length} 条文本吗？`}
        confirmText="清空"
        destructive
        onConfirm={() => {
          clear();
          setConfirmClear(false);
          toast("暂存区已清空");
        }}
        onCancel={() => setConfirmClear(false)}
      />
    </div>
  );
}
