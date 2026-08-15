import { useEffect, type ComponentType } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TitleBar } from "@/components/shared/TitleBar";
import { ToolsRail } from "@/components/shared/ToolsRail";
import { StatusBar } from "@/components/shared/StatusBar";
import { StagingPanel } from "@/components/shared/StagingPanel";
import { ToastViewport } from "@/components/shared/ToastViewport";
import EditorView from "@/views/editor/EditorView";
import SettingsView from "@/views/settings/SettingsView";
import { useWorkspaceStore } from "@/stores/workspace";
import { useSettingsStore } from "@/stores/settings";
import { useUiStore } from "@/stores/ui";
import { initTheme } from "@/lib/theme";

export default function App() {
  const activeId = useWorkspaceStore((s) => s.activeId);
  const workspaceCount = useWorkspaceStore((s) => s.workspaces.length);
  const settingsOpen = useUiStore((s) => s.settingsOpen);

  useEffect(() => {
    initTheme(useSettingsStore.getState().theme);
  }, []);

  useEffect(() => {
    if (workspaceCount === 0) useWorkspaceStore.getState().createWorkspace();
  }, [workspaceCount]);

  // 设置是全局独立标签页，不归属任何工作区
  const View: ComponentType = settingsOpen ? SettingsView : EditorView;

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
        <div className="flex min-h-0 flex-1">
          <ToolsRail />
          <div className="flex min-w-0 flex-1 flex-col">
            <TitleBar />
            <div className="flex min-h-0 flex-1">
              <main className="min-w-0 flex-1 overflow-hidden">
                <View key={settingsOpen ? "settings" : activeId} />
              </main>
            </div>
          </div>
          <StagingPanel />
        </div>
        <StatusBar />
        <ToastViewport />
      </div>
    </TooltipProvider>
  );
}
