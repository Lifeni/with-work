# 架构说明

> 本文档描述 with-work 的目录结构与演进方向。产品演进时请同步更新本文档。

## 技术选型

| 领域 | 选择 | 理由 |
| --- | --- | --- |
| 前端框架 | React 19 + Vite 8 | SPA 纯静态，Vercel 与单文件模式两相宜 |
| 语言 | TypeScript（strict） | 类型安全，适合长期维护与开源协作 |
| 样式 | Tailwind CSS v4（CSS-first） | 原子类 + 主题变量（oklch），深色模式通过 `.dark` 类切换 |
| UI 组件 | shadcn 风格 + Radix UI | 组件代码归项目所有、按需裁剪，契合工具类界面 |
| 编辑器 | Monaco Editor（锁 0.52.x） | VS Code 内核：查找/替换（正则、计数、跳转）、minimap、内置 Diff 编辑器 |
| 状态管理 | Zustand + persist | 轻量；所有 store 自动持久化到 localStorage（key 前缀 `ww:`） |
| 测试 | Vitest + React Testing Library | jsdom 环境；测试模式将 `monaco-editor` alias 为 `src/test/mockMonaco.ts` |
| 字体 | Inter（@fontsource 自托管） | 中文字体走系统回退栈（MiSans / HarmonyOS Sans SC / Noto Sans SC），不打包 |
| 部署 | Vercel | `vercel.json` 配置 framework/build/outputDirectory |

## 双构建模式

- **`npm run build`**：Vercel 静态部署。输出 `dist/`（index.html + assets/），启用 PWA（vite-plugin-pwa，离线可用）。
- **`npm run build:single`**：`vite build --mode single` 触发 `vite-plugin-singlefile`，
  输出 `dist-single/index.html`。JS / CSS / 字体 / Monaco worker（`?worker&inline`）/ 品牌图标
  （模块导入）全部内嵌为 data URI，双击即可离线运行。PWA 在单文件模式不启用。
- **图标**：`npm run icons` 从 `src/assets/favicon.svg` 生成 `public/` 下的 PWA 图标
  （192/512、maskable）与 `favicon.ico`（scripts/icons.mjs，png-to-ico + sharp）。

## 目录职责

| 目录 | 职责 | 说明 |
| --- | --- | --- |
| `src/App.tsx` | 应用布局壳 | 顶栏 / 左侧工具栏 / 编辑器区 / 右侧暂存区 / 状态栏 / 设置弹窗 |
| `src/views/editor/` | 编辑器视图 | `EditorView.tsx`（固定双栏 + 中间操作栏）、`FindReplacePanel.tsx`（查找/替换/分割/排序一体面板）、对比弹窗（DiffEditor） |
| `src/views/settings/` | 设置内容 | `SettingsView.tsx`，由 `SettingsDialog` 以弹窗形式承载 |
| `src/components/ui/` | 无业务语义的基础组件 | Button、Input、Dialog、DropdownMenu、Tooltip、Toggle、Badge |
| `src/components/shared/` | 业务共享组件 | TitleBar、StagingPanel（暂存区+模板+规则）、SettingsDialog、RulesDialog、TemplatesDialog、TextTemplatesDialog、StatusBar、ToolsRail、ToastViewport、ConfirmDialog |
| `src/stores/` | Zustand stores | workspace / staging / rules / templates / sortTemplates / textTemplates / settings / list（持久化），ui / status / toast（瞬时） |
| `src/tools/` | 全局工具注册表 | `registry.ts` + 左侧竖向工具栏入口；工具为纯函数，新增只需追加一条 |
| `src/lib/` | 纯函数与桥接 | `split.ts`、`sort.ts`、`replace.ts`、`backup.ts`、`transfer.ts`、`workspaceModels.ts`、`detect.ts`、`theme.ts`、`monaco.ts`、`applyTool.ts`、`editorBridge.ts`、`utils.ts` |
| `src/hooks/` | 自定义 Hooks | `useDebounce` |
| `src/test/` | 测试基础设施 | `mockMonaco.ts`（monaco-editor 替身）、`mockEditor.ts`、`resetStores.ts`、`setup.ts` |
| `src/types/` | 全局类型定义 | Workspace、ReplaceRule、SortTemplate、TextTemplate、BackupData、ThemeMode 等 |
| `src/assets/` | 静态资源 | `favicon.svg`（品牌 Logo 源文件，模块导入 → 两种构建均内联） |
| `scripts/` | 构建辅助脚本 | `icons.mjs`：PWA 图标与 favicon.ico 生成 |

## 关键机制

### 工作区与撤销历史

- 每个工作区持有独立的左右两个 Monaco Model（`lib/workspaceModels.ts` 模块级缓存）。
- 切换工作区时编辑器实例复用，仅换绑 Model → 撤销/重做历史按工作区独立保留。
- store ↔ Model 双向同步：编辑内容经 `onChange` 写回 store（自动持久化）；
  store 内容变化（交换/互传/导入等）经 `useLayoutEffect` 以 `executeEdits("ww-sync")` 写回 Model（保留可撤销性）。
- 无工作区时（App 自动新建）渲染期清空编辑器引用，避免对已释放实例调用 `setModel` 崩溃。

### 查找替换面板（FindReplacePanel）

- 四个功能一体：**查找**（正则/大小写/计数/高亮）、**替换**（全部替换 + 规则下拉 + 规则管理）、
  **分割**（按分隔符拆分，写入另一侧编辑器）、**排序**（升序/降序/按排序模板）。
- 全部作用于当前聚焦编辑器（高亮边框者）；替换/分割结果写入另一侧。
- 替换规则（`stores/rules.ts`）与排序模板（`stores/templates.ts`）可导入/导出。

### 暂存区（StagingPanel）

- 右侧面板，宽度可拖动调节（记忆于设置），窄屏自动收起为右下角悬浮按钮。
- 四个模块：全局暂存区（文本条目）、文本模板、排序模板、替换规则，均支持双击编辑、分组、导入/导出。
- 拖拽交互：文本条目/模板拖入编辑器 = 在落点插入纯文本；替换规则拖入 = 按规则替换全文（可撤销）。
  拖拽回源区域（来源标记相同）忽略，避免误添加。

### 数据流

- 编辑器内容 → `workspaceStore.setLeft/Right` → zustand persist → localStorage（实时自动保存）。
- 暂存区 → `stagingStore` → 拖拽或按钮（`lib/transfer.ts`）分发到编辑器左右侧。
- 备份 → `lib/backup.ts` 收集全部 store 为 JSON（`app: "with-work"`，`version: 3`）导出/导入；
  导入旧版本备份时兼容字段缺失（left/right、textTemplates 等）。

## 测试体系

- Vitest + React Testing Library（jsdom），测试文件与被测代码同目录（`*.test.ts(x)`）。
- 测试模式通过 vite alias 将 `monaco-editor` 替换为 `src/test/mockMonaco.ts`（构建不受影响）；
  需要编辑器实例时用 `src/test/mockEditor.ts` 的 `createMockEditor`；渲染含
  `@monaco-editor/react` 的组件时自行 mock（参考 `src/App.test.tsx`）。
- 新增功能建议配套测试；改动后运行 `npm test`、`npm run lint`、`npm run build`。

## 演进计划

- [x] 测试体系（Vitest + React Testing Library，107 用例）
- [ ] OCR 等新能力接入（规划中）
- [ ] 添加 CI（GitHub Actions：lint + typecheck + test + build）
- [ ] 开源前检查：LICENSE 版权人、README 完善、dependabot（已启用）
