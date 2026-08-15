import { useState } from "react";
import { Wand2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ToolDialog } from "@/components/shared/ToolDialog";
import { applyTool } from "@/lib/applyTool";
import { useToastStore } from "@/stores/toast";
import { tools, type GlobalTool } from "@/tools/registry";

/** 全局工具入口：类似“贡献功能”，作用于当前工作区文本（选区优先） */
export function ToolMenu() {
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
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            title="全局工具"
            className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <Wand2 className="size-5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="right" className="w-64">
          <DropdownMenuLabel>全局工具（作用于当前工作区）</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {tools.map((t) => (
            <DropdownMenuItem key={t.id} title={t.description} onClick={() => runTool(t)}>
              <t.icon />
              <span className="flex-1">{t.name}</span>
              {t.needsConfig && (
                <Badge variant="secondary" className="text-[9px]">
                  配置
                </Badge>
              )}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <div className="px-2 py-1 text-[10px] leading-relaxed text-muted-foreground">
            选中文本则只处理选区，否则处理全文；Ctrl+Z 可撤销
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
      <ToolDialog tool={dialogTool} onClose={() => setDialogTool(null)} />
    </>
  );
}
