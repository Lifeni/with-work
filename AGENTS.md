# AGENTS.md

> 本文件供 AI 编码助手（Zed、Cursor、GitHub Copilot、Claude Code 等）与开发者共同使用。
> **开始任何任务前，请先阅读本文件**；项目约定发生变化时，请同步更新本文件。

## 项目概述

- **项目名**：with-work（中文名：一点微小的工作）
- **定位**：工作辅助类 Web 应用，核心是文本处理（查找/替换、分割/排序、对比）
- **技术栈**：Vue 3 + Vite 8 + TypeScript（strict）+ Tailwind CSS v4 + Naive UI（主题经 `n-config-provider` 与自身主题联动）+ Monaco Editor（锁 0.52.x）+ Pinia + Vitest + Playwright
- **包管理器**：pnpm 12.21.0（由 `package.json` 的 `packageManager` 固定；勿混用其他包管理器，依赖变更通过 `pnpm add <pkg>` 完成，勿手动改 lockfile）
- **部署**：Vercel（`vercel.json` 已配置，构建输出 `dist/`）
- **构建与离线**：`pnpm run build` 执行类型检查 + 生产构建，输出 `dist/` 供 Vercel 静态部署；PWA 负责离线访问与安装。单文件 HTML 分发已下线。
- **PWA**：vite-plugin-pwa（仅生产构建启用），manifest 图标由 `scripts/icons.mjs` 生成（`pnpm run icons`）；Service Worker 使用等待确认模式，启动、每小时、页面重新可见和网络恢复时检查更新，发现新版本后在右下角提示用户，确认前先落盘再刷新；设置页「关于」可手动检查并重新唤起更新提示，`pnpm verify:pwa-update` 用两次构建验证启动提示、手动检查、召回与激活链路
- **开源状态**：已开源（MIT 许可证），GitHub 仓库：Lifeni/with-work

## 常用命令

| 命令                           | 说明                                                    |
| ------------------------------ | ------------------------------------------------------- |
| `pnpm install`                 | 安装依赖（首次）                                        |
| `pnpm dev`                     | 启动开发服务器 → http://localhost:5173（Vite 默认端口） |
| `pnpm build`                   | 类型检查 + 生产构建 → `dist/`（Vercel）                 |
| `pnpm preview`                 | 预览 `dist/` 构建产物                                   |
| `pnpm test`                    | 运行全部测试（Vitest，jsdom）                           |
| `pnpm test:watch`              | 监听模式运行测试                                        |
| `pnpm test:e2e`                | 运行 Playwright 真实浏览器测试（首次先安装 chromium）   |
| `pnpm verify:pwa-update`       | 双次构建 + Chromium 验证 PWA 更新提示与激活流程         |
| `pnpm lint`                    | ESLint 检查                                             |
| `pnpm format` / `format:check` | Prettier 格式化 / 检查                                  |
| `pnpm icons`                   | 从 `src/assets/favicon.svg` 生成 PWA 图标与 favicon.ico |

## 目录结构

