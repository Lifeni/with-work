// Monaco 本地化配置：不使用 CDN，全部打进构建产物，保证单文件模式离线可用。
// 文本工具场景不需要语言智能（IntelliSense），因此只内联 editor.worker。
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
