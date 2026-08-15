/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath, URL } from "node:url";

// 双构建模式：
//   npm run build         → dist/（部署到 Vercel，启用 PWA 离线支持）
//   npm run build:single  → dist-single/（单文件 HTML，样式/脚本/图标全部内嵌）
export default defineConfig(({ mode }) => {
  const isSingle = mode === "single";
  // PWA 仅用于 Vercel 部署版；单文件构建与测试模式不启用
  const isPwa = !isSingle && mode !== "test";
  return {
    plugins: [
      react(),
      tailwindcss(),
      ...(isSingle ? [viteSingleFile()] : []),
      ...(isPwa
        ? [
            VitePWA({
              registerType: "autoUpdate",
              includeAssets: ["favicon.ico", "favicon.svg"],
              manifest: {
                name: "一点微小的工作",
                short_name: "With Work",
                description: "一点微小的工作 —— 高效的文本处理工作台",
                lang: "zh-CN",
                theme_color: "#6d28d9",
                background_color: "#ffffff",
                display: "standalone",
                start_url: "/",
                icons: [
                  {
                    src: "/pwa-192x192.png",
                    sizes: "192x192",
                    type: "image/png",
                  },
                  {
                    src: "/pwa-512x512.png",
                    sizes: "512x512",
                    type: "image/png",
                  },
                  {
                    src: "/maskable-512x512.png",
                    sizes: "512x512",
                    type: "image/png",
                    purpose: "maskable",
                  },
                  {
                    src: "/favicon.svg",
                    sizes: "any",
                    type: "image/svg+xml",
                  },
                ],
              },
              workbox: {
                globPatterns: ["**/*.{js,css,html,svg,ico,woff2}"],
                // monaco 主包约 4MB，默认 2MB 上限会跳过，调大以完整预缓存
                maximumFileSizeToCacheInBytes: 30 * 1024 * 1024,
                navigateFallback: "/index.html",
              },
            }),
          ]
        : []),
    ],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
        // 测试模式下 monaco-editor 无法在 node 环境解析，替换为最小替身（不影响构建）
        ...(mode === "test"
          ? {
              "monaco-editor": fileURLToPath(new URL("./src/test/mockMonaco.ts", import.meta.url)),
            }
          : {}),
      },
    },
    build: {
      outDir: isSingle ? "dist-single" : "dist",
      assetsInlineLimit: isSingle ? 100000000 : 4096,
      chunkSizeWarningLimit: 10000,
    },
    test: {
      // jsdom 环境：自带 DOM/window，供 zustand persist 与组件测试使用
      environment: "jsdom",
      setupFiles: ["src/test/setup.ts"],
      include: ["src/**/*.test.{ts,tsx}"],
    },
  };
});