```
with-work/
├── src/
│   ├── App.vue / main.ts    # 应用入口与布局壳
│   ├── index.css             # Tailwind 入口 + 主题变量（浅色/深色）
│   ├── components/
│   │   ├── ui/               # 通用基础组件（Naive UI 薄封装：Button、TooltipIconButton、Dialog、DropdownMenu/NDropdown、Badge；Input/Textarea 封装 Naive n-input；Toggle 基于 NButton）
│   │   └── shared/           # 业务共享组件（TitleBar、StagingPanel、staging/ 子面板、FileMenu、ManagerDialogFrame、PwaUpdatePrompt 等）
│   ├── views/                # 功能视图（editor/ 编辑器与工具面板、settings/ 外观/关于/数据/存储卡片）
│   ├── stores/               # Pinia stores（workspace/staging/rules/templates/textTemplates/settings/ui/status/toast，自动持久化）
│   ├── tools/                # 全局工具注册表（文本处理工具，新增工具只需追加一条）
│   ├── hooks/                # 自定义 composables（useDebounce、useCardDrag）
│   ├── lib/                  # 纯函数与桥接（split/join/sort/replace/extractDifferences/backup/defaultData/transfer/fileImport/fileAccess/fileWorkspace/recentFiles/persistenceDb/storageInfo/multiTab/pwaUpdateService/workspaceModels/workspaceMigration/settingsMigration/detect/editorFontFamily/theme/monaco/applyTool/editorBridge/storageKeys/drag/utils）
│   ├── test/                 # 测试基础设施（mockMonaco、mockEditor、resetStores、setup）
│   ├── types/                # 全局类型定义
│   └── assets/               # 静态资源（favicon.svg 源文件，模块导入由 Vite 处理哈希）
├── public/                   # 公开静态资源（favicon.ico、favicon.svg、PWA 图标）
├── scripts/                  # 构建辅助脚本（icons.mjs、find-chromium.mjs、verify-pwa-update.mjs）
├── docs/                     # 项目文档（architecture.md、design-system.md）
├── e2e/                      # Playwright 真实浏览器测试（app.spec.ts、ui-consistency.spec.ts）
├── playwright.config.ts      # E2E 配置（本地 Vite + Chromium）
└── AGENTS.md                 # 本文档
```

## 关键设计

