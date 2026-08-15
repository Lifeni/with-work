import { useEffect, useRef, useState } from "react";
import {
  ArrowRightLeft,
  Check,
  Copy,
  FileDiff,
  FileText,
  Inbox,
  ListOrdered,
  PanelRightOpen,
  Pencil,
  Plus,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { RulesDialog } from "@/components/shared/RulesDialog";
import { TemplatesDialog } from "@/components/shared/TemplatesDialog";
import { TextTemplatesDialog } from "@/components/shared/TextTemplatesDialog";
import { Textarea } from "@/components/ui/textarea";
import { cn, formatTime, uid } from "@/lib/utils";
import { getToolInput } from "@/lib/applyTool";
import { getActiveEditor } from "@/lib/editorBridge";
import { splitLines } from "@/lib/split";
import { sortByReference } from "@/lib/sort";
import { importText } from "@/lib/transfer";
import { useRulesStore } from "@/stores/rules";
import { useStagingStore } from "@/stores/staging";
import { useSettingsStore } from "@/stores/settings";
import { useTemplatesStore } from "@/stores/templates";
import { useTextTemplatesStore } from "@/stores/textTemplates";
import { useToastStore } from "@/stores/toast";
import { useUiStore } from "@/stores/ui";
import { useWorkspaceStore } from "@/stores/workspace";
import type { ReplaceRule, SortTemplate, TextTemplate } from "@/types";

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
  // 模板区高度可拖动调节（记忆在设置中）
  const templateHeight = useSettingsStore((s) => s.stagingTemplateHeight ?? 240);
  const setTemplateHeight = useSettingsStore((s) => s.setStagingTemplateHeight);
  const panelRef = useRef<HTMLDivElement>(null);

  const [draft, setDraft] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  // 条目行内编辑（双击或编辑按钮进入）
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [textTemplatesOpen, setTextTemplatesOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  // 条目编辑：从列表直接进入对应管理对话框的编辑状态
  const [editTextTemplateId, setEditTextTemplateId] = useState<string | null>(null);
  const [editSortTemplateId, setEditSortTemplateId] = useState<string | null>(null);
  const [editRuleId, setEditRuleId] = useState<string | null>(null);
  // 底部模板区当前标签：文本模板 / 排序模板 / 替换规则
  const [tplTab, setTplTab] = useState<"text" | "sort" | "rules">("text");
  // 拖拽悬停反馈：编辑器文本可拖入暂存区 / 模板区
  const [dragOver, setDragOver] = useState<"staging" | "templates" | null>(null);

  // 替换规则区
  const rules = useRulesStore((s) => s.rules);

  // 窄屏（<lg）下暂存区默认收起，通过右下角悬浮按钮打开
  useEffect(() => {
    if (window.matchMedia("(max-width: 1023px)").matches) setOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 文本模板区
  const textTemplates = useTextTemplatesStore((s) => s.templates);
  const removeTextTemplate = useTextTemplatesStore((s) => s.removeTemplate);

  // 排序模板区
  const templates = useTemplatesStore((s) => s.templates);
  const removeTemplate = useTemplatesStore((s) => s.removeTemplate);

  /** 拖动调节面板宽度（增量式，按下时记录起点避免突跳；记忆在设置中） */
  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = stagingWidth;
    const onMove = (ev: MouseEvent) => {
      const w = startWidth + (startX - ev.clientX);
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

  /** 把文本模板插入到当前聚焦的编辑器（选区优先） */
  const insertTextTemplate = (t: TextTemplate) => {
    const editor = getActiveEditor();
    const model = editor?.getModel();
    const sel = editor?.getSelection();
    if (editor && model && sel) {
      editor.executeEdits("ww-text-template", [{ range: sel, text: t.text }]);
      editor.focus();
    } else {
      const ws = useWorkspaceStore.getState();
      if (ws.activeId) ws.setContent(ws.activeId, t.text);
    }
    toast(`已插入模板「${t.name}」`);
  };

  const copyItem = (text: string) => {
    void navigator.clipboard.writeText(text);
    toast("已复制");
  };

  /** 暂存区条目行内编辑 */
  const startItemEdit = (id: string) => {
    const item = useStagingStore.getState().items.find((i) => i.id === id);
    if (!item) return;
    setEditingItemId(id);
    setEditDraft(item.text);
  };
  const saveItemEdit = () => {
    if (editingItemId) useStagingStore.getState().updateItem(editingItemId, editDraft);
    setEditingItemId(null);
  };
  const cancelItemEdit = () => setEditingItemId(null);

  /** 从列表条目进入对应管理对话框的编辑状态 */
  const editTextTemplate = (id: string) => {
    setEditTextTemplateId(id);
    setTextTemplatesOpen(true);
  };
  const editSortTemplate = (id: string) => {
    setEditSortTemplateId(id);
    setTemplatesOpen(true);
  };
  const editRule = (id: string) => {
    setEditRuleId(id);
    setRulesOpen(true);
  };

  // 规则卡片：双击编辑，拖拽到编辑器按规则替换（单击无行为）
  const handleRuleDoubleClick = (r: ReplaceRule) => {
    editRule(r.id);
  };

  /** 拖拽悬停 / 落下：编辑器文本可拖入暂存区或模板区 */
  const handleDragOver =
    (zone: "staging" | "templates") => (e: React.DragEvent) => {
      if (e.dataTransfer.types.includes("text/plain")) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        setDragOver(zone);
      }
    };

  const handleDragLeave = () => setDragOver(null);

  const handleDrop = (zone: "staging" | "templates") => (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(null);
    // 拖回原区域（来源标记相同）：不重复添加
    if (e.dataTransfer.getData("application/x-with-work-source") === zone) return;
    const text = e.dataTransfer.getData("text/plain");
    if (!text.trim()) return;
    if (zone === "staging") {
      add(text);
      toast("已拖入暂存区");
    } else {
      const name = text.length > 12 ? `${text.slice(0, 12)}…` : text;
      useTextTemplatesStore.getState().addTemplate({ id: uid(), name, text, group: undefined });
      toast(`已保存为文本模板「${name}」`);
    }
  };

  /** 拖动调节模板区高度（记忆在设置中） */
  const startTemplateResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const onMove = (ev: MouseEvent) => {
      const rect = panelRef.current?.getBoundingClientRect();
      if (!rect) return;
      const h = rect.bottom - ev.clientY;
      setTemplateHeight(Math.min(rect.height * 0.7, Math.max(160, h)));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    // 宽屏停靠式面板；窄屏改为右侧悬浮抽屉（默认收起，右下角按钮打开）
    <>
      <div
        className={cn(
          "bg-card",
          open
            ? "fixed inset-y-0 right-0 z-40 shadow-2xl lg:z-auto lg:shadow-none"
            : "hidden lg:block",
          "lg:relative lg:shrink-0 lg:overflow-hidden lg:border-l lg:border-border",
        )}
        style={{ width: open ? stagingWidth : 0 }}
      >
        {/* 左边缘拖拽手柄（悬停高亮，贴边显示） */}
        <div
          className="absolute inset-y-0 left-0 z-10 w-2 cursor-ew-resize rounded hover:bg-primary/20"
          title="拖动调节面板宽度"
          onMouseDown={startResize}
        />
        <div ref={panelRef} className="flex h-full flex-col" style={{ width: stagingWidth }}>
          <div className="flex h-9 items-center gap-2 border-b border-border px-3">
            {/* 标题靠左：图标 + 文字 + 计数徽标 */}
            <span className="flex items-center gap-1.5 text-xs font-medium">
              <Inbox className="size-3.5" />
              全局暂存区
              <Badge variant="secondary">{items.length}</Badge>
            </span>
            <div className="flex-1" />
            <Button
              variant="ghost"
              size="icon-sm"
              title="清空暂存区"
              onClick={() => setConfirmClear(true)}
            >
              <Trash2 />
            </Button>
            <Button variant="ghost" size="icon-sm" title="收起" onClick={() => setOpen(false)}>
              <X />
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

          <div
            data-testid="staging-drop-zone"
            className={cn(
              "min-h-0 flex-1 space-y-2 overflow-y-auto p-3 transition-colors",
              dragOver === "staging" && "bg-accent/60",
            )}
            onDragOver={handleDragOver("staging")}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop("staging")}
          >
            {items.length === 0 ? (
              <div className="flex h-32 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border text-xs text-muted-foreground">
                <span>暂存区为空</span>
                <span>在上方粘贴文本即可暂存</span>
              </div>
            ) : (
              items.map((item) =>
                editingItemId === item.id ? (
                  <div
                    key={item.id}
                    className="rounded-md border border-border bg-background p-2"
                  >
                    <textarea
                      autoFocus
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          saveItemEdit();
                        }
                        if (e.key === "Escape") cancelItemEdit();
                      }}
                      rows={3}
                      className="w-full resize-none rounded border border-border bg-background p-1.5 text-xs outline-none focus:ring-1 focus:ring-ring"
                    />
                    <div className="mt-1.5 flex items-center justify-end gap-1">
                      <button
                        title="保存"
                        onClick={saveItemEdit}
                        className="rounded bg-primary px-2 py-0.5 text-[10px] text-primary-foreground hover:opacity-90"
                      >
                        保存
                      </button>
                      <button
                        title="取消"
                        onClick={cancelItemEdit}
                        className="rounded px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-accent"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    key={item.id}
                    draggable
                    title="拖拽到编辑器可快速插入，双击可编辑"
                    onDoubleClick={() => startItemEdit(item.id)}
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", item.text);
                      e.dataTransfer.setData("application/x-with-work-source", "staging");
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                    className="cursor-grab rounded-md border border-border bg-background p-2 active:cursor-grabbing"
                  >
                    <p className="line-clamp-3 whitespace-pre-wrap break-all text-xs">
                      {item.text}
                    </p>
                    <div className="mt-1.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                      <span>{item.text.length} 字符</span>
                      <span>·</span>
                      <span>{formatTime(item.createdAt)}</span>
                      <div className="flex-1" />
                      <button
                        title="编辑"
                        onClick={() => startItemEdit(item.id)}
                        className="rounded p-0.5 hover:bg-accent hover:text-accent-foreground"
                      >
                        <Pencil className="size-3" />
                      </button>
                      <button
                        title="复制"
                        onClick={() => copyItem(item.text)}
                        className="rounded p-0.5 hover:bg-accent hover:text-accent-foreground"
                      >
                        <Copy className="size-3" />
                      </button>
                      <button
                        title="导入到对比·左侧"
                        onClick={() => importText("diff-left", item.text)}
                        className="rounded p-0.5 hover:bg-accent hover:text-accent-foreground"
                      >
                        <FileDiff className="size-3" />
                      </button>
                      <button
                        title="导入到对比·右侧"
                        onClick={() => importText("diff-right", item.text)}
                        className="rounded p-0.5 hover:bg-accent hover:text-accent-foreground"
                      >
                        <FileDiff className="size-3" />
                      </button>
                      <button
                        title="删除此条目"
                        onClick={() => remove(item.id)}
                        className="rounded p-0.5 text-destructive hover:bg-accent"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  </div>
                ),
              )
            )}
          </div>

          <div className="flex items-center gap-1 border-t border-border px-3 py-1.5 text-[10px] text-muted-foreground">
            <ArrowRightLeft className="size-3" />
            暂存区为全局共用，所有工作区共享；拖拽条目到编辑器可快速插入
          </div>

          {/* 上下分栏分隔条：拖动调节模板区高度 */}
          <div className="relative shrink-0 border-t border-border">
            <div
              className="absolute -top-1.5 left-0 h-3 w-full cursor-row-resize rounded hover:bg-primary/20"
              title="拖动调节模板区高度"
              onMouseDown={startTemplateResize}
            />
          </div>

          {/* 下半部：模板区（文本模板 / 排序模板 / 替换规则，标签切换；支持拖入保存为文本模板） */}
          <div
            data-testid="template-drop-zone"
            className={cn("shrink-0 transition-colors", dragOver === "templates" && "bg-accent/60")}
            style={{ height: templateHeight }}
            onDragOver={handleDragOver("templates")}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop("templates")}
          >
            <div className="flex h-full flex-col">
            <div className="flex items-center gap-1.5 px-3 py-2">
              <div className="flex items-center gap-0.5 rounded-md bg-muted p-0.5">
                <button
                  type="button"
                  onClick={() => setTplTab("text")}
                  className={cn(
                    "rounded px-2 py-0.5 text-[11px] transition-colors",
                    tplTab === "text"
                      ? "bg-background font-medium shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  文本模板
                </button>
                <button
                  type="button"
                  onClick={() => setTplTab("sort")}
                  className={cn(
                    "rounded px-2 py-0.5 text-[11px] transition-colors",
                    tplTab === "sort"
                      ? "bg-background font-medium shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  排序模板
                </button>
                <button
                  type="button"
                  onClick={() => setTplTab("rules")}
                  className={cn(
                    "rounded px-2 py-0.5 text-[11px] transition-colors",
                    tplTab === "rules"
                      ? "bg-background font-medium shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  替换规则
                </button>
              </div>
              <Badge variant="secondary">
                {tplTab === "text"
                  ? textTemplates.length
                  : tplTab === "sort"
                    ? templates.length
                    : rules.length}
              </Badge>
              <div className="flex-1" />
              <Button
                variant="ghost"
                size="icon-sm"
                title={
                  tplTab === "text"
                    ? "管理文本模板"
                    : tplTab === "sort"
                      ? "管理排序模板"
                      : "管理替换规则"
                }
                onClick={() => {
                  if (tplTab === "text") {
                    setEditTextTemplateId(null);
                    setTextTemplatesOpen(true);
                  } else if (tplTab === "sort") {
                    setEditSortTemplateId(null);
                    setTemplatesOpen(true);
                  } else {
                    setEditRuleId(null);
                    setRulesOpen(true);
                  }
                }}
              >
                <Settings2 />
              </Button>
            </div>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-3">
              {tplTab === "text" ? (
                textTemplates.length === 0 ? (
                  <p className="rounded-md border border-dashed border-border p-3 text-center text-[11px] text-muted-foreground">
                    暂无文本模板
                    <br />
                    点击右上角管理按钮创建
                    <br />
                    （一段可复用文本，可拖入编辑器）
                  </p>
                ) : (
                  [...new Set(textTemplates.map((t) => t.group ?? "未分组"))].map((group) => (
                    <div key={group}>
                      <p className="mb-1 text-[10px] font-medium text-muted-foreground">{group}</p>
                      <div className="space-y-1.5">
                        {textTemplates
                          .filter((t) => (t.group ?? "未分组") === group)
                          .map((t) => (
                            <div
                              key={t.id}
                              draggable
                              title="拖拽到编辑器可快速插入，双击可编辑"
                              onDoubleClick={() => editTextTemplate(t.id)}
                              onDragStart={(e) => {
                                e.dataTransfer.setData("text/plain", t.text);
                                e.dataTransfer.setData("application/x-with-work-source", "templates");
                                e.dataTransfer.effectAllowed = "copy";
                              }}
                              className="cursor-grab rounded-md border border-border bg-background p-2 active:cursor-grabbing"
                            >
                              <div className="flex items-center gap-1.5 text-xs">
                                <span
                                  className="min-w-0 flex-1 truncate font-medium"
                                  title={t.name}
                                >
                                  {t.name}
                                </span>
                                <span className="shrink-0 text-[10px] text-muted-foreground">
                                  {t.text.length} 字符
                                </span>
                                <button
                                  title="插入到编辑器"
                                  onClick={() => insertTextTemplate(t)}
                                  className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                                >
                                  <FileText className="size-3" />
                                </button>
                                <button
                                  title="编辑模板"
                                  onClick={() => editTextTemplate(t.id)}
                                  className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                                >
                                  <Pencil className="size-3" />
                                </button>
                                <button
                                  title="删除模板"
                                  onClick={() => removeTextTemplate(t.id)}
                                  className="shrink-0 rounded p-0.5 text-destructive hover:bg-accent"
                                >
                                  <Trash2 className="size-3" />
                                </button>
                              </div>
                              <p className="mt-0.5 line-clamp-2 whitespace-pre-wrap break-all text-[10px] text-muted-foreground">
                                {t.text.length > 60 ? `${t.text.slice(0, 60)}…` : t.text}
                              </p>
                            </div>
                          ))}
                      </div>
                    </div>
                  ))
                )
              ) : tplTab === "sort" ? (
                templates.length === 0 ? (
                  <p className="rounded-md border border-dashed border-border p-3 text-center text-[11px] text-muted-foreground">
                    暂无排序模板
                    <br />
                    点击右上角管理按钮创建
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
                              title="拖拽到编辑器可快速插入，双击可编辑"
                              onDoubleClick={() => editSortTemplate(t.id)}
                              onDragStart={(e) => {
                                e.dataTransfer.setData("text/plain", t.items.join("\n"));
                                e.dataTransfer.setData("application/x-with-work-source", "templates");
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
                                  className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                                >
                                  <ListOrdered className="size-3" />
                                </button>
                                <button
                                  title="编辑模板"
                                  onClick={() => editSortTemplate(t.id)}
                                  className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                                >
                                  <Pencil className="size-3" />
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
                )
              ) : rules.length === 0 ? (
                <p className="rounded-md border border-dashed border-border p-3 text-center text-[11px] text-muted-foreground">
                  暂无替换规则
                  <br />
                  点击右上角管理按钮创建
                  <br />
                  （查找替换时可一键应用）
                </p>
              ) : (
                rules.map((r) => (
                  <div
                    key={r.id}
                    draggable
                    title="双击编辑，拖到编辑器按此规则替换"
                    onDoubleClick={() => handleRuleDoubleClick(r)}
                    onDragStart={(e) => {
                      e.dataTransfer.setData(
                        "text/plain",
                        `${r.name}：${r.find} → ${r.replace}`,
                      );
                      e.dataTransfer.setData("application/x-with-work-rule", r.id);
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                    className="cursor-grab rounded-md border border-border bg-background p-2 transition-colors hover:bg-accent/60 active:cursor-grabbing"
                  >
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="min-w-0 flex-1 truncate font-medium" title={r.name}>
                        {r.name}
                      </span>
                      {r.isRegex && (
                        <Badge variant="secondary" className="shrink-0 text-[9px]">
                          正则
                        </Badge>
                      )}
                      <button
                        title="编辑规则"
                        onClick={(e) => {
                          e.stopPropagation();
                          editRule(r.id);
                        }}
                        className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      >
                        <Pencil className="size-3" />
                      </button>
                      <span className="shrink-0 rounded p-0.5">
                        <Check className="size-3 text-muted-foreground" />
                      </span>
                    </div>
                    <p
                      className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground"
                      title={`${r.find} → ${r.replace}`}
                    >
                      {r.find} → {r.replace}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
          </div>

          <TemplatesDialog
            key={editSortTemplateId ?? "manage-sort"}
            open={templatesOpen}
            onOpenChange={setTemplatesOpen}
            editId={editSortTemplateId}
          />
          <TextTemplatesDialog
            key={editTextTemplateId ?? "manage-text"}
            open={textTemplatesOpen}
            onOpenChange={setTextTemplatesOpen}
            editId={editTextTemplateId}
          />
          <RulesDialog
            key={editRuleId ?? "manage-rule"}
            open={rulesOpen}
            onOpenChange={setRulesOpen}
            editId={editRuleId}
          />

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

      {/* 悬浮按钮：暂存区关闭时显示（宽窄屏统一），点击打开抽屉/面板 */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          title="打开暂存区"
          className="fixed bottom-9 right-3 z-30 flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105"
        >
          <PanelRightOpen className="size-4" />
        </button>
      )}
    </>
  );
}
