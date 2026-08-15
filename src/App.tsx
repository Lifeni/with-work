import { useEffect } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TitleBar } from "@/components/shared/TitleBar";
import { ToolsRail } from "@/components/shared/ToolsRail";
import { StatusBar } from "@/components/shared/StatusBar";
import { StagingPanel } from "@/components/shared/StagingPanel";
import { SettingsDialog } from "@/components/shared/SettingsDialog";
import { ToastViewport } from "@/components/shared/ToastViewport";
import EditorView from "@/views/editor/EditorView";
import { useWorkspaceStore } from "@/stores/workspace";
import { useSettingsStore } from "@/stores/settings";
import { useUiStore } from "@/stores/ui";
import { initTheme } from "@/lib/theme";

export default function App() {
  const workspaceCount = useWorkspaceStore((s) => s.workspaces.length);
  const settingsOpen = useUiStore((s) => s.settingsOpen);
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen);

  useEffect(() => {
    initTheme(useSettingsStore.getState().theme);
  }, []);

  useEffect(() => {
    if (workspaceCount === 0) useWorkspaceStore.getState().createWorkspace();
  }, [workspaceCount]);

  // 设置以弹窗形式打开，主区域始终是编辑器
  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
        <div className="flex min-h-0 flex-1">
          <ToolsRail />
          <div className="flex min-w-0 flex-1 flex-col">
            <TitleBar />
            <div className="flex min-h-0 flex-1">
              {/* 编辑器常驻：切换工作区复用实例，避免重建闪烁 */}
              <main className="min-w-0 flex-1 overflow-hidden">
                <EditorView />
              </main>
            </div>
          </div>
          <StagingPanel />
        </div>
        <StatusBar />
        <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
        <ToastViewport />
      </div>
    </TooltipProvider>
  );
}
