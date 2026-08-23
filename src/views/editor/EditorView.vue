<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import * as monaco from "monaco-editor";
import {
  ArrowsLeftRight,
  ArrowsUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ClipboardCheck,
  Copy,
  FileDiff,
  FileText,
  Inbox,
  ListNumbers,
  Trash,
} from "@vicons/tabler";
import MonacoEditor from "@/components/shared/MonacoEditor.vue";
import DiffEditor from "@/components/shared/DiffEditor.vue";
import AppDialog from "@/components/ui/dialog.vue";
import Button from "@/components/ui/button.vue";
import FindReplacePanel from "@/views/editor/FindReplacePanel.vue";
import { detectLanguage } from "@/lib/detect";
import { getActiveEditor, setActiveEditor } from "@/lib/editorBridge";
import { applyReplacements } from "@/lib/replace";
import { splitLines } from "@/lib/split";
import { cn, downloadText, uid } from "@/lib/utils";
import { cleanupWorkspaceModels, getWorkspaceModels } from "@/lib/workspaceModels";
import { useRulesStore } from "@/stores/rules";
import { useSettingsStore } from "@/stores/settings";
import { useStagingStore } from "@/stores/staging";
import { useStatusStore } from "@/stores/status";
import { useTemplatesStore } from "@/stores/templates";
import { useTextTemplatesStore } from "@/stores/textTemplates";
import { useToastStore } from "@/stores/toast";
import { useWorkspaceStore } from "@/stores/workspace";

type Side = "left" | "right";

/**
 * 额外快捷键（仅注册 Monaco standalone 未内置的键位；
 * Ctrl+D、Ctrl+Shift+L、Ctrl+Shift+K、Ctrl+Enter、Ctrl+Shift+Enter、Alt+↑/↓、
 * Shift+Alt+↑/↓ 等已由 Monaco 原生绑定，覆盖注册反而会破坏原生行为）
 */
const EXTRA_KEYBINDINGS: Array<{
  id: string;
  label: string;
  keybinding: number;
  command: string;
}> = [
  // 文本转换
  {
    id: "ww.transform-uppercase",
    label: "转换为大写",
    keybinding: monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyU,
    command: "editor.action.transformToUppercase",
  },
  // 行处理（无标准键位，选用不冲突的组合）
  {
    id: "ww.sort-lines-asc",
    label: "升序排序行",
    keybinding: monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyJ,
    command: "editor.action.sortLinesAscending",
  },
  {
    id: "ww.sort-lines-desc",
    label: "降序排序行",
    keybinding: monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.KeyJ,
    command: "editor.action.sortLinesDescending",
  },
  {
    id: "ww.remove-duplicate-lines",
    label: "删除重复行",
    keybinding: monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.KeyR,
    command: "editor.action.removeDuplicateLines",
  },
  {
    id: "ww.trim-trailing-whitespace",
    label: "修剪行尾空格",
    keybinding: monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyT,
    command: "editor.action.trimTrailingWhitespace",
  },
];

/** 文件名时间戳：2026-08-15-221530 */
function fileTimestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

/** Ctrl+S：把聚焦编辑器的全部文本保存为 txt 文件；无文本时提示 */
function saveFocused() {
  const ed = getActiveEditor();
  const text = ed?.getModel()?.getValue() ?? "";
  if (!text.trim()) {
    useToastStore().push("没有文本");
    return;
  }
  const wsStore = useWorkspaceStore();
  const name = wsStore.workspaces.find((w) => w.id === wsStore.activeId)?.name ?? "工作区";
  downloadText(`${name}-${fileTimestamp()}.txt`, text);
  useToastStore().push("已保存到下载");
}

const wsStore = useWorkspaceStore();
const settingsStore = useSettingsStore();
const statusStore = useStatusStore();
const toast = useToastStore().push;

const ws = computed(() => wsStore.workspaces.find((w) => w.id === wsStore.activeId));
const left = computed(() => ws.value?.left ?? "");
const right = computed(() => ws.value?.right ?? "");

const leftModel = computed(() =>
  ws.value ? (getWorkspaceModels(ws.value.id)?.left ?? null) : null,
);
const rightModel = computed(() =>
  ws.value ? (getWorkspaceModels(ws.value.id)?.right ?? null) : null,
);

