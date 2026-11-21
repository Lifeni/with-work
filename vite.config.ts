/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import { readFileSync } from "node:fs";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath, URL } from "node:url";

// 版本号单一来源：设置页「关于」的版本从 package.json 注入，避免两处各写一份
const { version: APP_VERSION } = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
) as { version: string };

export default defineConfig(({ mode }) => {
  // 仅生产构建启用 PWA；开发/测试模式不生成 Service Worker
  const isPwa = mode === "production";
  return {
    // 构建时间注入：设置页“关于”展示动态构建时间（__BUILD_TIME__ 为 UTC ISO 字符串）
    define: {
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
      __APP_VERSION__: JSON.stringify(APP_VERSION),
    },
    plugins: [
      vue(),
      tailwindcss(),
      ...(isPwa
        ? [
            VitePWA({
              // 新版本先等待用户确认：编辑器数据落盘后再刷新
              registerType: "prompt",
              // 由 PwaUpdatePrompt 手动注册，避免插件额外注入无 UI 的注册脚本
              injectRegister: false,
              includeAssets: ["favicon.ico", "favicon.svg"],
              manifest: {
                name: "一点微小的工作",
                short_name: "With Work",
                description: "很惭愧，只是做了一点微小的工作",
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
                // ttf 是 Monaco 的 codicon 字体；png 是 PWA 安装图标，离线时也应命中缓存
                globPatterns: ["**/*.{js,css,html,svg,ico,woff2,ttf,png,webmanifest}"],
                // monaco 主包约 4MB，默认 2MB 上限会跳过，调大以完整预缓存
                maximumFileSizeToCacheInBytes: 30 * 1024 * 1024,
                // 用户确认 SKIP_WAITING 后立即接管当前页面，触发 controllerchange 后再刷新
                clientsClaim: true,
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
    server: {
      // 构建产物就在项目根目录下：dev 期间忽略它们，否则跑一次 pnpm build
      // 会让 dev 服务器整页刷新，正好撞上 HMR 更新就可能留下坏模块
      watch: { ignored: ["**/dist/**"] },
    },
    build: {
      chunkSizeWarningLimit: 6000,
    },
    test: {
      // jsdom 环境：自带 DOM/window，供持久化与组件测试使用
      environment: "jsdom",
      setupFiles: ["src/test/setup.ts"],
      include: ["src/**/*.test.{ts,tsx}"],
    },
  };
});
