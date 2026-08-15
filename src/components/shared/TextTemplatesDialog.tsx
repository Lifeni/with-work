import { useRef, useState } from "react";
import { FileText, FolderOpen, Pencil, Plus, Trash2, Upload } from "lucide-react";
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
import { exportTextTemplates, parseTextTemplates } from "@/lib/backup";
import { useTextTemplatesStore } from "@/stores/textTemplates";
import { useToastStore } from "@/stores/toast";
import type { TextTemplate } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** 打开时若提供，直接进入该模板的编辑状态 */
  editId?: string | null;
}

/** 自定义文本模板管理：名称 + 一段可复用文本，可拖拽 / 点击插入到编辑器 */
export function TextTemplatesDialog({ open, onOpenChange, editId }: Props) {
  const templates = useTextTemplatesStore((s) => s.templates);
  const addTemplate = useTextTemplatesStore((s) => s.addTemplate);
  const updateTemplate = useTextTemplatesStore((s) => s.updateTemplate);
  const removeTemplate = useTextTemplatesStore((s) => s.removeTemplate);
  const toast = useToastStore((s) => s.push);

  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [group, setGroup] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // 外部指定编辑对象：打开时直接进入编辑状态（父组件以 key 重挂载，渲染期应用一次）
  const [appliedEditId, setAppliedEditId] = useState<string | null>(null);
  if (editId && editId !== appliedEditId) {
    const t = useTextTemplatesStore.getState().templates.find((x) => x.id === editId);
    setAppliedEditId(editId);
    if (t) {
      setEditingId(t.id);
      setName(t.name);
      setContent(t.text);
      setGroup(t.group ?? "");
    }
  }

  const resetForm = () => {
    setName("");
    setContent("");
    setGroup("");
    setEditingId(null);
  };

  const startEdit = (t: TextTemplate) => {
    setEditingId(t.id);
    setName(t.name);
    setContent(t.text);
    setGroup(t.group ?? "");
  };

  const save = () => {
    if (!content.trim()) {
      toast("请输入模板文本");
      return;
    }
    const t: TextTemplate = {
      id: editingId ?? uid(),
      name: name.trim() || (content.length > 12 ? `${content.slice(0, 12)}…` : content),
      text: content,
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
      const res = parseTextTemplates(raw);
      if (!res.ok) {
        toast(res.error);
        return;
      }
      useTextTemplatesStore.getState().replaceAll(res.templates);
      toast(`已导入 ${res.templates.length} 个模板`);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>自定义文本模板</DialogTitle>
          <DialogDescription>
            一段可复用的文本，可拖拽或点击插入到编辑器；模板支持导入 / 导出。
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
            placeholder="模板文本内容"
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
                <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="w-32 shrink-0 truncate text-xs font-medium" title={t.name}>
                  {t.name}
                </span>
                {t.group && (
                  <Badge variant="secondary" className="shrink-0 text-[9px]">
                    {t.group}
                  </Badge>
                )}
                <span
                  className="min-w-0 flex-1 truncate text-xs text-muted-foreground"
                  title={t.text}
                >
                  {t.text.replace(/\n/g, " ↵ ")}
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
          <Button variant="outline" size="sm" onClick={exportTextTemplates}>
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
