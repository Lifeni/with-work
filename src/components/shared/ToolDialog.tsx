import { useEffect, useState } from "react";
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
import { applyTool, getToolInput } from "@/lib/applyTool";
import { useToastStore } from "@/stores/toast";
import type { SplitDelimiter } from "@/lib/split";
import type { GlobalTool, ToolConfig } from "@/tools/registry";

interface Props {
  tool: GlobalTool | null;
  onClose: () => void;
}

const DEFAULT_CONFIG: ToolConfig = { delimiter: "newline", dedupe: false, ignoreEmpty: true };

export function ToolDialog({ tool, onClose }: Props) {
  const toast = useToastStore((s) => s.push);
  const [config, setConfig] = useState<ToolConfig>(DEFAULT_CONFIG);
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");

  // 打开时读取当前输入并重置配置
  useEffect(() => {
    if (tool) {
      setInput(getToolInput());
      setConfig(DEFAULT_CONFIG);
    }
  }, [tool]);

  // 实时预览
  useEffect(() => {
    if (tool) setOutput(tool.run(input, config));
  }, [tool, input, config]);

  const execute = () => {
    if (!tool) return;
    const res = applyTool(tool, (i) => tool.run(i, config));
    if (res) toast(res.message);
    onClose();
  };

  return (
    <Dialog open={!!tool} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{tool?.name}</DialogTitle>
          <DialogDescription>{tool?.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-xs text-muted-foreground">分隔符</span>
            <select
              value={config.delimiter}
              onChange={(e) =>
                setConfig({ ...config, delimiter: e.target.value as SplitDelimiter })
              }
              className="h-7 rounded-md border border-border bg-transparent px-2 text-xs outline-none hover:bg-accent"
            >
              <option value="newline">换行</option>
              <option value="comma">英文逗号</option>
              <option value="cn-comma">中文逗号</option>
              <option value="space">空格 / Tab</option>
              <option value="custom">自定义正则</option>
            </select>
            {config.delimiter === "custom" && (
              <Input
                value={config.customRegex ?? ""}
                onChange={(e) => setConfig({ ...config, customRegex: e.target.value })}
                placeholder="如 [，,、;；]"
                className="h-7 min-w-0 flex-1 font-mono text-xs"
              />
            )}
          </div>
          <div className="flex gap-1.5">
            <Toggle
              active={config.ignoreEmpty ?? true}
              onClick={() => setConfig({ ...config, ignoreEmpty: !(config.ignoreEmpty ?? true) })}
            >
              忽略空项
            </Toggle>
            <Toggle
              active={config.dedupe ?? false}
              onClick={() => setConfig({ ...config, dedupe: !(config.dedupe ?? false) })}
            >
              去重
            </Toggle>
          </div>
          <div>
            <p className="mb-1 text-[10px] text-muted-foreground">预览（仅显示前 300 字符）</p>
            <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap break-all rounded-md border border-border bg-muted/40 p-2 text-xs">
              {output.slice(0, 300) || "（无结果）"}
            </pre>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            取消
          </Button>
          <Button size="sm" onClick={execute}>
            执行并替换
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
