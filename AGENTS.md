# AGENTS.md

> 本文件供 AI 编码助手（Zed、Cursor、GitHub Copilot、Claude Code 等）与开发者共同使用。
> **开始任何任务前，请先阅读本文件**；项目约定发生变化时，请同步更新本文件。

## 项目概述

- **项目名**：with-work（中文名：一点微小的工作）
- **定位**：工作辅助类 Web 应用，核心是文本处理（查找/替换、对比、列表化）；后续规划图像文字识别等功能
- **技术栈**：React 19 + Vite 6 + TypeScript（strict）+ Tailwind CSS v4 + shadcn 风格组件 + Monaco Editor + Zustand
- **包管理器**：npm（勿混用其他包管理器，依赖变更通过 `npm install <pkg>` 完成，勿手动改 lockfile）
- **部署**：Vercel（`vercel.json` 已配置，构建输出 `dist/`）
- **双构建模式**：`npm run build`（Vercel 静态部署）与 `npm run build:single`（单文件 HTML，输出 `dist-single/`，所有资源内嵌，双击可离线运行）
- **开源计划**：MIT 许可证，托管于 GitHub

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `npm install` | 安装依赖（首次） |
| `npm run dev` | 启动开发服务器 → http://localhost:3000 |
| `npm run build` | 类型检查 + 生产构建 → `dist/`（Vercel） |
| `npm run build:single` | 类型检查 + 单文件构建 → `dist-single/index.html` |
| `npm run preview` | 预览 `dist/` 构建产物 |
| `npm run lint` | ESLint 检查 |
| `npm run format` / `format:check` | Prettier 格式化 / 检查 |

## 目录结构

```
with-work/
├── src/
│   ├── app.tsx / main.tsx    # 应用入口与布局壳
│   ├── index.css             # Tailwind 入口 + 主题变量（浅色/深色）
│   ├── components/
│   │   ├── ui/               # 通用基础组件（shadcn 风格：Button、Dialog 等）
│   │   └── shared/           # 业务共享组件（TitleBar、StagingPanel 等）
│   ├── views/                # 四个功能视图（编辑器 / 对比 / 列表工具 / 设置）
│   ├── stores/               # Zustand stores（全部自动持久化到 localStorage）
│   ├── tools/                # 全局工具注册表（文本处理工具，新增工具只需追加一条）
│   ├── hooks/                # 自定义 Hooks
│   ├── lib/                  # 工具函数（split/sort/listDiff/backup/transfer 等）
│   ├── types/                # 全局类型定义
│   └── assets/               # 静态资源（favicon.svg，模块导入会被内联）
├── public/                   # 公开静态资源（favicon.ico）
├── docs/                     # 项目文档
├── .github/                  # GitHub 配置（Dependabot）
└── AGENTS.md                 # 本文档
```

## 关键设计

- **状态**：Zustand + `persist` 中间件，key 前缀 `ww:`；所有数据（工作区/暂存区/规则/设置）自动保存到 localStorage。
- **编辑器**：Monaco Editor 本地打包（非 CDN），worker 使用 `?worker&inline` 内联，保证单文件模式离线可用。
- **图标**：界面图标用 lucide-react；品牌 Logo 用 `src/assets/favicon.svg`（模块导入，两种构建都内联）。
- **路径别名**：`@/` 指向 `src/`。
- **主题**：CSS 变量（oklch）+ `.dark` 类切换，Monaco 主题跟随。
- **全局工具**：`src/tools/registry.ts` 注册表 + 左侧栏魔法棒入口；工具是纯函数（输入文本 → 输出文本），作用于当前工作区（选区优先），编辑器内可 Ctrl+Z 撤销；新增工具只需在注册表追加一条。

## 代码约定

- 组件 `PascalCase`、函数/变量 `camelCase`、常量 `UPPER_SNAKE_CASE`；严格模式 TS。
- 新增功能优先放对应 `views/`，通用逻辑放 `lib/`，跨组件状态放 `stores/`。
- 样式用 Tailwind 原子类；语义色使用主题变量（`bg-background`、`text-muted-foreground` 等），不要硬编码颜色。
- 新环境变量使用 `VITE_` 前缀并补充到 `.env.example`，不得提交真实密钥。

## Git 约定

- 提交信息遵循 Conventional Commits：
  - 主题行 ≤ 50 字符、祈使句、首字母大写、结尾不加标点；
  - 需要补充说明时，主题下空一行写正文，正文每行 ≤ 72 字符；
  - 常用前缀：`feat` / `fix` / `docs` / `refactor` / `chore` / `style` / `test` / `perf` / `build` / `ci`。
- 主分支名为 `main`；功能开发在独立分支进行，完成后通过 PR 合并。

## 给 AI 助手的提示

- 新任务开始前，先阅读本文件与 `docs/` 下相关文档。
- 改动后运行 `npm run build`（含类型检查）与 `npm run lint` 验证。
- 修改持久化数据结构或备份格式时，注意升级 `version` 并兼容旧数据。
- 本仓库尚未开源；公开前请确认 README、LICENSE、`.github/` 内容已就绪。
