# AGENTS.md

> 本文件供 AI 编码助手（Zed、Cursor、GitHub Copilot、Claude Code 等）与开发者共同使用。
> **开始任何任务前，请先阅读本文件**；项目约定发生变化时，请同步更新本文件。

## 项目概述

- **项目名**：with-work（中文名：一点微小的工作）
- **定位**：工作辅助类 Web 应用，核心是文本处理（查找/替换、分割/排序、对比）；后续规划图像文字识别等功能
- **技术栈**：React 19 + Vite 8 + TypeScript（strict）+ Tailwind CSS v4 + shadcn 风格组件（Radix）+ Monaco Editor（锁 0.52.x）+ Zustand + Vitest
- **包管理器**：npm（勿混用其他包管理器，依赖变更通过 `npm install <pkg>` 完成，勿手动改 lockfile）
- **部署**：Vercel（`vercel.json` 已配置，构建输出 `dist/`）
- **双构建模式**：`npm run build`（Vercel 静态部署，启用 PWA）与 `npm run build:single`（单文件 HTML，输出 `dist-single/`，所有资源内嵌，双击可离线运行）
- **PWA**：vite-plugin-pwa（仅部署版启用），manifest 图标由 `scripts/icons.mjs` 生成（`npm run icons`）
- **开源计划**：MIT 许可证，托管于 GitHub（仓库：Lifeni/with-work）

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `npm install` | 安装依赖（首次） |
| `npm run dev` | 启动开发服务器 → http://localhost:3000 |
| `npm run build` | 类型检查 + 生产构建 → `dist/`（Vercel） |
| `npm run build:single` | 类型检查 + 单文件构建 → `dist-single/index.html` |
| `npm run preview` | 预览 `dist/` 构建产物 |
| `npm test` | 运行全部测试（Vitest，jsdom） |
| `npm run test:watch` | 监听模式运行测试 |
| `npm run lint` | ESLint 检查 |
| `npm run format` / `format:check` | Prettier 格式化 / 检查 |
| `npm run icons` | 从 `src/assets/favicon.svg` 生成 PWA 图标与 favicon.ico |

## 目录结构

```
with-work/
├── src/
│   ├── App.tsx / main.tsx    # 应用入口与布局壳
│   ├── index.css             # Tailwind 入口 + 主题变量（浅色/深色）
│   ├── components/
│   │   ├── ui/               # 通用基础组件（shadcn 风格：Button、Dialog 等）
│   │   └── shared/           # 业务共享组件（TitleBar、StagingPanel、SettingsDialog、RulesDialog 等）
│   ├── views/                # 功能视图（editor/ 编辑器与工具面板、settings/ 设置内容）
│   ├── stores/               # Zustand stores（workspace/staging/rules/templates/textTemplates/settings/ui/status/toast，自动持久化）
│   ├── tools/                # 全局工具注册表（文本处理工具，新增工具只需追加一条）
│   ├── hooks/                # 自定义 Hooks（useDebounce）
│   ├── lib/                  # 纯函数与桥接（split/sort/replace/backup/transfer/workspaceModels/detect/theme/monaco/applyTool/editorBridge/utils）
│   ├── test/                 # 测试基础设施（mockMonaco、mockEditor、resetStores、setup）
│   ├── types/                # 全局类型定义
│   └── assets/               # 静态资源（favicon.svg 源文件，模块导入会被内联）
├── public/                   # 公开静态资源（favicon.ico、favicon.svg、PWA 图标）
├── scripts/                  # 构建辅助脚本（icons.mjs：PWA 图标生成）
├── docs/                     # 项目文档（architecture.md）
└── AGENTS.md                 # 本文档
```

## 关键设计

