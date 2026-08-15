import { useRef, useState } from "react";
import { FolderOpen, ListOrdered, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { uid } from "@/lib/utils";
import { exportTemplates, parseTemplates } from "@/lib/backup";
import { useTemplatesStore } from "@/stores/templates";
import { useToastStore } from "@/stores/toast";
import type { SortTemplate } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** 打开时若提供，直接进入该模板的编辑状态 */
  editId?: string | null;
}

/** 自定义排序模板管理：名称 + 条目列表（每行一条，按从上到下顺序排列） */
export function TemplatesDialog({ open, onOpenChange, editId }: Props) {
  const templates = useTemplatesStore((s) => s.templates);
  const addTemplate = useTemplatesStore((s) => s.addTemplate);
  const updateTemplate = useTemplatesStore((s) => s.updateTemplate);
  const removeTemplate = useTemplatesStore((s) => s.removeTemplate);
  const toast = useToastStore((s) => s.push);

  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [group, setGroup] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // 外部指定编辑对象：打开时直接进入编辑状态（父组件以 key 重挂载，渲染期应用一次）
  const [appliedEditId, setAppliedEditId] = useState<string | null>(null);
  if (editId && editId !== appliedEditId) {
    const t = useTemplatesStore.getState().templates.find((x) => x.id === editId);
    setAppliedEditId(editId);
    if (t) {
      setEditingId(t.id);
      setName(t.name);
      setContent(t.items.join("\n"));
      setGroup(t.group ?? "");
    }
  }

  const resetForm = () => {
    setName("");
    setContent("");
    setGroup("");
    setEditingId(null);
  };

  const startEdit = (t: SortTemplate) => {
    setEditingId(t.id);
    setName(t.name);
    setContent(t.items.join("\n"));
    setGroup(t.group ?? "");
  };

  const save = () => {
    const items = content
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (items.length === 0) {
      toast("请输入模板内容（每行一条）");
      return;
    }
    const t: SortTemplate = {
      id: editingId ?? uid(),
      name: name.trim() || (items[0].length > 12 ? `${items[0].slice(0, 12)}…` : items[0]),
      items,
      group: group.trim() || undefined,
    };
    if (editingId) updateTemplate(t);
    else addTemplate(t);
    resetForm();
    toast("模板已保存");
  };

  const onImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    void file.text().then((raw) => {
      const res = parseTemplates(raw);
      if (!res.ok) {
        toast(res.error);
        return;
      }
      useTemplatesStore.getState().replaceAll(res.templates);
      toast(`已导入 ${res.templates.length} 个模板`);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>自定义排序模板</DialogTitle>
          <DialogDescription>
            提供一个顺序列表（每行一条），用于把文本按模板顺序排列；模板支持导入 / 导出。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 rounded-md border border-border p-2.5">
          <div className="grid grid-cols-[1fr_180px] gap-2">
            <Input
              placeholder="模板名称（可选）"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-8 text-xs"
            />
            <Input
              placeholder="分组（可选）"
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
          <Textarea
            rows={4}
            placeholder="模板条目，每行一条（按从上到下顺序排列）"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-20 font-mono text-xs"
          />
          <div className="flex items-center gap-2">
            <div className="flex-1" />
            <Button size="sm" className="h-7 text-xs" onClick={save}>
              <Plus className="size-3.5" />
              {editingId ? "更新模板" : "保存模板"}
            </Button>
            {editingId && (
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={resetForm}>
                取消编辑
              </Button>
            )}
          </div>
        </div>

        <div className="max-h-56 min-h-20 space-y-1.5 overflow-y-auto">
          {templates.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">
              还没有模板，在上方添加第一个吧
            </p>
          ) : (
            templates.map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5"
              >
                <ListOrdered className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="w-32 shrink-0 truncate text-xs font-medium" title={t.name}>
                  {t.name}
                </span>
                {t.group && (
                  <Badge variant="secondary" className="shrink-0 text-[9px]">
                    {t.group}
                  </Badge>
                )}
                <Badge variant="secondary">{t.items.length} 条</Badge>
                <span
                  className="min-w-0 flex-1 truncate text-xs text-muted-foreground"
                  title={t.items.join("、")}
                >
                  {t.items.slice(0, 4).join("、")}
                  {t.items.length > 4 ? "…" : ""}
                </span>
                <Button variant="ghost" size="icon-sm" title="编辑" onClick={() => startEdit(t)}>
                  <Pencil className="size-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title="删除"
                  className="text-destructive hover:text-destructive"
                  onClick={() => removeTemplate(t.id)}
                >
                  <Trash2 className="size-3" />
                </Button>
              </div>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload className="size-3.5" />
            导入模板
          </Button>
          <Button variant="outline" size="sm" onClick={exportTemplates}>
            <FolderOpen className="size-3.5" />
            导出模板
          </Button>
        </DialogFooter>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={onImportFile}
        />
      </DialogContent>
    </Dialog>
  );
}
