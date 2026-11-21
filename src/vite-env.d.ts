/// <reference types="vite/client" />

/** 构建时间（UTC ISO 字符串），由 vite.config.ts 的 define 在构建时注入 */
declare const __BUILD_TIME__: string;

/** 应用版本号（取自 package.json），由 vite.config.ts 的 define 在构建时注入 */
declare const __APP_VERSION__: string;