const leftEditor = ref<monaco.editor.IStandaloneCodeEditor | null>(null);
const rightEditor = ref<monaco.editor.IStandaloneCodeEditor | null>(null);
const focused = ref<Side>("left");
// 对比弹窗：手动打开，不影响两个编辑器的位置与状态
const diffOpen = ref(false);
const panelRef = ref<InstanceType<typeof FindReplacePanel> | null>(null);
const editorAreaRef = ref<HTMLDivElement | null>(null);

const theme = computed<string>(() =>
  settingsStore.theme === "dark"
    ? "vs-dark"
    : settingsStore.theme === "light"
      ? "light"
      : window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "vs-dark"
        : "light",
);

const editorOptions: monaco.editor.IStandaloneEditorConstructionOptions = {
  minimap: { enabled: true, scale: 1 },
  fontSize: settingsStore.fontSize,
  fontFamily: settingsStore.editorFontFamily,
  wordWrap: settingsStore.wordWrap ? "on" : "off",
  automaticLayout: true,
  scrollBeyondLastLine: false,
  renderLineHighlight: "all",
  tabSize: 4,
  padding: { top: 10, bottom: 10 },
  scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
  smoothScrolling: true,
  cursorBlinking: "smooth",
  fixedOverflowWidgets: true,
  // 关闭 Monaco 原生拖拽与拖入功能：拖入文本会走 snippet/paste 解析（$0 被展开/变形），
  // 全部拖放由包裹层的捕获事件接管
  dragAndDrop: false,
  dropIntoEditor: { enabled: false },
};

// VS Code 风格快捷键：多光标 / 行操作 / 文本转换 / 行处理（作用于当前编辑器）
function mountEditor(ed: monaco.editor.IStandaloneCodeEditor, side: Side) {
  if (side === "left") leftEditor.value = ed;
  else rightEditor.value = ed;
  setActiveEditor(ed);
  ed.onDidFocusEditorText(() => {
    focused.value = side;
    setActiveEditor(ed);
  });
  ed.onDidChangeCursorPosition((e) =>
    statusStore.setCursor(e.position.lineNumber, e.position.column),
  );
  ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, () => panelRef.value?.open());
  ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyH, () => panelRef.value?.open());
  // Ctrl+S：保存聚焦编辑器文本（下载 txt 文件）
  ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, saveFocused);
  // 额外快捷键（不覆盖 Monaco 原生绑定）
  for (const { id, label, keybinding, command } of EXTRA_KEYBINDINGS) {
    ed.addAction({
      id,
      label,
      keybindings: [keybinding],
      run: () => ed.trigger("keyboard", command, null),
    });
  }
}

// 卸载时注销全局编辑器引用（全局工具会回退到直接读写工作区内容）
onUnmounted(() => setActiveEditor(null));

// 无工作区时（全部删除）：清空编辑器引用，避免对已释放实例调用 setModel 崩溃
watch(
  () => wsStore.workspaces.length,
  (n) => {
    if (n === 0) {
      leftEditor.value = null;
      rightEditor.value = null;
      setActiveEditor(null);
    }
    // 工作区被删除时清理对应 Model（防内存泄漏）
    const ids = new Set(wsStore.workspaces.map((w) => w.id));
    cleanupWorkspaceModels(ids);
  },
  { immediate: true },
);

// store 内容变化（交换/复制到另一侧/备份导入等直接改 store 的操作）时同步到 Model，
// 保证 Model 与 store 一致（否则切回工作区时会显示陈旧内容）；executeEdits 保留可撤销
watch([left, right], () => {
  const id = ws.value?.id;
  const pair = id ? getWorkspaceModels(id) : null;
  if (!pair) return;
  if (leftEditor.value && pair.left.getValue() !== left.value) {
    leftEditor.value.executeEdits("ww-sync", [
      { range: pair.left.getFullModelRange(), text: left.value },
    ]);
  }
  if (rightEditor.value && pair.right.getValue() !== right.value) {
    rightEditor.value.executeEdits("ww-sync", [
      { range: pair.right.getFullModelRange(), text: right.value },
    ]);
  }
});

