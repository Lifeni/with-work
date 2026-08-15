# with-work

> 一点微小的工作 —— 高效的文本处理工作台

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

一个纯前端的工作辅助工具：以 VS Code 风格的编辑器为核心，提供文本查找替换、文本对比、文本列表化（分割 / 排序 / 对比）等能力，所有数据保存在浏览器本地，支持一键备份。

## 功能

- **多工作区标签页**：可新建 / 重命名 / 删除工作区，各自独立保存
- **全局暂存区**：悬浮面板，所有工作区共用；一条文本可一键导入编辑器、对比或列表工具
- **查找与替换**：匹配计数、逐条跳转、位置列表、全部高亮、缩略图（minimap）、正则支持；可保存自定义替换规则，一键调用
- **文本对比**：双栏 Diff，差异高亮，支持交换 / 应用到工作区
- **列表工具**：按中英文逗号 / 空格 / 换行 / 自定义正则分割；按参考列表或字母顺序排序（未匹配项单独列出）；列表对比（仅在 A / 共同 / 仅在 B）
- **数据管理**：自动保存到浏览器（localStorage），支持全量备份与替换规则的 JSON 导入 / 导出
- **双构建模式**：普通模式部署 Vercel；单文件模式输出一个自包含 HTML，双击即可离线运行

## 技术栈

React 19 · Vite 6 · TypeScript · Tailwind CSS v4 · Monaco Editor · Zustand · Radix UI

## 快速开始

```bash
npm install     # 安装依赖（Node.js ≥ 20）
npm run dev     # 启动开发服务器 → http://localhost:3000
```

## 常用脚本

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 类型检查 + 生产构建 → `dist/` |
| `npm run build:single` | 单文件构建 → `dist-single/index.html`（可双击离线运行） |
| `npm run preview` | 预览 `dist/` 构建产物 |
| `npm run lint` | ESLint 检查 |
| `npm run format` | Prettier 格式化 |

## 部署到 Vercel

1. 将代码推送到 GitHub 仓库。
2. 在 [vercel.com](https://vercel.com) 导入该仓库。
3. `vercel.json` 已配置好构建命令与输出目录，推送 `main` 自动部署，PR 自动生成预览链接。

## 目录结构

```
src/
├── components/     # ui 基础组件 + shared 业务组件
├── views/          # 功能视图（编辑器 / 对比 / 列表工具 / 设置）
├── stores/         # Zustand 状态（自动持久化）
├── lib/            # 工具函数（分割 / 排序 / 对比 / 备份）
├── hooks/          # 自定义 Hooks
├── types/          # 类型定义
└── assets/         # 静态资源
docs/               # 项目文档
```

详细说明见 [docs/architecture.md](docs/architecture.md)，AI 助手指南见 [AGENTS.md](AGENTS.md)。

## 参与贡献

欢迎提交 Issue 与 PR，详见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 许可证

[MIT](LICENSE)
