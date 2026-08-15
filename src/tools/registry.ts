import {
  AlignLeft,
  CaseLower,
  CaseUpper,
  Eraser,
  Filter,
  FlipVertical2,
  List,
  Replace,
  SortAsc,
  SortDesc,
  type LucideIcon,
} from "lucide-react";
import { applyReplacements } from "@/lib/replace";
import { splitText, type SplitDelimiter } from "@/lib/split";
import { useRulesStore } from "@/stores/rules";

export interface ToolConfig {
  delimiter?: SplitDelimiter;
  customRegex?: string;
  dedupe?: boolean;
  ignoreEmpty?: boolean;
  /** 按规则替换：选中的替换规则 id */
  ruleId?: string;
}

export interface GlobalTool {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  /** 需要配置参数时置为 true，点击后弹出配置对话框 */
  needsConfig?: boolean;
  run: (input: string, config?: ToolConfig) => string;
}

const lines = (input: string) => input.split(/\r?\n/);
const join = (arr: string[]) => arr.join("\n");
const compare = (a: string, b: string) => a.localeCompare(b, "zh-Hans-CN");

/**
 * 全局文本工具注册表。
 * 新增工具只需在此追加一条：{ id, name, description, icon, run }
 * 工具作用于当前工作区：有选区则处理选区，否则处理全文；Ctrl+Z 可撤销。
 * 后续可扩展 OCR 等需要异步处理的工具（run 可返回 Promise）。
 */
export const tools: GlobalTool[] = [
  {
    id: "lines-sort-asc",
    name: "行排序 · 升序",
    description: "按字母顺序升序排列每一行",
    icon: SortAsc,
    run: (i) => join([...lines(i)].sort(compare)),
  },
  {
    id: "lines-sort-desc",
    name: "行排序 · 降序",
    description: "按字母顺序降序排列每一行",
    icon: SortDesc,
    run: (i) => join([...lines(i)].sort((a, b) => -compare(a, b))),
  },
  {
    id: "lines-reverse",
    name: "反转行序",
    description: "把每一行的顺序颠倒",
    icon: FlipVertical2,
    run: (i) => join([...lines(i)].reverse()),
  },
  {
    id: "lines-dedupe",
    name: "去重行",
    description: "删除重复的行（保留首次出现的位置）",
    icon: Filter,
    run: (i) => join([...new Set(lines(i))]),
  },
  {
    id: "lines-trim",
    name: "去除行首尾空格",
    description: "清理每一行两端的空白字符",
    icon: AlignLeft,
    run: (i) => join(lines(i).map((s) => s.trim())),
  },
  {
    id: "lines-clean",
    name: "删除空行",
    description: "删除空白行",
    icon: Eraser,
    run: (i) => join(lines(i).filter((s) => s.trim() !== "")),
  },
  {
    id: "text-upper",
    name: "转大写",
    description: "全部转为大写字母",
    icon: CaseUpper,
    run: (i) => i.toUpperCase(),
  },
  {
    id: "text-lower",
    name: "转小写",
    description: "全部转为小写字母",
    icon: CaseLower,
    run: (i) => i.toLowerCase(),
  },
  {
    id: "split-list",
    name: "分割为列表",
    description: "按分隔符把文本拆成一行一条的列表",
    icon: List,
    needsConfig: true,
    run: (i, cfg) => {
      const r = splitText(i, {
        delimiter: cfg?.delimiter ?? "newline",
        customRegex: cfg?.customRegex,
        trim: true,
        ignoreEmpty: cfg?.ignoreEmpty ?? true,
        dedupe: cfg?.dedupe ?? false,
      });
      return r.items.join("\n");
    },
  },
  {
    id: "apply-rule",
    name: "按规则替换",
    description: "把一条替换规则应用到当前文本（选区优先）",
    icon: Replace,
    needsConfig: true,
    run: (i, cfg) => {
      const rule = useRulesStore.getState().rules.find((r) => r.id === cfg?.ruleId);
      if (!rule) return i;
      return applyReplacements(i, rule.find, rule.replace, rule.isRegex, rule.matchCase);
    },
  },
];