// 查找替换与列表工具的目标：当前聚焦的编辑器（边框高亮者）
const focusedEditor = computed(() =>
  focused.value === "left" ? leftEditor.value : rightEditor.value,
);
const otherEditor = computed(() =>
  focused.value === "left" ? rightEditor.value : leftEditor.value,
);

const copyLeftToRight = () => wsStore.setRight(ws.value!.id, left.value);
const copyRightToLeft = () => wsStore.setLeft(ws.value!.id, right.value);

/** 复制聚焦编辑器的全部内容到剪贴板 */
function copyFocusedContent() {
  const text = focused.value === "left" ? left.value : right.value;
  if (!text) {
    toast("该编辑器没有可复制的内容");
    return;
  }
  void navigator.clipboard.writeText(text);
  toast("已复制聚焦编辑器全部内容");
}

/** 从剪贴板读取文本，粘贴到聚焦编辑器（选区替换，无选区插入光标处） */
async function pasteToFocused() {
  const ed = focusedEditor.value;
  const model = ed?.getModel();
  if (!ed || !model) {
    toast("没有可粘贴的编辑器");
    return;
  }
  try {
    const text = await navigator.clipboard.readText();
    if (!text) {
      toast("剪贴板为空");
      return;
    }
    const sel = ed.getSelection();
    const range = sel && !sel.isEmpty() ? sel : model.getFullModelRange();
    ed.executeEdits("ww-paste", [{ range, text }]);
    ed.focus();
    toast("已粘贴到聚焦编辑器（Ctrl+Z 可撤销）");
  } catch {
    toast("无法读取剪贴板（浏览器可能未授权）");
  }
}

/** 清空聚焦编辑器（可 Ctrl+Z 撤销） */
function clearFocusedContent() {
  const ed = focusedEditor.value;
  const model = ed?.getModel();
  if (!ed || !model) {
    toast("没有可清空的编辑器");
    return;
  }
  ed.executeEdits("ww-clear", [{ range: model.getFullModelRange(), text: "" }]);
  toast("已清空聚焦编辑器（Ctrl+Z 可撤销）");
}

/** 拖拽悬停（捕获阶段，先于 Monaco 内部处理）：允许规则/文本拖入 */
function handleEditorDragOver(e: DragEvent) {
  const dt = e.dataTransfer;
  if (!dt || dt.types.includes("Files")) return;
  if (dt.types.includes("application/x-with-work-rule") || dt.types.includes("text/plain")) {
    e.preventDefault();
    e.stopPropagation();
    dt.dropEffect = "copy";
  }
}

/** 拖拽放下：规则拖入 → 按规则替换；普通文本拖入 → 落点插入纯文本（$0 原样保留） */
function handleEditorDrop(e: DragEvent, side: Side) {
  const dt = e.dataTransfer;
  if (!dt) return;
  e.preventDefault();
  e.stopPropagation();
  const ed = side === "left" ? leftEditor.value : rightEditor.value;
  if (!ed) return;

  // 替换规则拖入：按规则对编辑器全部内容执行替换（可撤销）
  if (dt.types.includes("application/x-with-work-rule")) {
    const ruleId = dt.getData("application/x-with-work-rule");
    const rule = useRulesStore().rules.find((x) => x.id === ruleId);
    const model = ed.getModel();
    if (rule && model) {
      const text = model.getValue();
      const result = applyReplacements(text, rule.find, rule.replace, rule.isRegex, rule.matchCase);
      ed.executeEdits("ww-rule-drop", [{ range: model.getFullModelRange(), text: result }]);
      toast(`已按规则「${rule.name}」替换`);
    }
    return;
  }

  // 普通文本拖入：落点插入纯文本
  const text = dt.getData("text/plain");
  if (text === undefined || text === null || text === "") return;
  // 优先用 Monaco 坐标 API 获取落点；异常（返回 null）时退化到当前光标 / 文首，保证拖拽可用
  const target = ed.getTargetAtClientPoint(e.clientX, e.clientY);
  const pos = target?.position ?? ed.getPosition() ?? { lineNumber: 1, column: 1 };
  if (target?.position == null) {
    toast("已插入到光标处");
  }
  ed.executeEdits("ww-drop", [
    {
      range: {
        startLineNumber: pos.lineNumber,
        startColumn: pos.column,
        endLineNumber: pos.lineNumber,
        endColumn: pos.column,
      },
      text,
    },
  ]);
  ed.focus();
}

