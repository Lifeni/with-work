/// <reference types="vite/client" />

/** 构建时间（UTC ISO 字符串），由 vite.config.ts 的 define 在构建时注入 */
declare const __BUILD_TIME__: string;

/** 构建模式：single = 单文件版；deploy = Vercel 部署版 */
declare const __BUILD_MODE__: "single" | "deploy";
