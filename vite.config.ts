import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { fileURLToPath, URL } from "node:url";

// 双构建模式：
//   npm run build         → dist/（部署到 Vercel）
//   npm run build:single  → dist-single/（单文件 HTML，样式/脚本/图标全部内嵌）
export default defineConfig(({ mode }) => {
  const isSingle = mode === "single";
  return {
    plugins: [react(), tailwindcss(), ...(isSingle ? [viteSingleFile()] : [])],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    build: {
      outDir: isSingle ? "dist-single" : "dist",
      assetsInlineLimit: isSingle ? 100000000 : 4096,
      chunkSizeWarningLimit: 10000,
    },
  };
});