/** 把聚焦编辑器内容（选区优先）导出到暂存区 / 模板 */
function importFromFocused(target: "staging" | "text-template" | "sort-template") {
  const ed = focusedEditor.value;
  const model = ed?.getModel();
  const sel = ed?.getSelection();
  const text =
    ed && model && sel && !sel.isEmpty()
      ? model.getValueInRange(sel)
      : focused.value === "left"
        ? left.value
        : right.value;
  if (!text.trim()) {
    toast("该编辑器没有可导出的文本");
    return;
  }
  const name = text.length > 12 ? `${text.slice(0, 12)}…` : text;
  if (target === "staging") {
    useStagingStore().add(text);
    toast("已导入到暂存区");
  } else if (target === "text-template") {
    useTextTemplatesStore().addTemplate({ id: uid(), name, text, group: undefined });
    toast(`已保存为文本模板「${name}」`);
  } else {
    const items = splitLines(text);
    if (items.length === 0) {
      toast("该编辑器没有可导出的行内容");
      return;
    }
    const sortName = items[0].length > 12 ? `${items[0].slice(0, 12)}…` : items[0];
    useTemplatesStore().addTemplate({
      id: uid(),
      name: sortName,
      items,
      group: undefined,
    });
    toast(`已保存为排序模板「${sortName}」`);
  }
}

// 左右宽度比例（可拖动，记忆在设置中；增量式避免按下时突跳）
const split = computed(() => settingsStore.editorSplit ?? 0.5);
function startSplitResize(e: PointerEvent) {
  e.preventDefault();
  const startX = e.clientX;
  const startRatio = split.value;
  const onMove = (ev: PointerEvent) => {
    const rect = editorAreaRef.value?.getBoundingClientRect();
    if (!rect) return;
    const ratio = startRatio + (ev.clientX - startX) / rect.width;
    settingsStore.setEditorSplit(Math.min(0.75, Math.max(0.25, ratio)));
  };
  const onUp = () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    document.body.style.userSelect = "";
  };
  document.body.style.userSelect = "none";
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}

