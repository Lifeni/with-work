# 设计系统约定

## 技术边界

项目保留 Vue 3 + Vite + TypeScript + Tailwind CSS + Naive UI + Monaco Editor。
Naive UI 提供成熟的键盘交互、浮层定位和复杂控件；Tailwind 负责布局与业务界面；
Monaco 只负责编辑器能力。不要为了统一视觉而整体替换 UI 框架。

## 样式来源

1. **基础色与语义色**：`src/index.css` 中的 CSS 变量和 Tailwind `@theme inline`。
2. **Naive UI 全局主题**：`src/lib/naiveTheme.ts`，由 `App.vue` 的
   `NConfigProvider` 统一注入。
3. **通用控件外形**：`src/components/ui/` 下的薄封装。
4. **业务布局**：业务组件中的 Tailwind 原子类。

不要在业务组件中新增硬编码颜色；需要新语义色时先补 CSS 变量，再通过
`bg-*` / `text-*` / `border-*` 使用。

设置页等重复出现的“卡片 + 标题 + 右侧动作”结构使用
`components/ui/section-card.vue`，不要在业务组件里重复拼接同类卡片。
设置页内容按 `views/settings/` 下的外观、关于、数据管理、本地存储四张卡片拆分；
规则与模板管理弹窗共用 `components/shared/ManagerDialogFrame.vue`，统一导入/导出、
删除确认和弹窗内容宽度。

状态栏中的多标签页提示与离线提示都使用 10–11px 非交互元数据样式，
与保存状态保持同一行优先级，不引入新的强调色。

## 控件尺寸

- 输入框、普通按钮、选择器触发器：高度 `28px`。
- 控件字号：`12px`。
- 图标与文字间距：默认 `6px`；设置页操作按钮通过
  `.ww-settings-actions .n-button__content` 统一。
- 图标按钮尺寸：`28px`（`icon-sm`）或 `36px`（`icon`）。
- `10px` / `11px` 仅用于非交互元数据，不用于可点击控件。

## Naive UI 使用规则

- 复杂浮层、选择器、输入和对话框优先使用 Naive UI，不自行重写焦点陷阱。
- 同类控件优先走 `components/ui` 封装；业务组件不要重复拼装一套按钮/输入框。
- 描边或幽灵形态的危险文本按钮使用 `tone="destructive"`；只写 `text-destructive`
  会被 Naive 按钮的内联 `--n-text-color` 覆盖，实际仍显示为灰色。
- 需要覆盖 Naive 内部结构时，优先增加全局 `themeOverrides`；CSS 覆盖统一加
  `ww-` 前缀并说明原因，避免无注释的 `.n-*` 选择器。
- `NSelect` 同时使用 `size="small"` 与 `menu-size="small"`，并补齐
  combobox/listbox/option 语义。

## 响应式与弹窗

- 窄屏弹窗宽度为 `calc(100vw - 2rem)`，左右至少保留 `16px`。
- 设置页在 `md` 以上双栏，窄屏单栏；数据管理按钮在 `sm` 以上双列。
- 编辑器在 `<1024px` 纵向堆叠，不隐藏关键操作。
- 全局 toast 与 PWA 更新提示使用 `z-index: 2100`，高于 `NModal`；否则设置弹窗里的
  “检查更新”、导入导出反馈会被遮罩挡住。

## 验证

- 组件单测覆盖交互、键盘语义和主题配置。
- Playwright 覆盖设置页窄屏边距、按钮间距、明暗主题和横向溢出。
- 涉及颜色或间距的改动，同时检查 `prefers-color-scheme` 跟随状态。