- **状态**：Pinia + 自定义持久化插件（`stores/persist.ts`），key 前缀 `ww:`（兼容旧版 Zustand 的 `{ state, version }` 存储格式，老数据自动解包）。IndexedDB（`lib/persistenceDb.ts`）是主存储，localStorage 保留同步镜像与时间戳（`ww:persist-meta`）：启动时先 await `hydratePersistence()` 比较两层数据，较新者回填镜像后再创建 store；旧 localStorage 数据首次启动自动迁移。写盘经 250ms 防抖，页面隐藏/关闭前 `flushPersist()` 落盘；只要双层存储有一层成功就不误报失败。工作区 JSON 超过 512KB 时镜像用 lz-string 压缩；状态栏由真实写盘结果驱动「保存中 / 已保存 / 失败」。最近文件历史（上限 8）与「工作区 → 原文件」绑定分表存储，历史淘汰不会让 `Ctrl+S` 失去写回目标。存储键统一在 `lib/storageKeys.ts` 维护（含内置数据标记 `ww:seeded`），「清空所有数据」会等待在途写入结束，并清除镜像、IndexedDB、最近历史、工作区绑定与时间戳。备份格式升级时递增 `BackupData.version` 并兼容旧数据。
- **编辑器**：固定双栏（左右两个独立 Monaco Editor），聚焦侧有高亮边框；中间操作栏有复制/粘贴/提取差异/对比弹窗/交换/左右互传/导出到暂存区与模板/清空按钮，支持拖动调节左右宽度；窄屏（<1024px）自动纵向堆叠且两边等高。
- **差异去重**：中间操作栏「提取差异」按原始行内容去重（仅忽略空白行）并移除另一侧已有行，原地覆盖左右编辑器；无独有行时仅提示，不新建或切换工作区。
- **悬浮工具栏**（`FloatingEditorToolbar.vue`）：跟随聚焦编辑器悬浮于其底部（宽窄屏均适用），包含文本工具（行排序/去空行/去除空格和 Tab/大小写等）+ 工具栏自定义入口 + 撤销/重做；工具执行后自动恢复编辑器焦点，Ctrl+Z 可直接撤销。工具栏自定义菜单可逐项控制显示，工具按钮右键或 Shift+F10 可打开含运行、配置与隐藏动作的键盘可操作菜单。
- **工作区模型**：每个工作区持有独立的 Monaco Model（`lib/workspaceModels.ts` 缓存），切换工作区时换绑 Model，撤销/重做历史按工作区独立保留；store ↔ Model 双向同步（`ww-sync`）。内容变化事件携带 Model 引用、按 `findWorkspaceIdByModel` 归属写入，换绑滞后窗口内也不会把内容串到其他工作区。
- **查找替换面板**（`views/editor/FindReplacePanel.vue`）：编辑器顶部一体面板，包含查找（正则/大小写/计数高亮）、替换（全部替换/规则下拉）、分割、组合、排序五个功能；壳组件负责工具栏布局与显隐菜单，具体控件拆在 `FindReplaceBar.vue` / `ListToolsControls.vue`，分组定义集中在 `editorToolbarGroups.ts`。宽屏命令栏保持单行，窄屏自动换行，避免功能被横向裁切，中等宽度仅收起动作文字并保留图标与 tooltip。分割下拉与分割/组合按钮合并为一组，分割（一行拆多行）与组合（多行拼一行，`lib/join.ts`）共用同一个分隔符与「选区优先 → 原地写回」流程，空输入只提示且不清空编辑器；排序支持开头匹配（模板属性或工具栏开关），模板匹配项按顺序排在前面，未匹配项保留在末尾；所有列表工具都作用于聚焦编辑器并可就地撤销。面板右侧的自定义菜单可控制顶部功能组显隐，选择持久化到设置。
- **暂存区**（`StagingPanel.vue`）：编辑器左侧面板，多工作区共用；包含全局暂存区（文本条目）、文本模板、排序模板、替换规则四个模块，条目可拖到编辑器（规则拖入 = 按规则替换全文），双击编辑，支持分组与导入/导出。条目与模板区拆在 `components/shared/staging/`，拖拽逻辑收敛到 `hooks/useCardDrag.ts`，壳组件保留尺寸调节与布局。宽度可拖动调节（记忆于设置）；开关在标题栏左侧（宽窄屏均可用），窄屏抽屉模式下面板标题前另有折叠按钮，窄屏自动收起。
- **文件工作流**：左侧品牌栏「打开文件与最近文件」（`FileMenu.vue`）优先使用 File System Access（`lib/fileAccess.ts`），不支持时回退隐藏 input；最近历史与工作区文件绑定由 IndexedDB 持久化（`lib/recentFiles.ts`），菜单可打开 `RecentFilesDialog` 管理单条历史。打开文件会创建新的同名工作区，`Ctrl/Cmd+S` 在已绑定原文件时始终写回绑定栏位（即使焦点在另一栏），否则下载当前聚焦文本；`Ctrl/Cmd+Shift+S` 或命令面板可另存为并把当前聚焦栏绑定到新句柄；命令面板可解除当前文件绑定。状态栏显示当前工作区绑定的原文件名。工作区删除后会清理失联句柄。文本文件拖到编辑器仍在落点插入。单个文件上限 20MB，读取与命名收敛在 `lib/fileImport.ts`，工作区绑定与保存收敛在 `lib/fileWorkspace.ts`。
- **命令面板**：`Ctrl/Cmd+K` 打开 `CommandPalette`，搜索并执行操作、保存、文本工具、最近文件和工作区切换；方向键选择、Enter 执行、Esc 关闭，自绘 Teleport 弹层负责焦点恢复与 Tab 循环。window 捕获阶段监听保证 Monaco 聚焦时也能打开。
- **图标**：界面图标用 @vicons/tabler（无 Icon 前缀命名）；品牌 Logo 用 `src/assets/favicon.svg`（模块导入，交给 Vite 处理哈希与缓存；PWA 图标由 `pnpm run icons` 生成到 `public/`）。
- **图标按钮提示**：含义不直观的纯图标按钮统一使用 Naive UI `NTooltip`；`Button` 的 icon 尺寸自动启用，原生 `<button>` 图标按钮通过 `TooltipIconButton` 包装，同时保留 `aria-label`。tooltip 字号统一为 12px。弹窗关闭、标签关闭等标准 X 按钮只保留 `aria-label`，不显示 tooltip。
- **控件排版与边框**：输入框、按钮、选择触发器和菜单项统一使用 12px 控件字号；输入、文本域、选择器、数字输入显式 `bordered`，普通按钮显式有边框，仅 ghost/text 型按钮无边框。控件与菜单行高沿用 Naive 自身尺寸令牌，菜单圆角与阴影使用框架默认值。`NSelect` 同时设置 `size="small"` 与 `menu-size="small"`，普通下拉及自定义菜单使用 `ww-menu-text` / `ww-select-menu` 统一字体。描边/幽灵形态的危险文本按钮使用 `Button` 的 `tone="destructive"`，不要只加 `text-destructive`（Naive 的主题变量会覆盖类名颜色）。Monaco 编辑器在用户编码字体之后自动追加项目中文回退（MiSans / HarmonyOS / 思源 / Noto），但不改写持久化的字体设置。10px / 11px 仅用于非交互元数据。
- **无障碍与键盘交互**：页面提供 h1 与「跳到编辑器」链接；全局提供 `:focus-visible` 焦点环与 reduced-motion 降级。工作区标签与暂存区模板类型使用 roving tabindex + 左右方向键；对话框使用 `role=dialog` / `aria-modal` 并由 `NModal` 管理焦点陷阱和 Esc。toast、查找错误、自动保存状态分别使用 live region / alert。`input.vue` / `textarea.vue` 把 `aria-*` 传到原生控件；NSelect 需要同时设置 combobox、listbox 与 option 语义。`components/ui/dropdown.ts` 为 NDropdown 补齐 menu/menuitem 角色、方向键、Enter 与 Esc 焦点恢复；工具栏显隐使用 `NPopover + NCheckboxGroup`。尺寸分隔条使用 `role=separator` 并提供方向键调节。
- **主题**：CSS 变量（oklch）+ `.dark` 类切换（Tailwind 语义色），Naive 主题在 `App.vue` 通过 `n-config-provider` 跟随同一设置（themeOverrides 主色对齐品牌色）；系统深色状态由 `lib/theme.ts` 响应式提供，Monaco 主题经 `EditorView` → `MonacoEditor` 跟随同一设置。
- **设计系统**：Naive 全局主题与控件字号集中在 `lib/naiveTheme.ts`，通用控件外形放在 `components/ui/`，业务样式使用 Tailwind 语义色；具体边界与尺寸见 `docs/design-system.md`。
- **路径别名**：`@/` 指向 `src/`。
- **全局工具**：`src/tools/registry.ts` 注册表 + 悬浮工具栏入口（跟随聚焦编辑器显示于其底部）；工具按「行处理 / 文本转换 / 分割与规则」分类，支持默认隐藏与用户自定义显隐；工具是纯函数（输入文本 → 输出文本），作用于聚焦编辑器（选区优先，无选区时处理全文），编辑器内可 Ctrl+Z 撤销；新增工具只需在注册表追加一条并标注分类。
- **PWA 更新提示**：`components/shared/PwaUpdatePrompt.vue` 负责注册 Service Worker 与右下角提示；`lib/pwaUpdate.ts` 统一处理更新检查、等待中的 worker、更新前落盘和刷新；`lib/pwaUpdateService.ts` 把控制器提供给设置页，手动检查发现等待版本时会重新唤起右下角提示。测试环境不注册。`lib/pwaInstall.ts` 捕获安装提示并在设置页提供「安装应用」入口，状态栏在离线时显示提示。
- **多标签页提示**：`lib/multiTab.ts` 用 BroadcastChannel 做心跳，状态栏提示其他标签页数量，避免多个标签同时编辑时后写覆盖；不做自动状态合并。
- **测试**：Vitest + @vue/test-utils（jsdom）覆盖组件与纯函数；Playwright（`e2e/`）覆盖真实 Monaco、Ctrl+K 命令面板、Ctrl+F 查找聚焦、文件拖入、剪贴板、刷新恢复、右栏写回和设置页窄屏/按钮间距。测试模式通过 vite alias 将 `monaco-editor` 替换为 `src/test/mockMonaco.ts`（构建不受影响）；编辑器组件用 `src/test/stubs.ts` 的 `monacoEditorStub` 代替（`vi.mock` 时参考 `src/App.test.ts`）。改动画布组件后跑 `pnpm test`，浏览器交互再跑 `pnpm test:e2e`。**本地与 CI 跑测试都需要 Node `^22.22.2 || ^24.15.0 || >=26.0.0`**（jsdom 30 的 engines 要求，Node 20 下 vitest 无法启动 worker；推荐版本见 `.nvmrc`，CI 用 Node 24）。
- **CI**：`.github/workflows/ci.yml` **只在推 tag 时**依次执行 `pnpm format:check`、`pnpm lint`、`pnpm test`、`pnpm build`（push main / PR 不跑）；本地提交前跑同样四项。
- **内置数据**：`lib/defaultData.ts` 维护内置替换规则与排序模板（增量注入：新内置项对老用户可见，删除不复活，下架项自动移除）；`main.ts` 启动时调用 `seedDefaultData()`。

