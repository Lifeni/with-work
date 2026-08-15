import { useRef, useState } from "react";
import {
  Check,
  Database,
  Download,
  FileCode2,
  FileText,
  FolderOpen,
  ListOrdered,
  Moon,
  Plus,
  Settings,
  Sun,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import favicon from "@/assets/favicon.svg";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ToolDialog } from "@/components/shared/ToolDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { applyTool } from "@/lib/applyTool";
import { useWorkspaceStore } from "@/stores/workspace";
import { useSettingsStore } from "@/stores/settings";
import { useToastStore } from "@/stores/toast";
import {
  applyBackup,
  clearAllData,
  exportBackup,
  exportCurrentWorkspace,
  exportRules,
  parseBackup,
  parseRules,
} from "@/lib/backup";
import { useRulesStore } from "@/stores/rules";
import { tools, type GlobalTool } from "@/tools/registry";
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
  const view = useWorkspaceStore((s) => s.workspaces.find((w) => w.id === s.activeId)?.view);
  const setView = useWorkspaceStore((s) => s.setView);
  const toast = useToastStore((s) => s.push);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [pendingBackup, setPendingBackup] = useState<BackupData | null>(null);
  const [confirmImport, setConfirmImport] = useState(false);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [dialogTool, setDialogTool] = useState<GlobalTool | null>(null);
  const backupRef = useRef<HTMLInputElement>(null);
  const rulesRef = useRef<HTMLInputElement>(null);

  const commitRename = (id: string, fallback: string) => {
    renameWorkspace(id, renameValue.trim() || fallback);
    setRenamingId(null);
  };

  /** 顶栏功能按钮：在 列表工具 / 设置 与 编辑器 之间切换 */
  const toggleView = (target: "list" | "settings") => {
    if (!activeId) return;
    setView(activeId, view === target ? "editor" : target);
  };

  /** 常用工具：有选区处理选区，否则处理全文；Ctrl+Z 可撤销 */
  const runTool = (tool: GlobalTool) => {
    if (tool.needsConfig) {
      setDialogTool(tool);
      return;
    }
    const res = applyTool(tool, (input) => tool.run(input));
    if (res) toast(res.message);
  };

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

  return (
    <header className="flex h-9 shrink-0 items-stretch bg-card">
      {/* 品牌区：英文左、中文右 */}
      <div className="flex shrink-0 items-center gap-1.5 border-r border-border px-2.5">
        <img src={favicon} alt="With Work" className="h-7 w-7 rounded-full" />
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground">With Work</span>
          <span className="text-xs font-semibold leading-none">一点微小的工作</span>
        </div>
      </div>

      {/* 常用工具（Photoshop 式，一行图标） */}
      <div className="no-scrollbar flex shrink-0 items-center gap-0.5 overflow-x-auto border-r border-border px-1.5">
        {tools.map((t) => (
          <Tooltip key={t.id}>
            <TooltipTrigger asChild>
              <button
                title={t.name}
                onClick={() => runTool(t)}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <t.icon className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{t.name}</TooltipContent>
          </Tooltip>
        ))}
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
              onClick={() => setActive(w.id)}
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
      </div>

      <div className="flex shrink-0 items-center gap-1 border-l border-border px-2">
        <Button
          variant={view === "list" ? "secondary" : "ghost"}
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={() => toggleView("list")}
        >
          <ListOrdered className="size-3.5" />
          列表工具
        </Button>
        <Button
          variant={view === "settings" ? "secondary" : "ghost"}
          size="icon-sm"
          title="设置"
          onClick={() => toggleView("settings")}
        >
          <Settings />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs">
              <Database className="size-3.5" />
              数据
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

      <ToolDialog tool={dialogTool} onClose={() => setDialogTool(null)} />

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
