# 架构说明

> 本文档描述 with-work 的目录结构与演进方向。产品演进时请同步更新本文档。

## 技术选型

| 领域 | 选择 | 理由 |
| --- | --- | --- |
| 前端框架 | React 19 + Vite 6 | SPA 纯静态，Vercel 与单文件模式两相宜 |
| 语言 | TypeScript（strict） | 类型安全，适合长期维护与开源协作 |
| 样式 | Tailwind CSS v4（CSS-first） | 原子类 + 主题变量（oklch），深色模式通过 `.dark` 类切换 |
| UI 组件 | shadcn 风格 + Radix UI | 组件代码归项目所有、按需裁剪，契合工具类界面 |
| 编辑器 | Monaco Editor | VS Code 内核：查找/替换（正则、计数、跳转）、minimap、内置 Diff 编辑器 |
| 状态管理 | Zustand + persist | 轻量；所有 store 自动持久化到 localStorage（key 前缀 `ww:`） |
| 字体 | Inter（@fontsource 自托管） | 中文字体走系统回退栈（MiSans / HarmonyOS Sans SC / Noto Sans SC），不打包 |
| 部署 | Vercel | `vercel.json` 配置 framework/build/outputDirectory |

## 双构建模式

- **`npm run build`**：Vercel 静态部署。输出 `dist/`（index.html + assets/）。
- **`npm run build:single`**：`vite build --mode single` 触发 `vite-plugin-singlefile`，
  输出 `dist-single/index.html`。JS / CSS / 字体 / Monaco worker（`?worker&inline`）/ 品牌图标
  （模块导入）全部内嵌为 data URI，双击即可离线运行。

## 目录职责

| 目录 | 职责 | 说明 |
| --- | --- | --- |
| `src/app.tsx` | 应用布局壳 | 顶栏 / 侧栏 / 视图切换 / 状态栏 / 暂存区 |
| `src/views/` | 功能视图 | `editor/`（编辑器 + 查找替换）、`diff/`、`list/`、`settings/` |
| `src/components/ui/` | 无业务语义的基础组件 | Button、Input、Dialog、DropdownMenu、Tooltip、Toggle、Badge |
| `src/components/shared/` | 业务共享组件 | TitleBar、ActivityBar、StatusBar、StagingPanel、RulesDialog 等 |
| `src/stores/` | Zustand stores | workspace / staging / rules / settings / diff / list（持久化），status / toast / ui（瞬时） |
| `src/lib/` | 纯函数工具 | `split.ts`、`sort.ts`、`listDiff.ts`、`backup.ts`、`transfer.ts`、`monaco.ts`、`theme.ts` |
| `src/hooks/` | 自定义 Hooks | `useDebounce` |
| `src/types/` | 全局类型定义 | Workspace、ReplaceRule、BackupData、ThemeMode 等 |
| `src/assets/` | 静态资源 | `favicon.svg`（品牌 Logo，模块导入 → 两种构建均内联） |

## 数据流

- 编辑器内容 → `workspaceStore.setContent` → zustand persist → localStorage（实时自动保存）。
- 暂存区 → `stagingStore` → 通过 `lib/transfer.ts` 的 `importText` 分发到编辑器 / 对比 / 列表工具。
- 替换规则 → `rulesStore` → 查找替换面板以 chips 呈现，点击一键调用。
- 备份 → `lib/backup.ts` 收集全部 store 为 JSON（`app: "with-work"`，`version: 1`）导出/导入。

## 演进计划

- [ ] OCR 等新能力接入（规划中）
- [ ] 补充测试体系（Vitest + React Testing Library，必要时加 Playwright E2E）
- [ ] 添加 CI（GitHub Actions：lint + typecheck + build）
- [ ] 开源前检查：LICENSE 版权人、README 完善、dependabot（已启用）
