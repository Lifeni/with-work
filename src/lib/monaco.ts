// Monaco 本地化配置：不使用 CDN，worker 作为独立资源输出并由 Vite 处理哈希与缓存。
// 注意：从 0.53+ 升级时需要同步核对 worker 路径与语言服务 worker 的构建产物。
import "monaco-editor";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";

(self as unknown as { MonacoEnvironment: unknown }).MonacoEnvironment = {
  getWorker: () => new editorWorker(),
};
