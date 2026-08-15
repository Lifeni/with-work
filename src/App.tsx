import { useEffect, type ComponentType } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TitleBar } from "@/components/shared/TitleBar";
import { ToolsRail } from "@/components/shared/ToolsRail";
import { StatusBar } from "@/components/shared/StatusBar";
import { StagingPanel } from "@/components/shared/StagingPanel";
import { ToastViewport } from "@/components/shared/ToastViewport";
import EditorView from "@/views/editor/EditorView";
import ListView from "@/views/list/ListView";
import SettingsView from "@/views/settings/SettingsView";
import { useWorkspaceStore } from "@/stores/workspace";
import { useSettingsStore } from "@/stores/settings";
import { initTheme } from "@/lib/theme";
import type { ViewId } from "@/types";

const viewComponents: Record<ViewId, ComponentType> = {
  editor: EditorView,
  list: ListView,
  settings: SettingsView,
};

const VALID_VIEWS = Object.keys(viewComponents) as ViewId[];

export default function App() {
  const activeId = useWorkspaceStore((s) => s.activeId);
  const rawView = useWorkspaceStore((s) => s.workspaces.find((w) => w.id === s.activeId)?.view);
  const workspaceCount = useWorkspaceStore((s) => s.workspaces.length);

  useEffect(() => {
    initTheme(useSettingsStore.getState().theme);
  }, []);

  useEffect(() => {
    if (workspaceCount === 0) useWorkspaceStore.getState().createWorkspace();
  }, [workspaceCount]);

  // 兼容旧数据：未知视图（如已移除的 diff）回退到编辑器
  const view: ViewId = VALID_VIEWS.includes(rawView as ViewId) ? (rawView as ViewId) : "editor";
  const View = viewComponents[view];

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
        <div className="flex min-h-0 flex-1">
          <div className="flex min-w-0 flex-1 flex-col">
            <TitleBar />
            <div className="flex min-h-0 flex-1">
              <ToolsRail />
              <main className="min-w-0 flex-1 overflow-hidden">
                <View key={activeId} />
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
