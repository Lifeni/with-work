// Monaco 本地化配置：不使用 CDN，全部打进构建产物，保证单文件模式离线可用。
// 说明：monaco-editor 0.53+ 将 LSP 语言服务集成进核心，其 worker 使用
// new Worker(new URL(...)) 静态加载、无法内联进单文件 HTML，因此固定在 0.52.x
// （LSP 集成前的最后版本，语言服务走 MonacoEnvironment.getWorker 分发）。
// 文本工具场景只需要编辑器能力与词法高亮，0.52 完整满足且单文件完全自包含。
import * as monaco from "monaco-editor";
import { loader } from "@monaco-editor/react";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker&inline";

(self as unknown as { MonacoEnvironment: unknown }).MonacoEnvironment = {
  getWorker: () => new editorWorker(),
};

loader.config({ monaco });

export { monaco };

export function applyMonacoTheme(theme: "light" | "dark") {
  monaco.editor.setTheme(theme === "dark" ? "vs-dark" : "light");
}
