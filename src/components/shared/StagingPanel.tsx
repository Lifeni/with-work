import { useState } from "react";
import {
  ArrowRightLeft,
  Copy,
  FileDiff,
  FileText,
  Import,
  ListOrdered,
  Plus,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { TemplatesDialog } from "@/components/shared/TemplatesDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { formatTime } from "@/lib/utils";
import { getToolInput } from "@/lib/applyTool";
import { getActiveEditor } from "@/lib/editorBridge";
import { splitLines } from "@/lib/split";
import { sortByReference } from "@/lib/sort";
import { importText, type ImportTarget } from "@/lib/transfer";
import { useStagingStore } from "@/stores/staging";
import { useSettingsStore } from "@/stores/settings";
import { useTemplatesStore } from "@/stores/templates";
import { useToastStore } from "@/stores/toast";
import { useUiStore } from "@/stores/ui";
import { useWorkspaceStore } from "@/stores/workspace";
import type { SortTemplate } from "@/types";

const IMPORT_TARGETS: { value: ImportTarget; label: string; icon: typeof FileText }[] = [
  { value: "diff-left", label: "对比 · 左侧", icon: FileDiff },
  { value: "diff-right", label: "对比 · 右侧", icon: FileDiff },
  { value: "list-reference", label: "列表工具 · 参考列表", icon: ListOrdered },
];

export function StagingPanel() {
  const items = useStagingStore((s) => s.items);
  const add = useStagingStore((s) => s.add);
  const remove = useStagingStore((s) => s.remove);
  const clear = useStagingStore((s) => s.clear);
  const open = useUiStore((s) => s.stagingOpen);
  const setOpen = useUiStore((s) => s.setStagingOpen);
  const toast = useToastStore((s) => s.push);
  // 宽度可拖动调节（记忆在设置中）
  const stagingWidth = useSettingsStore((s) => s.stagingWidth ?? 320);
  const setStagingWidth = useSettingsStore((s) => s.setStagingWidth);

  const [draft, setDraft] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);

  // 自定义模板区
  const templates = useTemplatesStore((s) => s.templates);
  const removeTemplate = useTemplatesStore((s) => s.removeTemplate);

  /** 拖动调节面板宽度 */
  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const onMove = (ev: MouseEvent) => {
      const w = window.innerWidth - ev.clientX;
      setStagingWidth(Math.min(560, Math.max(240, w)));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  /** 按模板对编辑器内容（选区优先）排序并应用 */
  const applyTemplate = (t: SortTemplate) => {
    const input = getToolInput();
    if (!input.trim()) {
      toast("编辑器没有可排序的内容");
      return;
    }
    const lines = splitLines(input);
    const r = sortByReference(lines, t.items);
    const text = r.sorted.join("\n");
    const editor = getActiveEditor();
    const model = editor?.getModel();
    const sel = editor?.getSelection();
    if (editor && model && sel && !sel.isEmpty()) {
      editor.executeEdits("ww-template", [{ range: sel, text }]);
    } else if (editor && model) {
      editor.executeEdits("ww-template", [{ range: model.getFullModelRange(), text }]);
    } else {
      const ws = useWorkspaceStore.getState();
      if (ws.activeId) ws.setContent(ws.activeId, text);
    }
    toast(
      `已按模板「${t.name}」排序` +
        (r.unmatched.length > 0 ? `，${r.unmatched.length} 项未匹配` : ""),
    );
  };

  const copyItem = (text: string) => {
    void navigator.clipboard.writeText(text);
    toast("已复制");
  };

  return (
    // 停靠式面板：占据布局空间而非悬浮覆盖，宽度可拖动调节
    <div
      className="relative shrink-0 overflow-hidden border-l border-border bg-card"
      style={{ width: open ? stagingWidth : 0 }}
    >
      {/* 左边缘拖拽手柄 */}
      <div
        className="absolute inset-y-0 -left-2 z-10 w-4 cursor-ew-resize"
        title="拖动调节面板宽度"
        onMouseDown={startResize}
      />
      <div className="flex h-full flex-col" style={{ width: stagingWidth }}>
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
              <div
                key={item.id}
                draggable
                title="拖拽到编辑器可快速插入（双编辑器模式下可对比）"
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/plain", item.text);
                  e.dataTransfer.effectAllowed = "copy";
                }}
                className="cursor-grab rounded-md border border-border bg-background p-2 active:cursor-grabbing"
              >
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
                        <DropdownMenuItem
                          key={t.value}
                          onClick={() => importText(t.value, item.text)}
                        >
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
          暂存区为全局共用，所有工作区共享；拖拽条目到编辑器可快速插入
        </div>

        {/* 下半部：自定义模板区（排序模板） */}
        <div className="shrink-0 border-t border-border">
          <div className="flex items-center gap-2 px-3 py-2">
            <h3 className="text-xs font-semibold">自定义模板</h3>
            <Badge variant="secondary">{templates.length}</Badge>
            <div className="flex-1" />
            <Button
              variant="ghost"
              size="icon-sm"
              title="管理模板"
              onClick={() => setTemplatesOpen(true)}
            >
              <Settings2 />
            </Button>
          </div>
          <div className="max-h-44 space-y-2 overflow-y-auto px-3 pb-3">
            {templates.length === 0 ? (
              <p className="rounded-md border border-dashed border-border p-3 text-center text-[11px] text-muted-foreground">
                暂无模板，点击右上角管理按钮创建
                <br />
                （提供顺序列表，用于自定义排序）
              </p>
            ) : (
              [...new Set(templates.map((t) => t.group ?? "未分组"))].map((group) => (
                <div key={group}>
                  <p className="mb-1 text-[10px] font-medium text-muted-foreground">{group}</p>
                  <div className="space-y-1.5">
                    {templates
                      .filter((t) => (t.group ?? "未分组") === group)
                      .map((t) => (
                        <div
                          key={t.id}
                          draggable
                          title="拖拽到编辑器可快速插入（双编辑器模式下可对比）"
                          onDragStart={(e) => {
                            e.dataTransfer.setData("text/plain", t.items.join("\n"));
                            e.dataTransfer.effectAllowed = "copy";
                          }}
                          className="cursor-grab rounded-md border border-border bg-background p-2 active:cursor-grabbing"
                        >
                          <div className="flex items-center gap-1.5 text-xs">
                            <span className="min-w-0 flex-1 truncate font-medium" title={t.name}>
                              {t.name}
                            </span>
                            <span className="shrink-0 text-[10px] text-muted-foreground">
                              {t.items.length} 条
                            </span>
                            <button
                              title="按此模板排序编辑器文本"
                              onClick={() => applyTemplate(t)}
                              className="shrink-0 rounded p-0.5 hover:bg-accent hover:text-accent-foreground"
                            >
                              <ListOrdered className="size-3" />
                            </button>
                            <button
                              title="删除模板"
                              onClick={() => removeTemplate(t.id)}
                              className="shrink-0 rounded p-0.5 text-destructive hover:bg-accent"
                            >
                              <Trash2 className="size-3" />
                            </button>
                          </div>
                          <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                            {t.items.slice(0, 3).join("、")}
                            {t.items.length > 3 ? "…" : ""}
                          </p>
                        </div>
                      ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <TemplatesDialog open={templatesOpen} onOpenChange={setTemplatesOpen} />

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
    </div>
  );
}
