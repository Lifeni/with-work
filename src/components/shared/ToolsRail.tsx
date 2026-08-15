import { useState } from "react";
import favicon from "@/assets/favicon.svg";
import { ToolDialog } from "@/components/shared/ToolDialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { applyTool } from "@/lib/applyTool";
import { useToastStore } from "@/stores/toast";
import { tools, type GlobalTool } from "@/tools/registry";

/** 左侧常用工具栏（类似 Photoshop 的工具面板）：品牌区 + 全局工具按钮 */
export function ToolsRail() {
  const toast = useToastStore((s) => s.push);
  const [dialogTool, setDialogTool] = useState<GlobalTool | null>(null);

  const runTool = (tool: GlobalTool) => {
    if (tool.needsConfig) {
      setDialogTool(tool);
      return;
    }
    const res = applyTool(tool, (input) => tool.run(input));
    if (res) toast(res.message);
  };

  return (
    <aside className="flex w-12 shrink-0 flex-col items-center gap-1.5 border-r border-border bg-card py-2.5">
      {/* 品牌区：Logo + 中文/英文竖排两列 */}
      <div className="flex shrink-0 flex-col items-center gap-2">
        <img src={favicon} alt="With Work" className="h-8 w-8 rounded-full" />
        <div className="flex gap-0.5">
          <span
            className="text-[11px] font-semibold leading-[1.5]"
            style={{ writingMode: "vertical-rl" }}
          >
            一点微小的工作
          </span>
          <span
            className="text-[9px] leading-[1.5] text-muted-foreground"
            style={{ writingMode: "vertical-rl" }}
          >
            With Work
          </span>
        </div>
      </div>

      <div className="mt-1 h-px w-7 shrink-0 bg-border" />

      {/* 常用工具（有选区处理选区，否则处理全文；Ctrl+Z 可撤销） */}
      <div className="flex min-h-0 w-full flex-1 flex-col items-center gap-1 overflow-y-auto pb-2">
        {tools.map((t) => (
          <Tooltip key={t.id}>
            <TooltipTrigger asChild>
              <button
                title={t.name}
                onClick={() => runTool(t)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <t.icon className="size-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">{t.name}</TooltipContent>
          </Tooltip>
        ))}
      </div>

      <ToolDialog tool={dialogTool} onClose={() => setDialogTool(null)} />
    </aside>
  );
}
