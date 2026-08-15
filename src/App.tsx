import { useEffect, type ComponentType } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TitleBar } from "@/components/shared/TitleBar";
import { ActivityBar } from "@/components/shared/ActivityBar";
import { StatusBar } from "@/components/shared/StatusBar";
import { StagingPanel } from "@/components/shared/StagingPanel";
import { ToastViewport } from "@/components/shared/ToastViewport";
import EditorView from "@/views/editor/EditorView";
import DiffView from "@/views/diff/DiffView";
import ListView from "@/views/list/ListView";
import SettingsView from "@/views/settings/SettingsView";
import { useWorkspaceStore } from "@/stores/workspace";
import { useSettingsStore } from "@/stores/settings";
import { initTheme } from "@/lib/theme";
import type { ViewId } from "@/types";

const viewComponents: Record<ViewId, ComponentType> = {
  editor: EditorView,
  diff: DiffView,
  list: ListView,
  settings: SettingsView,
};

export default function App() {
  const activeId = useWorkspaceStore((s) => s.activeId);
  const view = useWorkspaceStore((s) => s.workspaces.find((w) => w.id === s.activeId)?.view ?? "editor");
  const workspaceCount = useWorkspaceStore((s) => s.workspaces.length);

  useEffect(() => {
    initTheme(useSettingsStore.getState().theme);
  }, []);

  useEffect(() => {
    if (workspaceCount === 0) useWorkspaceStore.getState().createWorkspace();
  }, [workspaceCount]);

  const View = viewComponents[view];

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
        <TitleBar />
        <div className="flex min-h-0 flex-1">
          <ActivityBar />
          <main className="min-w-0 flex-1 overflow-hidden">
            <View key={activeId} />
          </main>
        </div>
        <StatusBar />
        <StagingPanel />
        <ToastViewport />
      </div>
    </TooltipProvider>
  );
}
