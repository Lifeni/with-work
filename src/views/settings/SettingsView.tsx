import { useRef, useState } from "react";
import favicon from "@/assets/favicon.svg";
import {
  Database,
  Download,
  ExternalLink,
  FileCode2,
  FileDown,
  FileText,
  Info,
  Palette,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Input } from "@/components/ui/input";
import { Toggle } from "@/components/ui/toggle";
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
import { useSettingsStore, DEFAULT_FONT_FAMILY } from "@/stores/settings";
import { useStagingStore } from "@/stores/staging";
import { useToastStore } from "@/stores/toast";
import type { BackupData, ThemeMode } from "@/types";

const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: "light", label: "浅色" },
  { value: "dark", label: "深色" },
  { value: "system", label: "跟随系统" },
];

export default function SettingsView() {
  const settings = useSettingsStore();
  const toast = useToastStore((s) => s.push);

  const [pendingBackup, setPendingBackup] = useState<BackupData | null>(null);
  const [confirmImport, setConfirmImport] = useState(false);
  const [confirmClearStaging, setConfirmClearStaging] = useState(false);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const backupRef = useRef<HTMLInputElement>(null);
  const rulesRef = useRef<HTMLInputElement>(null);

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
    <div className="p-4">
      <div className="mx-auto grid max-w-3xl gap-4 md:grid-cols-2">
        {/* 左列：外观 + 关于 */}
        <div className="space-y-4">
          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
              <Palette className="size-4 text-muted-foreground" />
              外观
            </h2>
            <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-24 shrink-0 text-xs text-muted-foreground">主题</span>
              <div className="flex gap-1.5">
                {THEME_OPTIONS.map((opt) => (
                  <Toggle
                    key={opt.value}
                    active={settings.theme === opt.value}
                    onClick={() => settings.setTheme(opt.value)}
                  >
                    {opt.label}
                  </Toggle>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-24 shrink-0 text-xs text-muted-foreground">编辑器字号</span>
              <Input
                type="number"
                min={10}
                max={24}
                value={settings.fontSize}
                onChange={(e) => settings.setFontSize(Number(e.target.value) || 14)}
                className="h-7 w-20 text-xs"
              />
              <span className="text-xs text-muted-foreground">10 – 24 px</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-24 shrink-0 text-xs text-muted-foreground">自动换行</span>
              <Toggle
                active={settings.wordWrap}
                onClick={() => settings.setWordWrap(!settings.wordWrap)}
              >
                {settings.wordWrap ? "开启" : "关闭"}
              </Toggle>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-24 shrink-0 text-xs text-muted-foreground">编辑器字体</span>
              <Input
                value={settings.editorFontFamily}
                onChange={(e) => settings.setEditorFontFamily(e.target.value)}
                className="h-7 flex-1 font-mono text-xs"
              />
              <Button
                variant="outline"
                size="sm"
                className="h-7 shrink-0 text-xs"
                onClick={() => settings.setEditorFontFamily(DEFAULT_FONT_FAMILY)}
              >
                恢复默认
              </Button>
            </div>
          </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
              <Info className="size-4 text-muted-foreground" />
              关于
            </h2>
            <div className="flex items-center gap-3">
              <img src={favicon} alt="一点微小的工作" className="h-12 w-12 rounded-full" />
              <div className="text-xs text-muted-foreground">
                <p className="text-sm font-semibold text-foreground">一点微小的工作</p>
                <p>
                  版本 100.0.0{__BUILD_MODE__ === "single" && " 单文件版"} 🕯️
                </p>
                <p>
                  构建时间{" "}
                  {new Date(__BUILD_TIME__).toLocaleString("zh-CN", {
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  })}
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {/* 单文件版本身就是单文件，不再提供下载入口 */}
              {__BUILD_MODE__ !== "single" && (
                <a
                  href="./with-work-single.html"
                  download="一点微小的工作.html"
                  title="下载单文件版本（离线可运行）"
                  className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-border bg-transparent px-3 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <FileDown className="size-3.5" />
                  下载单文件版
                </a>
              )}
              <a
                href="https://github.com/Lifeni/with-work"
                target="_blank"
                rel="noreferrer"
                title="在 GitHub 上查看源码"
                className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-border bg-transparent px-3 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <ExternalLink className="size-3.5" />
                GitHub 仓库
              </a>
            </div>
          </section>
        </div>

        {/* 右列：数据管理 */}
        <div className="space-y-4">
          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
              <Database className="size-4 text-muted-foreground" />
              数据管理
            </h2>
          <p className="mb-3 text-xs text-muted-foreground">
            所有工作区、暂存区、替换规则、模板与设置均自动保存在浏览器本地，可随时导出备份或清空。
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={exportBackup}>
              <Download className="size-3.5" />
              导出全部备份
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="h-7 text-xs"
              onClick={() => backupRef.current?.click()}
            >
              <Upload className="size-3.5" />
              导入备份
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={exportRules}>
              <FileCode2 className="size-3.5" />
              导出替换规则
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => rulesRef.current?.click()}
            >
              <Upload className="size-3.5" />
              导入替换规则
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={exportCurrentWorkspace}
            >
              <FileText className="size-3.5" />
              导出当前工作区（.txt）
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs text-destructive hover:text-destructive"
              onClick={() => setConfirmClearStaging(true)}
            >
              <Trash2 className="size-3.5" />
              清空暂存区
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="h-7 text-xs"
              onClick={() => setConfirmClearAll(true)}
            >
              <Trash2 className="size-3.5" />
              清空所有数据
            </Button>
          </div>
          </section>
        </div>
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

      <ConfirmDialog
        open={confirmImport}
        title="导入备份"
        description="导入备份将覆盖当前的全部数据（工作区、暂存区、规则、模板、设置），确定继续吗？"
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
        open={confirmClearStaging}
        title="清空暂存区"
        description="将删除暂存区中的所有文本条目。"
        confirmText="清空"
        destructive
        onConfirm={() => {
          useStagingStore.getState().clear();
          setConfirmClearStaging(false);
          toast("暂存区已清空");
        }}
        onCancel={() => setConfirmClearStaging(false)}
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
    </div>
  );
}
