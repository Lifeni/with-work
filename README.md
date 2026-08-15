# with-work

> 一点微小的工作 —— 高效的文本处理工作台

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

一个纯前端的工作辅助工具：以 VS Code 风格的编辑器为核心，提供文本查找替换、分割排序、文本对比等能力，所有数据保存在浏览器本地，支持一键备份与离线使用（PWA / 单文件模式）。

## 功能

- **多工作区标签页**：可新建 / 重命名 / 删除工作区，各自独立保存，撤销历史按工作区独立保留
- **固定双栏编辑器**：左右两个 Monaco 编辑器，聚焦侧高亮边框；中间操作栏支持复制 / 粘贴 / 交换 / 左右互传 / 导出到暂存区与模板 / 清空；窄屏自动纵向堆叠
- **查找替换**：匹配计数、正则 / 大小写开关、全部高亮；替换规则可保存为快捷方式（下拉选择、拖拽即用）
- **分割排序**：按分隔符（中英文逗号、分号、顿号、空格、换行等，可自动识别最常见符号）分割；按字母或自定义排序模板排序（升序 / 降序循环），支持开头匹配（前缀）模式
- **文本对比**：双编辑器内容一键弹出 Diff 对比，差异高亮
- **全局暂存区**：所有工作区共用；文本条目、文本模板、排序模板、替换规则四个模块，均可拖入编辑器、双击编辑、分组管理与导入导出
- **数据管理**：自动保存到浏览器（localStorage），支持全量备份与规则 / 模板的 JSON 导入导出
- **双构建模式**：普通模式部署 Vercel（含 PWA 离线支持）；单文件模式输出一个自包含 HTML，双击即可离线运行

## 技术栈

React 19 · Vite 8 · TypeScript · Tailwind CSS v4 · Monaco Editor · Zustand · Radix UI · Vitest

## 快速开始

```bash
npm install     # 安装依赖（Node.js ≥ 20）
npm run dev     # 启动开发服务器 → http://localhost:3000
```

## 常用脚本

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 类型检查 + 生产构建 → `dist/`（含 PWA） |
| `npm run build:single` | 单文件构建 → `dist-single/index.html`（可双击离线运行） |
| `npm run preview` | 预览 `dist/` 构建产物 |
| `npm test` | 运行全部测试（Vitest） |
| `npm run lint` | ESLint 检查 |
| `npm run icons` | 从品牌 SVG 生成 PWA 图标与 favicon.ico |
| `npm run format` | Prettier 格式化 |

## 部署到 Vercel

1. 将代码推送到 GitHub 仓库。
2. 在 [vercel.com](https://vercel.com) 导入该仓库。
3. `vercel.json` 已配置好构建命令与输出目录，推送 `main` 自动部署，PR 自动生成预览链接。

## 目录结构

```
src/
├── components/     # ui 基础组件 + shared 业务组件
├── views/          # 功能视图（编辑器 / 设置）
├── stores/         # Zustand 状态（自动持久化）
├── tools/          # 全局工具注册表（左侧工具栏）
├── lib/            # 工具函数（分割 / 排序 / 替换 / 备份 / 工作区模型）
├── hooks/          # 自定义 Hooks
├── test/           # 测试基础设施（Monaco mock 等）
├── types/          # 类型定义
└── assets/         # 静态资源
docs/               # 项目文档
scripts/            # 构建辅助脚本
```

详细说明见 [docs/architecture.md](docs/architecture.md)，AI 助手指南见 [AGENTS.md](AGENTS.md)。

## 参与贡献

欢迎提交 Issue 与 PR，详见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 许可证

[MIT](LICENSE)
