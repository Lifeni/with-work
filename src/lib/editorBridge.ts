import type * as monaco from "monaco-editor";
import type { ReplaceRule } from "@/types";

// 当前编辑器实例的全局引用：全局工具菜单等"贡献功能"通过它读取选区/执行编辑
let activeEditor: monaco.editor.IStandaloneCodeEditor | null = null;

export function setActiveEditor(editor: monaco.editor.IStandaloneCodeEditor | null) {
  activeEditor = editor;
}

export function getActiveEditor() {
  return activeEditor;
}

// 规则应用事件：暂存区等入口请求把替换规则应用到查找替换面板
let ruleListener: ((rule: ReplaceRule) => void) | null = null;

export function setRuleApplyListener(fn: ((rule: ReplaceRule) => void) | null) {
  ruleListener = fn;
}

/** 请求应用规则；返回是否已投递给查找替换面板 */
export function requestApplyRule(rule: ReplaceRule): boolean {
  if (!ruleListener) return false;
  ruleListener(rule);
  return true;
}