/** 编辑器内容变化：写入 store（Model 变化事件，工作区切换/撤销重做同样触发） */
function handleModelChange(side: Side, value: string) {
  if (!ws.value) return;
  if (side === "left") wsStore.setLeft(ws.value.id, value);
  else wsStore.setRight(ws.value.id, value);
}
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- 顶部工具面板：查找替换 + 分割 + 排序规则（单卡片） -->
    <div class="shrink-0 px-2 pt-2">
      <FindReplacePanel
        ref="panelRef"
        :focused-editor="focusedEditor"
        :other-editor="otherEditor"
      />
    </div>

    <!-- 双编辑器区（窄屏纵向堆叠，宽屏左右并排） -->
    <div ref="editorAreaRef" class="flex min-h-0 flex-1 flex-col gap-1.5 p-2 lg:flex-row">
      <div
        :class="
          cn(
            'min-h-0 flex-1 overflow-hidden rounded-md transition-shadow lg:min-w-0 lg:flex-none',
            focused === 'left' ? 'ring-2 ring-primary/70' : 'ring-1 ring-border',
          )
        "
        :style="{ flexBasis: `calc(${split * 100}% - 18px)` }"
        @dragover.capture="handleEditorDragOver"
        @drop.capture="(e: DragEvent) => handleEditorDrop(e, 'left')"
      >
        <MonacoEditor
          :model="leftModel"
          :theme="theme"
          :options="editorOptions"
          @mount="(ed: monaco.editor.IStandaloneCodeEditor) => mountEditor(ed, 'left')"
          @model-change="(v: string) => handleModelChange('left', v)"
        />
      </div>

      <!-- 中间操作区：交换 / 复制 / 导出等（宽屏顶部对齐，窄屏居中） -->
      <div
        class="relative flex shrink-0 items-center justify-center gap-2 px-1 lg:w-9 lg:flex-col lg:justify-start lg:px-0"
      >
        <div
          class="absolute inset-y-0 -left-1.5 z-10 hidden w-3 cursor-ew-resize touch-none select-none rounded hover:bg-primary/20 lg:block"
          title="拖动调节左右宽度"
          @pointerdown="startSplitResize"
        />
        <div
          class="absolute inset-y-0 -right-1.5 z-10 hidden w-3 cursor-ew-resize touch-none select-none rounded hover:bg-primary/20 lg:block"
          title="拖动调节左右宽度"
          @pointerdown="startSplitResize"
        />
        <Button
          variant="ghost"
          size="icon-sm"
          title="复制聚焦编辑器全部内容"
          @click="copyFocusedContent"
        >
          <Copy />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          title="从剪贴板粘贴到聚焦编辑器"
          @click="pasteToFocused"
        >
          <ClipboardCheck />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          :title="diffOpen ? '对比弹窗已打开' : '进入对比模式'"
          @click="diffOpen = true"
          :active="diffOpen"
        >
          <FileDiff />
        </Button>
        <Button variant="ghost" size="icon-sm" title="交换内容" @click="wsStore.swapSides(ws!.id)">
          <!-- 窄屏上下堆叠时用上下交换图标，宽屏左右并排用左右交换图标 -->
          <ArrowsUpDown class="lg:hidden" />
          <ArrowsLeftRight class="hidden lg:block" />
        </Button>
        <Button variant="ghost" size="icon-sm" title="复制到另一侧" @click="copyLeftToRight">
          <ChevronDown class="lg:hidden" />
          <ChevronRight class="hidden lg:block" />
        </Button>
        <Button variant="ghost" size="icon-sm" title="复制到另一侧" @click="copyRightToLeft">
          <ChevronUp class="lg:hidden" />
          <ChevronLeft class="hidden lg:block" />
        </Button>

        <!-- 导出聚焦编辑器（选区优先）到暂存区 / 模板 -->
        <Button
          variant="ghost"
          size="icon-sm"
          title="聚焦编辑器 → 暂存区"
          @click="importFromFocused('staging')"
        >
          <Inbox />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          title="聚焦编辑器 → 文本模板"
          @click="importFromFocused('text-template')"
        >
          <FileText />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          title="聚焦编辑器 → 排序模板"
          @click="importFromFocused('sort-template')"
        >
          <ListNumbers />
        </Button>

        <!-- 宽屏竖排时把清空按钮推到底部（窄屏横排自动居中，不占位） -->
        <div class="hidden lg:block lg:flex-1" />

        <Button
          variant="ghost"
          size="icon-sm"
          title="清空聚焦编辑器"
          class="text-destructive hover:text-destructive"
          @click="clearFocusedContent"
        >
          <Trash />
        </Button>
      </div>

      <div
        :class="
          cn(
            'min-h-0 flex-1 overflow-hidden rounded-md transition-shadow lg:min-w-0',
            focused === 'right' ? 'ring-2 ring-primary/70' : 'ring-1 ring-border',
          )
        "
        @dragover.capture="handleEditorDragOver"
        @drop.capture="(e: DragEvent) => handleEditorDrop(e, 'right')"
      >
        <MonacoEditor
          :model="rightModel"
          :theme="theme"
          :options="editorOptions"
          @mount="(ed: monaco.editor.IStandaloneCodeEditor) => mountEditor(ed, 'right')"
          @model-change="(v: string) => handleModelChange('right', v)"
        />
      </div>
    </div>

    <!-- 对比弹窗：只读 DiffEditor，不影响下方双编辑器 -->
    <AppDialog
      :open="diffOpen"
      title="对比模式"
      content-class="max-w-5xl"
      @update:open="(v: boolean) => (diffOpen = v)"
    >
      <div class="h-[65vh] overflow-hidden rounded-md ring-1 ring-border">
        <DiffEditor
          :original="left"
          :modified="right"
          :language="detectLanguage(left)"
          :theme="theme"
          :options="{ ...editorOptions, readOnly: true, renderSideBySide: true }"
        />
      </div>
    </AppDialog>
  </div>
</template>
