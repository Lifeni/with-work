import type * as monaco from "monaco-editor";

// 当前编辑器实例的全局引用：全局工具菜单等"贡献功能"通过它读取选区/执行编辑
let activeEditor: monaco.editor.IStandaloneCodeEditor | null = null;

export function setActiveEditor(editor: monaco.editor.IStandaloneCodeEditor | null) {
  activeEditor = editor;
}

export function getActiveEditor() {
  return activeEditor;
}