## 代码约定

- 组件 `PascalCase`、函数/变量 `camelCase`、常量 `UPPER_SNAKE_CASE`；严格模式 TS。
- 新增功能优先放对应 `views/`，通用逻辑放 `lib/`，跨组件状态放 `stores/`。
- 样式用 Tailwind 原子类；语义色使用主题变量（`bg-background`、`text-muted-foreground` 等），不要硬编码颜色。
- 新环境变量使用 `VITE_` 前缀并补充到 `.env.example`，不得提交真实密钥。
- 修改 Monaco 相关代码时注意：当前使用 0.52.x。0.53+ 的 worker 导入路径和语言服务 worker
  产物需要单独迁移与验证（见分支 `codex/monaco-upgrade-eval`），不要把升级与业务改动混在一起。

## Git 约定

- 提交信息遵循 Conventional Commits，**主题行与正文使用中文**（前缀保留英文）：
  - 主题行 ≤ 50 字符、祈使句、结尾不加标点；
  - 需要补充说明时，主题下空一行写正文，正文每行 ≤ 72 字符；
  - 常用前缀：`feat` / `fix` / `docs` / `refactor` / `chore` / `style` / `test` / `perf` / `build` / `ci`。
- 主分支名为 `main`；功能开发在独立分支进行，完成后通过 PR 合并。
- 推送 / 部署前必须先征得开发者确认（推送会自动触发 Vercel 部署）。
- **不要在 PR / Issue 下留言、评论或回复**（每一条都会给开发者发邮件通知）；
  关闭 PR 时也不要附理由评论。
- **不要擅自创建 Release**：Release 只能由开发者创建。
- **tag 只在开发者明确要求时创建**；已有 tag 不要删除。
- **CI 只在推 tag 时运行**（`.github/workflows/ci.yml` 的 `on: push: tags`）；
  不要改成 push main 或 pull_request 触发，也不要新增其他工作流。
- **不要擅自发版**：Release 只由开发者创建；推送 / 创建 tag 前都要先问。

## 给 AI 助手的提示

- 新任务开始前，先阅读本文件与 `docs/` 下相关文档。
- **改动完成后必须用 Codex 做代码审查**：按改动范围审查，逐条判断反馈，
  确属缺陷的就补测试修掉，不认同的要在回复里说明理由。审查通过才算完成一个改动。
- 改动后运行 `pnpm format:check`、`pnpm lint`、`pnpm test` 与 `pnpm build`（含类型检查）验证，与 CI 保持一致。
- 修改持久化数据结构或备份格式时，注意升级 `BackupData.version`（当前 5）并兼容旧数据；
  工作区结构变化请走 `lib/workspaceMigration.ts` 的归一化，保证旧单栏数据不丢。
