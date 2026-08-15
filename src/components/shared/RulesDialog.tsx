import { useRef, useState } from "react";
import { FolderOpen, Pencil, Plus, Trash2, Upload } from "lucide-react";
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
import { Toggle } from "@/components/ui/toggle";
import { uid } from "@/lib/utils";
import { exportRules, parseRules } from "@/lib/backup";
import { useRulesStore } from "@/stores/rules";
import { useToastStore } from "@/stores/toast";
import type { ReplaceRule } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** 打开时若提供，将当前查找/替换内容带入表单，便于保存为新规则 */
  initialDraft?: { find: string; replace: string; isRegex: boolean; matchCase: boolean } | null;
}

export function RulesDialog({ open, onOpenChange, initialDraft }: Props) {
  const rules = useRulesStore((s) => s.rules);
  const addRule = useRulesStore((s) => s.addRule);
  const updateRule = useRulesStore((s) => s.updateRule);
  const removeRule = useRulesStore((s) => s.removeRule);
  const toast = useToastStore((s) => s.push);

  const [name, setName] = useState("");
  // 打开时带入当前查找/替换内容：父组件以 key 控制重挂载，因此直接在初始值中应用
  const [find, setFind] = useState(initialDraft?.find ?? "");
  const [replace, setReplace] = useState(initialDraft?.replace ?? "");
  const [isRegex, setIsRegex] = useState(initialDraft?.isRegex ?? false);
  const [matchCase, setMatchCase] = useState(initialDraft?.matchCase ?? false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setName("");
    setFind("");
    setReplace("");
    setIsRegex(false);
    setMatchCase(false);
    setEditingId(null);
  };

  const startEdit = (r: ReplaceRule) => {
    setEditingId(r.id);
    setName(r.name);
    setFind(r.find);
    setReplace(r.replace);
    setIsRegex(r.isRegex);
    setMatchCase(r.matchCase);
  };

  const save = () => {
    if (!find) {
      toast("请输入查找内容");
      return;
    }
    const rule: ReplaceRule = {
      id: editingId ?? uid(),
      name: name.trim() || (find.length > 12 ? `${find.slice(0, 12)}…` : find),
      find,
      replace,
      isRegex,
      matchCase,
    };
    if (editingId) updateRule(rule);
    else addRule(rule);
    resetForm();
    toast("规则已保存");
  };

  const onImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    void file.text().then((raw) => {
      const res = parseRules(raw);
      if (!res.ok) {
        toast(res.error);
        return;
      }
      useRulesStore.getState().replaceAll(res.rules);
      toast(`已导入 ${res.rules.length} 条替换规则`);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>替换规则</DialogTitle>
          <DialogDescription>
            保存常用替换规则，在替换面板中一键调用；规则支持导入 / 导出。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 rounded-md border border-border p-2.5">
          <div className="grid grid-cols-3 gap-2">
            <Input
              placeholder="规则名称（可选）"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-8 text-xs"
            />
            <Input
              placeholder="查找内容"
              value={find}
              onChange={(e) => setFind(e.target.value)}
              className="h-8 font-mono text-xs"
            />
            <Input
              placeholder="替换为"
              value={replace}
              onChange={(e) => setReplace(e.target.value)}
              className="h-8 font-mono text-xs"
            />
          </div>
          <div className="flex items-center gap-2">
            <Toggle active={isRegex} onClick={() => setIsRegex(!isRegex)}>
              正则
            </Toggle>
            <Toggle active={matchCase} onClick={() => setMatchCase(!matchCase)}>
              区分大小写
            </Toggle>
            <div className="flex-1" />
            <Button size="sm" className="h-7 text-xs" onClick={save}>
              <Plus className="size-3.5" />
              {editingId ? "更新规则" : "保存规则"}
            </Button>
            {editingId && (
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={resetForm}>
                取消编辑
              </Button>
            )}
          </div>
        </div>

        <div className="max-h-56 min-h-24 space-y-1.5 overflow-y-auto">
          {rules.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">
              还没有规则，在上方添加第一条吧
            </p>
          ) : (
            rules.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5"
              >
                <span className="w-32 shrink-0 truncate text-xs font-medium" title={r.name}>
                  {r.name}
                </span>
                <span
                  className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground"
                  title={r.find}
                >
                  {r.find}
                </span>
                <span className="text-muted-foreground">→</span>
                <span
                  className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground"
                  title={r.replace}
                >
                  {r.replace}
                </span>
                {r.isRegex && <Badge variant="secondary">正则</Badge>}
                {r.matchCase && <Badge variant="outline">Aa</Badge>}
                <Button variant="ghost" size="icon-sm" title="编辑" onClick={() => startEdit(r)}>
                  <Pencil className="size-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title="删除"
                  className="text-destructive hover:text-destructive"
                  onClick={() => removeRule(r.id)}
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
            导入规则
          </Button>
          <Button variant="outline" size="sm" onClick={exportRules}>
            <FolderOpen className="size-3.5" />
            导出规则
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
