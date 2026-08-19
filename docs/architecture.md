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
| 包管理 | pnpm | 确定性依赖树（pnpm-lock.yaml），安装快速、节省磁盘 |
| 字体 | Inter（@fontsource 自托管） | 中文字体走系统回退栈（MiSans / HarmonyOS Sans SC / Noto Sans SC），不打包 |
| 部署 | Vercel | `vercel.json` 配置 framework/build/outputDirectory |

## 双构建模式

- **`pnpm build`**：Vercel 静态部署。输出 `dist/`（index.html + assets/），启用 PWA（vite-plugin-pwa，离线可用）；
  构建时额外执行单文件构建并复制为 `dist/with-work-single.html`——设置页「关于」在**部署版**提供
  「下载单文件版」入口；**单文件版**则不提供下载并标注「单文件版」。
- **`pnpm build:single`**：`vite build --mode single` 触发 `vite-plugin-singlefile`，
  输出 `dist-single/index.html`。JS / CSS / 字体 / Monaco worker（`?worker&inline`）/ 品牌图标
  （模块导入）全部内嵌为 data URI，PWA 在单文件模式不启用；
  经 `scripts/ship-single.mjs` 将 favicon（svg/ico）进一步内联为 data URI，单文件彻底自包含（图标亦可用）。
- **图标**：`pnpm icons` 从 `src/assets/favicon.svg` 生成 `public/` 下的 PWA 图标
  （192/512、maskable）与 `favicon.ico`（scripts/icons.mjs，png-to-ico + sharp）。

## 构建注入

- `vite.config.ts` 通过 `define` 注入两个编译期常量（类型声明见 `src/vite-env.d.ts`）：
  - `__BUILD_TIME__`：构建时刻（设置页「关于 → 构建时间」）；
  - `__BUILD_MODE__`：`"single"`（单文件版）或 `"deploy"`（部署版 / 测试）。

## 目录职责

| 目录 | 职责 | 说明 |
| --- | --- | --- |
| `src/App.tsx` | 应用布局壳 | 顶栏 / 左侧工具栏 / 编辑器区 / 右侧暂存区 / 状态栏 / 设置弹窗 |
| `src/views/editor/` | 编辑器视图 | `EditorView.tsx`（固定双栏 + 中间操作栏）、`FindReplacePanel.tsx`（查找/替换/分割/排序一体面板）、对比弹窗（DiffEditor） |
| `src/views/settings/` | 设置内容 | `SettingsView.tsx`，由 `SettingsDialog` 以弹窗形式承载 |
| `src/components/ui/` | 无业务语义的基础组件 | Button、Input、Dialog、DropdownMenu、Tooltip、Toggle、Badge |
| `src/components/shared/` | 业务共享组件 | TitleBar、StagingPanel（暂存区+模板+规则）、SettingsDialog、RulesDialog、TemplatesDialog、TextTemplatesDialog、StatusBar、ToolsRail、ToastViewport、ConfirmDialog |
| `src/stores/` | Zustand stores | workspace / staging / rules / templates / textTemplates / settings / list（持久化），ui / status / toast（瞬时） |
| `src/tools/` | 全局工具注册表 | `registry.ts` + 左侧竖向工具栏入口；工具为纯函数，新增只需追加一条 |
| `src/lib/` | 纯函数与桥接 | `split.ts`、`sort.ts`、`replace.ts`、`backup.ts`、`transfer.ts`、`workspaceModels.ts`、`detect.ts`、`theme.ts`、`monaco.ts`、`applyTool.ts`、`editorBridge.ts`、`utils.ts` |
| `src/hooks/` | 自定义 Hooks | `useDebounce` |
| `src/test/` | 测试基础设施 | `mockMonaco.ts`（monaco-editor 替身）、`mockEditor.ts`、`resetStores.ts`、`setup.ts` |
| `src/types/` | 全局类型定义 | Workspace、ReplaceRule、SortTemplate、TextTemplate、BackupData、ThemeMode 等 |
| `src/assets/` | 静态资源 | `favicon.svg`（品牌 Logo 源文件，模块导入 → 两种构建均内联） |
| `scripts/` | 构建辅助脚本 | `icons.mjs`（PWA 图标与 favicon.ico 生成）、`ship-single.mjs`（单文件图标内联与产物分发） |

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
- 排序支持**开头匹配**（前缀匹配）：模板可自带 `prefixMatch` 属性，工具栏开关可临时开启；
  全部不匹配时提示且不清空内容，部分匹配时未匹配项写入另一侧编辑器。
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
- 新增功能建议配套测试；改动后运行 `pnpm test`、`pnpm lint`、`pnpm build`。

## 内置数据

- `lib/defaultData.ts` 维护内置替换规则与排序模板（`main.tsx` 启动时调用 `seedDefaultData()` 注入）。
  当前内置：替换规则「单书名号替换」、排序模板「山东 16 市」（默认开头匹配）。
- 增量注入：以 `ww:seeded` 记录已注入过的内置 id——新增内置项对老用户可见
  （补入缺失项）、用户删除后不复活、编辑过的不覆盖、下架项（`DEPRECATED_BUILTIN_IDS`）
  自动从用户数据中移除。

