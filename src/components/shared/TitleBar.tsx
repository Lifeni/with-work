import { useRef, useState } from "react";
import {
  Check,
  Database,
  Download,
  FileCode2,
  FileText,
  FolderOpen,
  Moon,
  Plus,
  Redo2,
  Settings,
  Sun,
  Trash2,
  Undo2,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { getActiveEditor } from "@/lib/editorBridge";
import { useWorkspaceStore } from "@/stores/workspace";
import { useSettingsStore } from "@/stores/settings";
import { useUiStore } from "@/stores/ui";
import { useToastStore } from "@/stores/toast";
import {
  applyBackup,
  clearAllData,
  exportBackup,
  exportCurrentWorkspace,
  exportRules,
  exportTemplates,
  parseBackup,
  parseRules,
  parseTemplates,
} from "@/lib/backup";
import { useRulesStore } from "@/stores/rules";
import { useTemplatesStore } from "@/stores/templates";
import type { BackupData, ThemeMode } from "@/types";

const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: "light", label: "浅色" },
  { value: "dark", label: "深色" },
  { value: "system", label: "跟随系统" },
];

export function TitleBar() {
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeId = useWorkspaceStore((s) => s.activeId);
  const createWorkspace = useWorkspaceStore((s) => s.createWorkspace);
  const deleteWorkspace = useWorkspaceStore((s) => s.deleteWorkspace);
  const renameWorkspace = useWorkspaceStore((s) => s.renameWorkspace);
  const setActive = useWorkspaceStore((s) => s.setActive);

  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const settingsOpen = useUiStore((s) => s.settingsOpen);
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen);
  const toast = useToastStore((s) => s.push);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [pendingBackup, setPendingBackup] = useState<BackupData | null>(null);
  const [confirmImport, setConfirmImport] = useState(false);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const backupRef = useRef<HTMLInputElement>(null);
  const rulesRef = useRef<HTMLInputElement>(null);
  const templatesRef = useRef<HTMLInputElement>(null);

  const commitRename = (id: string, fallback: string) => {
    renameWorkspace(id, renameValue.trim() || fallback);
    setRenamingId(null);
  };

  /** 编辑操作（作用于当前聚焦的编辑器） */
  const undoFocused = () => getActiveEditor()?.trigger("toolbar", "undo", null);
  const redoFocused = () => getActiveEditor()?.trigger("toolbar", "redo", null);
  const clearFocused = () => {
    const ed = getActiveEditor();
    const model = ed?.getModel();
    if (!ed || !model) {
      toast("没有可清空的编辑器");
      return;
    }
    ed.executeEdits("ww-clear", [{ range: model.getFullModelRange(), text: "" }]);
    toast("已清空聚焦编辑器（Ctrl+Z 可撤销）");
  };

  /** 顶栏设置按钮：切换全局设置标签页 */
  const toggleSettings = () => setSettingsOpen(!settingsOpen);

  const onBackupFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    void file.text().then((raw) => {
      const res = parseBackup(raw);
      if (!res.ok) {
        toast(res.error);
        return;
      }
      setPendingBackup(res.data);
      setConfirmImport(true);
    });
  };

  const onRulesFile = (e: React.ChangeEvent<HTMLInputElement>) => {
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

  const onTemplatesFile = (e: React.ChangeEvent<HTMLInputElement>) => {
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
      toast(`已导入 ${res.templates.length} 个排序模板`);
    });
  };

  return (
    <header className="flex h-9 shrink-0 items-stretch bg-card">
      {/* 编辑操作：撤销 / 重做 / 清空（作用于聚焦编辑器） */}
      <div className="flex shrink-0 items-center gap-0.5 border-r border-border px-1.5">
        <Button variant="ghost" size="icon-sm" title="撤销 (Ctrl+Z)" onClick={undoFocused}>
          <Undo2 />
        </Button>
        <Button variant="ghost" size="icon-sm" title="重做" onClick={redoFocused}>
          <Redo2 />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          title="清空聚焦编辑器"
          className="text-destructive hover:text-destructive"
          onClick={clearFocused}
        >
          <Trash2 />
        </Button>
      </div>

      {/* 工作区标签页（VS Code 风格：满高矩形，激活标签顶部高亮、底部与内容区相连） */}
      <div className="no-scrollbar flex min-w-0 flex-1 items-stretch overflow-x-auto">
        {workspaces.map((w) =>
          renamingId === w.id ? (
            <input
              key={w.id}
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={() => commitRename(w.id, w.name)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename(w.id, w.name);
                if (e.key === "Escape") setRenamingId(null);
              }}
              className="w-40 shrink-0 border-b border-primary bg-background px-3 text-xs outline-none"
            />
          ) : (
            <div
              key={w.id}
              role="tab"
              aria-selected={w.id === activeId}
              onClick={() => {
                setActive(w.id);
                setSettingsOpen(false);
              }}
              onDoubleClick={() => {
                setRenamingId(w.id);
                setRenameValue(w.name);
              }}
              className={cn(
                "group relative flex min-w-24 max-w-52 shrink-0 cursor-pointer select-none items-center gap-1.5 border-r border-border/60 px-3 text-xs transition-colors",
                w.id === activeId
                  ? "bg-background font-medium"
                  : "border-b border-border text-muted-foreground hover:bg-accent/60",
              )}
            >
              {w.id === activeId && <span className="absolute inset-x-0 top-0 h-0.5 bg-primary" />}
              <span className="truncate">{w.name}</span>
              <button
                title="关闭工作区"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteWorkspace(w.id);
                }}
                className="rounded-sm p-0.5 opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
              >
                <X className="size-3" />
              </button>
            </div>
          ),
        )}
        <button
          title="新建工作区"
          onClick={() => createWorkspace()}
          className="flex shrink-0 items-center px-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          <Plus className="size-4" />
        </button>
        {/* 全局设置标签页（不归属任何工作区） */}
        <div
          role="tab"
          aria-selected={settingsOpen}
          onClick={toggleSettings}
          className={cn(
            "group relative flex shrink-0 cursor-pointer select-none items-center gap-1.5 border-l border-border/60 px-3 text-xs transition-colors",
            settingsOpen ? "bg-background font-medium" : "text-muted-foreground hover:bg-accent/60",
          )}
        >
          {settingsOpen && <span className="absolute inset-x-0 top-0 h-0.5 bg-primary" />}
          <Settings className="size-3.5" />
          设置
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1 border-l border-border px-2">
        <Button
          variant={settingsOpen ? "secondary" : "ghost"}
          size="icon-sm"
          title="设置"
          onClick={toggleSettings}
        >
          <Settings />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" title="数据（导入 / 导出 / 备份）">
              <Database />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={exportBackup}>
              <Download /> 导出全部备份
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => backupRef.current?.click()}>
              <Upload /> 导入备份
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={exportRules}>
              <FileCode2 /> 导出替换规则
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => rulesRef.current?.click()}>
              <FolderOpen /> 导入替换规则
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={exportTemplates}>
              <FileCode2 /> 导出排序模板
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => templatesRef.current?.click()}>
              <FolderOpen /> 导入排序模板
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={exportCurrentWorkspace}>
              <FileText /> 导出当前工作区
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => setConfirmClearAll(true)}
            >
              <Trash2 /> 清空所有数据
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" title="切换主题">
              {theme === "dark" ? <Moon className="size-3.5" /> : <Sun className="size-3.5" />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-32">
            {THEME_OPTIONS.map((opt) => (
              <DropdownMenuItem key={opt.value} onClick={() => setTheme(opt.value)}>
                <span className="flex-1">{opt.label}</span>
                {theme === opt.value && <Check className="size-3.5" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <input
        ref={backupRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={onBackupFile}
      />
      <input
        ref={rulesRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={onRulesFile}
      />
      <input
        ref={templatesRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={onTemplatesFile}
      />

      <ConfirmDialog
        open={confirmImport}
        title="导入备份"
        description="导入备份将覆盖当前的全部数据（工作区、暂存区、规则、设置），确定继续吗？"
        confirmText="覆盖导入"
        destructive
        onConfirm={() => {
          if (pendingBackup) {
            applyBackup(pendingBackup);
            toast("备份已导入");
          }
          setConfirmImport(false);
          setPendingBackup(null);
        }}
        onCancel={() => {
          setConfirmImport(false);
          setPendingBackup(null);
        }}
      />
      <ConfirmDialog
        open={confirmClearAll}
        title="清空所有数据"
        description="将删除本地保存的全部工作区、暂存区、规则与设置，此操作不可恢复。"
        confirmText="全部清空"
        destructive
        onConfirm={() => clearAllData()}
        onCancel={() => setConfirmClearAll(false)}
      />
    </header>
  );
}