- **状态**：Zustand + `persist` 中间件，key 前缀 `ww:`；所有数据（工作区/暂存区/规则/模板/设置）自动保存到 localStorage；备份格式升级时递增 `BackupData.version` 并兼容旧数据。
- **编辑器**：固定双栏（左右两个独立 Monaco Editor），聚焦侧有高亮边框；中间栏有复制/粘贴/对比弹窗/交换/左右互传/导出到暂存区与模板/清空按钮，并支持拖动调节左右宽度。
- **工作区模型**：每个工作区持有独立的 Monaco Model（`lib/workspaceModels.ts` 缓存），切换工作区时换绑 Model，撤销/重做历史按工作区独立保留；store ↔ Model 双向同步（`ww-sync`）。
- **查找替换面板**（`views/editor/FindReplacePanel.tsx`）：编辑器顶部一体面板，包含查找（正则/大小写/计数高亮）、替换（全部替换/规则下拉）、分割、排序四个功能；作用于聚焦编辑器，替换/分割结果写入另一侧。
- **暂存区**（`StagingPanel.tsx`）：右侧面板，多工作区共用；包含全局暂存区（文本条目）、文本模板、排序模板、替换规则四个模块，条目可拖动到编辑器（规则拖入 = 按规则替换全文），双击编辑，支持分组与导入/导出。
- **图标**：界面图标用 lucide-react；品牌 Logo 用 `src/assets/favicon.svg`（模块导入，两种构建都内联；PWA 图标由 `npm run icons` 生成到 `public/`）。
- **路径别名**：`@/` 指向 `src/`。
- **主题**：CSS 变量（oklch）+ `.dark` 类切换，Monaco 主题跟随（`lib/theme.ts`）。
- **全局工具**：`src/tools/registry.ts` 注册表 + 左侧竖向工具栏（Photoshop 式）入口；工具是纯函数（输入文本 → 输出文本），作用于聚焦编辑器（选区优先，无选区时处理全文），编辑器内可 Ctrl+Z 撤销；新增工具只需在注册表追加一条。
- **测试**：Vitest + Testing Library（jsdom）。测试模式通过 vite alias 将 `monaco-editor` 替换为 `src/test/mockMonaco.ts`（构建不受影响）；`@monaco-editor/react` 需要组件测试时自行 mock。改动画布组件后跑 `npm test`。
- **内置数据**：`lib/defaultData.ts` 维护内置替换规则与排序模板（增量注入：新内置项对老用户可见，删除不复活，下架项自动移除）；`main.tsx` 启动时调用 `seedDefaultData()`。

## 代码约定

- 组件 `PascalCase`、函数/变量 `camelCase`、常量 `UPPER_SNAKE_CASE`；严格模式 TS。
- 新增功能优先放对应 `views/`，通用逻辑放 `lib/`，跨组件状态放 `stores/`。
- 样式用 Tailwind 原子类；语义色使用主题变量（`bg-background`、`text-muted-foreground` 等），不要硬编码颜色。
- 新环境变量使用 `VITE_` 前缀并补充到 `.env.example`，不得提交真实密钥。
- 修改 Monaco 相关代码时注意：**不要升级 monaco-editor 到 0.53+**（worker 内联方式不兼容，会破坏单文件构建）。

## Git 约定

- 提交信息遵循 Conventional Commits，**主题行与正文使用中文**（前缀保留英文）：
  - 主题行 ≤ 50 字符、祈使句、结尾不加标点；
  - 需要补充说明时，主题下空一行写正文，正文每行 ≤ 72 字符；
  - 常用前缀：`feat` / `fix` / `docs` / `refactor` / `chore` / `style` / `test` / `perf` / `build` / `ci`。
- 主分支名为 `main`；功能开发在独立分支进行，完成后通过 PR 合并。
- 推送 / 部署前必须先征得开发者确认。

## 给 AI 助手的提示

- 新任务开始前，先阅读本文件与 `docs/` 下相关文档。
- 改动后运行 `npm run build`（含类型检查）、`npm run lint` 与 `npm test` 验证。
- 修改持久化数据结构或备份格式时，注意升级 `version` 并兼容旧数据。
- 本仓库尚未开源；公开前请确认 README、LICENSE、`.github/` 内容已就绪。
