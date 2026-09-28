<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import {
  ArrowsLeftRight,
  ClipboardCheck,
  Copy,
  FileDiff,
  FileText,
  LayoutSidebarLeftCollapse,
  ListNumbers,
  Pencil,
  Plus,
  Settings,
  Trash,
} from "@vicons/tabler";
import Button from "@/components/ui/button.vue";
import ConfirmDialog from "@/components/shared/ConfirmDialog.vue";
import RulesDialog from "@/components/shared/RulesDialog.vue";
import TemplatesDialog from "@/components/shared/TemplatesDialog.vue";
import TextTemplatesDialog from "@/components/shared/TextTemplatesDialog.vue";
import Textarea from "@/components/ui/textarea.vue";
import { cn, formatTime, uid } from "@/lib/utils";
import { getToolInput } from "@/lib/applyTool";
import { getActiveEditor } from "@/lib/editorBridge";
import { splitLines } from "@/lib/split";
import { sortByReference } from "@/lib/sort";
import { importText } from "@/lib/transfer";
import { useRulesStore } from "@/stores/rules";
import { useStagingStore } from "@/stores/staging";
import { useSettingsStore } from "@/stores/settings";
import { useTemplatesStore } from "@/stores/templates";
import { useTextTemplatesStore } from "@/stores/textTemplates";
import { useToastStore } from "@/stores/toast";
import { useUiStore } from "@/stores/ui";
import { useWorkspaceStore } from "@/stores/workspace";
import type { ReplaceRule, SortTemplate, TextTemplate } from "@/types";

type PendingDelete = {
  kind: "staging" | "text-template" | "sort-template" | "rule";
  id: string;
  name: string;
};

const stagingStore = useStagingStore();
const uiStore = useUiStore();
const settingsStore = useSettingsStore();
const rulesStore = useRulesStore();
const templatesStore = useTemplatesStore();
const textTemplatesStore = useTextTemplatesStore();
const toast = useToastStore().push;

const stagingWidth = ref(settingsStore.stagingWidth ?? 320);
const templateHeight = ref(settingsStore.stagingTemplateHeight ?? 240);
const panelRef = ref<HTMLDivElement | null>(null);
// 宽度/高度样式直写目标（拖动时绕过渲染管线，直接改 DOM，保证立即生效）
const outerRef = ref<HTMLDivElement | null>(null);
const templateZoneRef = ref<HTMLDivElement | null>(null);
// 拖拽进行中标志：pointerdown 与 mousedown 双事件只允许第一次生效
let resizing = false;

const draft = ref("");
const confirmClear = ref(false);
const pendingDelete = ref<PendingDelete | null>(null);
const editingItemId = ref<string | null>(null);
const editDraft = ref("");
const templatesOpen = ref(false);
const textTemplatesOpen = ref(false);
const rulesOpen = ref(false);
const editTextTemplateId = ref<string | null>(null);
const editSortTemplateId = ref<string | null>(null);
const editRuleId = ref<string | null>(null);
const tplTab = ref<"text" | "sort" | "rules">("text");
const dragOver = ref<"staging" | "templates" | null>(null);

// 面板内部手柄命中数据标记：宽度 = 暂存区↔编辑器，高度 = 暂存区↔模板区
const RESIZE_WIDTH_MARK = "data-resize-width";
const RESIZE_HEIGHT_MARK = "data-resize-height";

/**
 * 手柄事件代理：在 document 捕获阶段拦截 pointerdown/mousedown，
 * 绕过面板内部可能存在的任何层级拦截，保证手柄必定可拖。
 */
function onDocResizeDown(e: Event) {
  const target = e.target as HTMLElement | null;
  if (!target?.closest) return;
  if (target.closest(`[${RESIZE_WIDTH_MARK}]`)) {
    startResize(e as MouseEvent);
  } else if (target.closest(`[${RESIZE_HEIGHT_MARK}]`)) {
    startTemplateResize(e as MouseEvent);
  }
}

// 窄屏判定：宽度不足时自动折叠暂存区（抽屉模式下标题栏内也有折叠按钮）
const NARROW_QUERY = "(max-width: 1023px)";
const narrowQuery = window.matchMedia(NARROW_QUERY);
const onNarrowChange = (e: MediaQueryListEvent) => {
  if (e.matches) uiStore.setStagingOpen(false);
};

onMounted(() => {
  document.addEventListener("pointerdown", onDocResizeDown, { capture: true });
  document.addEventListener("mousedown", onDocResizeDown, { capture: true });
  if (narrowQuery.matches) uiStore.setStagingOpen(false);
  narrowQuery.addEventListener("change", onNarrowChange);
});
onUnmounted(() => {
  document.removeEventListener("pointerdown", onDocResizeDown, { capture: true });
  document.removeEventListener("mousedown", onDocResizeDown, { capture: true });
  narrowQuery.removeEventListener("change", onNarrowChange);
});

/** 拖动调节面板宽度（增量式，按下时记录起点避免突跳；记忆在设置中）
 *  手柄位于面板右缘：向右拖变宽。拖动过程中同时写入 ref、store 与 DOM 元素样式 */
function startResize(e: MouseEvent) {
  if (resizing) return;
  resizing = true;
  e.preventDefault();
  const startX = e.clientX;
  const startWidth = stagingWidth.value;
  const apply = (w: number) => {
    const next = Math.min(560, Math.max(280, w));
    stagingWidth.value = next;
    settingsStore.setStagingWidth(next);
    if (outerRef.value) {
      outerRef.value.style.width = `${next}px`;
      outerRef.value.style.minWidth = `${next}px`;
      outerRef.value.style.maxWidth = `${next}px`;
      outerRef.value.style.flexBasis = `${next}px`;
    }
  };
  const onMove = (ev: MouseEvent) => {
    apply(startWidth + (ev.clientX - startX));
  };
  const onUp = () => {
    resizing = false;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
    document.body.style.userSelect = "";
  };
  document.body.style.userSelect = "none";
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);
}

/** 从剪贴板读取文本并添加到暂存区 */
async function pasteFromClipboard() {
  try {
    const text = await navigator.clipboard.readText();
    if (!text.trim()) {
      toast("剪贴板为空");
      return;
    }
    stagingStore.add(text);
    toast("已从剪贴板粘贴到暂存区");
  } catch {
    toast("无法读取剪贴板（请检查浏览器权限）");
  }
}

/** 按模板对编辑器内容（选区优先）排序并应用 */
function applyTemplate(t: SortTemplate) {
  const input = getToolInput();
  if (!input.trim()) {
    toast("编辑器没有可排序的内容");
    return;
  }
  const lines = splitLines(input);
  const r = sortByReference(lines, t.items);
  const text = r.sorted.join("\n");
  const editor = getActiveEditor();
  const model = editor?.getModel();
  const sel = editor?.getSelection();
  if (editor && model && sel && !sel.isEmpty()) {
    editor.executeEdits("ww-template", [{ range: sel, text }]);
  } else if (editor && model) {
    editor.executeEdits("ww-template", [{ range: model.getFullModelRange(), text }]);
  } else {
    const wsStore = useWorkspaceStore();
    if (wsStore.activeId) wsStore.setLeft(wsStore.activeId, text);
  }
  toast(
    `已按模板「${t.name}」排序` +
      (r.unmatched.length > 0 ? `，${r.unmatched.length} 项未匹配` : ""),
  );
}

/** 把文本模板插入到当前聚焦的编辑器（选区优先） */
function insertTextTemplate(t: TextTemplate) {
  const editor = getActiveEditor();
  const model = editor?.getModel();
  const sel = editor?.getSelection();
  if (editor && model && sel) {
    editor.executeEdits("ww-text-template", [{ range: sel, text: t.text }]);
    editor.focus();
  } else {
    const wsStore = useWorkspaceStore();
    if (wsStore.activeId) wsStore.setLeft(wsStore.activeId, t.text);
  }
  toast(`已插入模板「${t.name}」`);
}

function copyItem(text: string) {
  void navigator.clipboard.writeText(text);
  toast("已复制");
}

/** 暂存区条目行内编辑 */
function startItemEdit(id: string) {
  const item = stagingStore.items.find((i) => i.id === id);
  if (!item) return;
  editingItemId.value = id;
  editDraft.value = item.text;
}
function saveItemEdit() {
  if (editingItemId.value) stagingStore.updateItem(editingItemId.value, editDraft.value);
  editingItemId.value = null;
}
function cancelItemEdit() {
  editingItemId.value = null;
}

/** 从列表条目进入对应管理对话框的编辑状态 */
function editTextTemplate(id: string) {
  editTextTemplateId.value = id;
  textTemplatesOpen.value = true;
}
function editSortTemplate(id: string) {
  editSortTemplateId.value = id;
  templatesOpen.value = true;
}
function editRule(id: string) {
  editRuleId.value = id;
  rulesOpen.value = true;
}

// 规则卡片：双击编辑，拖拽到编辑器按规则替换（单击无行为）
function handleRuleDoubleClick(r: ReplaceRule) {
  editRule(r.id);
}

/** 拖拽悬停 / 落下：编辑器文本可拖入暂存区或模板区 */
function hasDragType(types: readonly string[] | DOMStringList | undefined, type: string): boolean {
  if (!types) return false;
  if (Array.isArray(types)) return types.includes(type);
  return (types as DOMStringList).contains?.(type) ?? false;
}

function handleDragOver(e: DragEvent, zone: "staging" | "templates") {
  if (hasDragType(e.dataTransfer?.types, "text/plain")) {
    e.preventDefault();
    e.dataTransfer!.dropEffect = "copy";
    dragOver.value = zone;
  }
}

function handleDragLeave() {
  dragOver.value = null;
}

function handleDrop(e: DragEvent, zone: "staging" | "templates") {
  e.preventDefault();
  dragOver.value = null;
  const dt = e.dataTransfer;
  if (!dt) return;
  // 拖回原区域（来源标记相同）：不重复添加
  if (dt.getData("application/x-with-work-source") === zone) return;
  const text = dt.getData("text/plain");
  if (!text.trim()) return;
  if (zone === "staging") {
    stagingStore.add(text);
    toast("已拖入暂存区");
  } else {
    const name = text.length > 12 ? `${text.slice(0, 12)}…` : text;
    textTemplatesStore.addTemplate({ id: uid(), name, text, group: undefined });
    toast(`已保存为文本模板「${name}」`);
  }
}

/** 拖动调节模板区高度（增量式：记录起点避免突跳；优先用面板高度限制上限，缺失时回落）
 *  拖动过程中同时写入 ref、store 与 DOM 元素样式 */
function startTemplateResize(e: MouseEvent) {
  if (resizing) return;
  resizing = true;
  e.preventDefault();
  const startY = e.clientY;
  const startHeight = templateHeight.value;
  const apply = (h: number) => {
    const max = panelRef.value?.getBoundingClientRect().height;
    const next = Math.min(max ? max * 0.7 : 640, Math.max(160, h));
    templateHeight.value = next;
    settingsStore.setStagingTemplateHeight(next);
    if (templateZoneRef.value) {
      templateZoneRef.value.style.height = `${next}px`;
    }
  };
  const onMove = (ev: MouseEvent) => {
    apply(startHeight + (startY - ev.clientY));
  };
  const onUp = () => {
    resizing = false;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
    document.body.style.userSelect = "";
  };
  document.body.style.userSelect = "none";
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);
}

/** 自绘拖拽载荷（卡片 → 编辑器；绕开原生 draggable 启动判定不稳定问题） */
type CardDragPayload = {
  kind: "staging" | "text-template" | "sort-template" | "rule";
  text: string;
  ruleId?: string;
};

/** 拖拽激活阈值（px）：按下后移动超过该距离才进入拖拽态，避免与双击/点击混淆 */
const DRAG_THRESHOLD = 5;

let cardDrag: {
  startX: number;
  startY: number;
  payload: CardDragPayload;
  active: boolean;
  hit: HTMLElement | null;
  ghost: HTMLElement | null;
} | null = null;

function cardDragMove(e: PointerEvent) {
  if (!cardDrag) return;
  const dx = e.clientX - cardDrag.startX;
  const dy = e.clientY - cardDrag.startY;
  // 未达阈值：保持按下状态，不创建拖拽反馈
  if (!cardDrag.active && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
  if (!cardDrag.active) {
    cardDrag.active = true;
    document.body.style.userSelect = "none";
    const ghost = document.createElement("div");
    ghost.className = "ww-drag-ghost";
    const t = cardDrag.payload.text;
    ghost.textContent = t.length > 60 ? `${t.slice(0, 60)}…` : t;
    document.body.appendChild(ghost);
    cardDrag.ghost = ghost;
  }
  if (cardDrag.ghost) {
    cardDrag.ghost.style.left = `${e.clientX + 10}px`;
    cardDrag.ghost.style.top = `${e.clientY + 12}px`;
  }
  // 命中检测：是否悬停在编辑器 wrapper（jsdom 等无 elementFromPoint 环境自动跳过）
  const hit = (document.elementFromPoint?.(e.clientX, e.clientY)?.closest?.("[data-ww-editor]") ??
    null) as HTMLElement | null;
  if (hit !== cardDrag.hit) {
    if (cardDrag.hit) cardDrag.hit.style.outline = "";
    cardDrag.hit = hit;
    if (hit) hit.style.outline = "2px solid var(--ring)";
  }
}

function cardDragUp(e: PointerEvent) {
  if (!cardDrag) return;
  const drag = cardDrag;
  cardDrag = null;
  window.removeEventListener("pointermove", cardDragMove);
  window.removeEventListener("pointerup", cardDragUp);
  window.removeEventListener("pointercancel", cardDragUp);
  document.body.style.userSelect = "";
  if (drag.hit) drag.hit.style.outline = "";
  if (drag.active && drag.hit) {
    // 命中编辑器：派发自定义事件，由 EditorView 负责落点插入 / 规则替换
    drag.hit.dispatchEvent(
      new CustomEvent("ww-card-drop", {
        bubbles: true,
        detail: { ...drag.payload, clientX: e.clientX, clientY: e.clientY },
      }),
    );
  }
  drag.ghost?.remove();
}

function startCardDrag(e: PointerEvent, payload: CardDragPayload) {
  if (e.button !== 0 || (e.target as HTMLElement | null)?.closest?.("button")) return;
  cardDrag = {
    startX: e.clientX,
    startY: e.clientY,
    payload,
    active: false,
    hit: null,
    ghost: null,
  };
  window.addEventListener("pointermove", cardDragMove);
  window.addEventListener("pointerup", cardDragUp);
  window.addEventListener("pointercancel", cardDragUp);
}
</script>

<template>
  <!-- 宽屏停靠式面板（编辑器左侧）；窄屏降级为左侧悬浮抽屉（默认收起，右下角按钮打开） -->
  <div
    ref="outerRef"
    :class="
      cn(
        'relative min-w-0 bg-card',
        uiStore.stagingOpen
          ? 'fixed inset-y-0 left-0 z-40 shadow-2xl lg:z-auto lg:shadow-none'
          : 'hidden lg:block',
        'lg:relative lg:shrink-0 lg:grow-0 lg:border-r lg:border-border',
      )
    "
    :style="{
      width: uiStore.stagingOpen ? `${stagingWidth}px` : '0px',
      minWidth: uiStore.stagingOpen ? `${stagingWidth}px` : '0px',
      maxWidth: uiStore.stagingOpen ? `${stagingWidth}px` : '0px',
      flexBasis: uiStore.stagingOpen ? `${stagingWidth}px` : '0px',
    }"
  >
    <div ref="panelRef" class="flex h-full min-w-0 flex-col overflow-hidden">
      <div class="flex h-9 items-center gap-2 border-b border-border px-3">
        <!-- 悬浮/抽屉模式下（页面宽度不足）标题前的折叠按钮；
             lg:hidden! 需压过 Naive 未分层样式的 display -->
        <Button
          variant="ghost"
          size="icon-sm"
          title="折叠暂存区"
          class="lg:hidden!"
          @click="uiStore.setStagingOpen(false)"
        >
          <LayoutSidebarLeftCollapse />
        </Button>
        <!-- 标题靠左：文字 + 计数徽标 -->
        <span class="flex items-center gap-1.5 text-xs font-medium"> 全局暂存区 </span>
        <div class="flex-1" />
        <Button variant="ghost" size="icon-sm" title="清空暂存区" @click="confirmClear = true">
          <Trash />
        </Button>
      </div>

      <div class="space-y-1.5 border-b border-border p-3">
        <Textarea v-model="draft" :rows="2" placeholder="粘贴或输入文本，暂存后供各工具取用…" />
        <div class="flex gap-1.5">
          <Button
            size="sm"
            class="h-7 flex-1 text-xs"
            @click="
              () => {
                stagingStore.add(draft);
                if (draft.trim()) toast('已添加到暂存区');
                draft = '';
              }
            "
          >
            <Plus class="size-3.5" />
            添加
          </Button>
          <Button
            size="sm"
            variant="outline"
            class="h-7 flex-1 text-xs"
            title="从剪贴板粘贴到暂存区"
            @click="pasteFromClipboard"
          >
            <ClipboardCheck class="size-3.5" />
            从剪贴板粘贴
          </Button>
        </div>
      </div>

      <div
        data-testid="staging-drop-zone"
        :class="
          cn(
            'min-h-0 min-w-0 flex-1 space-y-2 overflow-y-auto p-3 transition-colors',
            dragOver === 'staging' && 'bg-accent/60',
          )
        "
        @dragover="(e: DragEvent) => handleDragOver(e, 'staging')"
        @dragleave="handleDragLeave"
        @drop="(e: DragEvent) => handleDrop(e, 'staging')"
      >
        <div
          v-if="stagingStore.items.length === 0"
          class="flex h-32 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border text-xs text-muted-foreground"
        >
          <span>暂存区为空</span>
          <span>在上方粘贴文本即可暂存</span>
        </div>
        <template v-else>
          <div v-for="item in stagingStore.items" :key="item.id">
            <!-- 行内编辑态 -->
            <template v-if="editingItemId === item.id">
              <textarea
                v-model="editDraft"
                autofocus
                rows="3"
                @keydown.enter.exact.prevent="saveItemEdit"
                @keydown.esc="cancelItemEdit"
                class="w-full resize-none rounded border border-border bg-background p-1.5 text-xs outline-none focus:ring-1 focus:ring-ring"
              />
              <div class="mt-1.5 flex items-center justify-end gap-1">
                <button
                  type="button"
                  title="保存"
                  @click="saveItemEdit"
                  class="rounded bg-primary px-2 py-0.5 text-[10px] text-primary-foreground hover:opacity-90"
                >
                  保存
                </button>
                <button
                  type="button"
                  title="取消"
                  @click="cancelItemEdit"
                  class="rounded px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-accent"
                >
                  取消
                </button>
              </div>
            </template>
            <!-- 展示态 -->
            <template v-else>
              <div
                title="拖拽到编辑器可快速插入，双击可编辑"
                @dblclick="startItemEdit(item.id)"
                @pointerdown="
                  (e: PointerEvent) => startCardDrag(e, { kind: 'staging', text: item.text })
                "
                class="cursor-grab select-none rounded-md border border-border bg-background p-2 active:cursor-grabbing"
              >
                <p class="line-clamp-3 whitespace-pre-wrap break-all text-xs">{{ item.text }}</p>
                <div class="mt-1.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                  <span>{{ item.text.length }} 字符</span>
                  <span>·</span>
                  <span>{{ formatTime(item.createdAt) }}</span>
                  <div class="flex-1" />
                  <button
                    type="button"
                    title="编辑"
                    @click="startItemEdit(item.id)"
                    class="rounded p-0.5 hover:bg-accent hover:text-accent-foreground"
                  >
                    <Pencil class="size-3" />
                  </button>
                  <button
                    type="button"
                    title="复制"
                    @click="copyItem(item.text)"
                    class="rounded p-0.5 hover:bg-accent hover:text-accent-foreground"
                  >
                    <Copy class="size-3" />
                  </button>
                  <button
                    type="button"
                    title="导入到对比·左侧"
                    @click="importText('diff-left', item.text)"
                    class="rounded p-0.5 hover:bg-accent hover:text-accent-foreground"
                  >
                    <FileDiff class="size-3" />
                  </button>
                  <button
                    type="button"
                    title="导入到对比·右侧"
                    @click="importText('diff-right', item.text)"
                    class="rounded p-0.5 hover:bg-accent hover:text-accent-foreground"
                  >
                    <FileDiff class="size-3" />
                  </button>
                  <button
                    type="button"
                    title="删除此条目"
                    @click="
                      pendingDelete = {
                        kind: 'staging',
                        id: item.id,
                        name: item.text.slice(0, 20),
                      }
                    "
                    class="rounded p-0.5 text-destructive hover:bg-accent"
                  >
                    <Trash class="size-3" />
                  </button>
                </div>
              </div>
            </template>
          </div>
        </template>
      </div>

      <div
        class="flex items-center gap-1 border-t border-border px-3 py-1.5 text-[10px] text-muted-foreground"
      >
        <ArrowsLeftRight class="size-3" />
        暂存区为全局共用，所有工作区共享；拖拽条目到编辑器可快速插入
      </div>

      <!-- 上下分栏分隔条：拖动调节模板区高度（热区加大，命中由 document 捕获代理接管；
           hover 指示位于顶部边框线上；容器高度收紧消除 tab 行上方空白） -->
      <div
        class="relative h-2 shrink-0 cursor-row-resize touch-none select-none border-t border-border"
        :data-resize-height="true"
        title="拖动调节模板区高度"
      >
        <div
          class="absolute inset-x-0 top-0 h-1.5 -translate-y-1/2 rounded bg-transparent hover:bg-primary/25"
        />
      </div>

      <!-- 下半部：模板区（文本模板 / 排序模板 / 替换规则，标签切换；支持拖入保存为文本模板） -->
      <div
        ref="templateZoneRef"
        data-testid="template-drop-zone"
        :class="
          cn('min-w-0 shrink-0 transition-colors', dragOver === 'templates' && 'bg-accent/60')
        "
        :style="{ height: `${templateHeight}px` }"
        @dragover="(e: DragEvent) => handleDragOver(e, 'templates')"
        @dragleave="handleDragLeave"
        @drop="(e: DragEvent) => handleDrop(e, 'templates')"
      >
        <div class="flex h-full flex-col">
          <div class="flex flex-nowrap items-center gap-1.5 overflow-hidden px-3 py-2">
            <div class="flex shrink-0 items-center gap-0.5 rounded-md bg-muted p-0.5">
              <button
                type="button"
                @click="tplTab = 'text'"
                :class="
                  cn(
                    'whitespace-nowrap rounded px-2 py-0.5 text-[11px] transition-colors',
                    tplTab === 'text'
                      ? 'bg-background font-medium shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )
                "
              >
                文本模板
              </button>
              <button
                type="button"
                @click="tplTab = 'sort'"
                :class="
                  cn(
                    'whitespace-nowrap rounded px-2 py-0.5 text-[11px] transition-colors',
                    tplTab === 'sort'
                      ? 'bg-background font-medium shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )
                "
              >
                排序模板
              </button>
              <button
                type="button"
                @click="tplTab = 'rules'"
                :class="
                  cn(
                    'whitespace-nowrap rounded px-2 py-0.5 text-[11px] transition-colors',
                    tplTab === 'rules'
                      ? 'bg-background font-medium shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )
                "
              >
                替换规则
              </button>
            </div>
            <div class="flex-1" />
            <Button
              variant="ghost"
              size="icon-sm"
              :title="
                tplTab === 'text'
                  ? '管理文本模板'
                  : tplTab === 'sort'
                    ? '管理排序模板'
                    : '管理替换规则'
              "
              @click="
                () => {
                  if (tplTab === 'text') {
                    editTextTemplateId = null;
                    textTemplatesOpen = true;
                  } else if (tplTab === 'sort') {
                    editSortTemplateId = null;
                    templatesOpen = true;
                  } else {
                    editRuleId = null;
                    rulesOpen = true;
                  }
                }
              "
            >
              <Settings />
            </Button>
          </div>

          <div class="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-3">
            <!-- 文本模板 -->
            <template v-if="tplTab === 'text'">
              <p
                v-if="textTemplatesStore.templates.length === 0"
                class="rounded-md border border-dashed border-border p-3 text-center text-[11px] text-muted-foreground"
              >
                暂无文本模板<br />点击右上角管理按钮创建<br />（一段可复用文本，可拖入编辑器）
              </p>
              <div
                v-for="group in [
                  ...new Set(textTemplatesStore.templates.map((t) => t.group ?? '未分组')),
                ]"
                :key="group"
              >
                <p class="mb-1 text-[10px] font-medium text-muted-foreground">{{ group }}</p>
                <div class="space-y-1.5">
                  <div
                    v-for="t in textTemplatesStore.templates.filter(
                      (x) => (x.group ?? '未分组') === group,
                    )"
                    :key="t.id"
                    title="拖拽到编辑器可快速插入，双击可编辑"
                    @dblclick="editTextTemplate(t.id)"
                    @pointerdown="
                      (e: PointerEvent) => startCardDrag(e, { kind: 'text-template', text: t.text })
                    "
                    class="cursor-grab select-none rounded-md border border-border bg-background p-2 active:cursor-grabbing"
                  >
                    <div class="flex items-center gap-1.5 text-xs">
                      <span class="min-w-0 flex-1 truncate font-medium" :title="t.name">
                        {{ t.name }}
                      </span>
                      <span class="shrink-0 text-[10px] text-muted-foreground">
                        {{ t.text.length }} 字符
                      </span>
                      <button
                        type="button"
                        title="插入到编辑器"
                        @click="insertTextTemplate(t)"
                        class="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      >
                        <FileText class="size-3" />
                      </button>
                      <button
                        type="button"
                        title="编辑模板"
                        @click="editTextTemplate(t.id)"
                        class="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      >
                        <Pencil class="size-3" />
                      </button>
                      <button
                        type="button"
                        title="删除模板"
                        @click="pendingDelete = { kind: 'text-template', id: t.id, name: t.name }"
                        class="shrink-0 rounded p-0.5 text-destructive hover:bg-accent"
                      >
                        <Trash class="size-3" />
                      </button>
                    </div>
                    <p
                      class="mt-0.5 line-clamp-2 whitespace-pre-wrap break-all text-[10px] text-muted-foreground"
                    >
                      {{ t.text.length > 60 ? `${t.text.slice(0, 60)}…` : t.text }}
                    </p>
                  </div>
                </div>
              </div>
            </template>

            <!-- 排序模板 -->
            <template v-else-if="tplTab === 'sort'">
              <p
                v-if="templatesStore.templates.length === 0"
                class="rounded-md border border-dashed border-border p-3 text-center text-[11px] text-muted-foreground"
              >
                暂无排序模板<br />点击右上角管理按钮创建<br />（提供顺序列表，用于自定义排序）
              </p>
              <div
                v-for="group in [
                  ...new Set(templatesStore.templates.map((t) => t.group ?? '未分组')),
                ]"
                :key="group"
              >
                <p class="mb-1 text-[10px] font-medium text-muted-foreground">{{ group }}</p>
                <div class="space-y-1.5">
                  <div
                    v-for="t in templatesStore.templates.filter(
                      (x) => (x.group ?? '未分组') === group,
                    )"
                    :key="t.id"
                    title="拖拽到编辑器可快速插入，双击可编辑"
                    @dblclick="editSortTemplate(t.id)"
                    @pointerdown="
                      (e: PointerEvent) =>
                        startCardDrag(e, { kind: 'sort-template', text: t.items.join('\n') })
                    "
                    class="cursor-grab select-none rounded-md border border-border bg-background p-2 active:cursor-grabbing"
                  >
                    <div class="flex items-center gap-1.5 text-xs">
                      <span class="min-w-0 flex-1 truncate font-medium" :title="t.name">
                        {{ t.name }}
                      </span>
                      <span v-if="t.prefixMatch" class="shrink-0 text-[10px] text-muted-foreground">
                        开头匹配
                      </span>
                      <span class="shrink-0 text-[10px] text-muted-foreground">
                        {{ t.items.length }} 条
                      </span>
                      <button
                        type="button"
                        title="按此模板排序编辑器文本"
                        @click="applyTemplate(t)"
                        class="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      >
                        <ListNumbers class="size-3" />
                      </button>
                      <button
                        type="button"
                        title="编辑模板"
                        @click="editSortTemplate(t.id)"
                        class="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      >
                        <Pencil class="size-3" />
                      </button>
                      <button
                        type="button"
                        title="删除模板"
                        @click="pendingDelete = { kind: 'sort-template', id: t.id, name: t.name }"
                        class="shrink-0 rounded p-0.5 text-destructive hover:bg-accent"
                      >
                        <Trash class="size-3" />
                      </button>
                    </div>
                    <p class="mt-0.5 truncate text-[10px] text-muted-foreground">
                      {{ t.items.slice(0, 3).join("、") }}{{ t.items.length > 3 ? "…" : "" }}
                    </p>
                  </div>
                </div>
              </div>
            </template>

            <!-- 替换规则 -->
            <template v-else>
              <p
                v-if="rulesStore.rules.length === 0"
                class="rounded-md border border-dashed border-border p-3 text-center text-[11px] text-muted-foreground"
              >
                暂无替换规则<br />点击右上角管理按钮创建<br />（查找替换时可一键应用）
              </p>
              <div
                v-for="r in rulesStore.rules"
                :key="r.id"
                title="双击编辑，拖到编辑器按此规则替换"
                @dblclick="handleRuleDoubleClick(r)"
                @pointerdown="
                  (e: PointerEvent) =>
                    startCardDrag(e, {
                      kind: 'rule',
                      text: `${r.name}：${r.find} → ${r.replace}`,
                      ruleId: r.id,
                    })
                "
                class="cursor-grab select-none rounded-md border border-border bg-background p-2 transition-colors hover:bg-accent/60 active:cursor-grabbing"
              >
                <div class="flex items-center gap-1.5 text-xs">
                  <span class="min-w-0 flex-1 truncate font-medium" :title="r.name">{{
                    r.name
                  }}</span>
                  <span v-if="r.isRegex" class="shrink-0 text-[10px] text-muted-foreground"
                    >正则</span
                  >
                  <button
                    type="button"
                    title="编辑规则"
                    @click.stop="editRule(r.id)"
                    class="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  >
                    <Pencil class="size-3" />
                  </button>
                  <button
                    type="button"
                    title="删除规则"
                    @click.stop="pendingDelete = { kind: 'rule', id: r.id, name: r.name }"
                    class="shrink-0 rounded p-0.5 text-destructive hover:bg-accent"
                  >
                    <Trash class="size-3" />
                  </button>
                </div>
                <p
                  class="mt-0.5 truncate font-mono text-[10px] text-muted-foreground"
                  :title="`${r.find} → ${r.replace}`"
                >
                  {{ r.find }} → {{ r.replace }}
                </p>
              </div>
            </template>
          </div>
        </div>
      </div>

      <TemplatesDialog
        :key="editSortTemplateId ?? 'manage-sort'"
        :open="templatesOpen"
        :edit-id="editSortTemplateId"
        @update:open="(v: boolean) => (templatesOpen = v)"
      />
      <TextTemplatesDialog
        :key="editTextTemplateId ?? 'manage-text'"
        :open="textTemplatesOpen"
        :edit-id="editTextTemplateId"
        @update:open="(v: boolean) => (textTemplatesOpen = v)"
      />
      <RulesDialog
        :key="editRuleId ?? 'manage-rule'"
        :open="rulesOpen"
        :edit-id="editRuleId"
        @update:open="(v: boolean) => (rulesOpen = v)"
      />

      <ConfirmDialog
        :open="confirmClear"
        title="清空暂存区"
        :description="`确定清空暂存区中的 ${stagingStore.items.length} 条文本吗？`"
        confirm-text="清空"
        destructive
        @confirm="
          () => {
            stagingStore.clear();
            confirmClear = false;
            toast('暂存区已清空');
          }
        "
        @cancel="confirmClear = false"
      />
      <ConfirmDialog
        :open="pendingDelete !== null"
        title="删除确认"
        :description="
          pendingDelete
            ? (
                {
                  staging: `确定删除暂存区条目「${pendingDelete.name}」吗？`,
                  'text-template': `确定删除文本模板「${pendingDelete.name}」吗？`,
                  'sort-template': `确定删除排序模板「${pendingDelete.name}」吗？`,
                  rule: `确定删除替换规则「${pendingDelete.name}」吗？`,
                } as const
              )[pendingDelete.kind]
            : undefined
        "
        confirm-text="删除"
        destructive
        @confirm="
          () => {
            if (!pendingDelete) return;
            switch (pendingDelete.kind) {
              case 'staging':
                stagingStore.remove(pendingDelete.id);
                break;
              case 'text-template':
                textTemplatesStore.removeTemplate(pendingDelete.id);
                break;
              case 'sort-template':
                templatesStore.removeTemplate(pendingDelete.id);
                break;
              case 'rule':
                rulesStore.removeRule(pendingDelete.id);
                break;
            }
            toast('已删除');
            pendingDelete = null;
          }
        "
        @cancel="pendingDelete = null"
      />

      <!-- 面板右缘宽度手柄：面板根内 absolute 层（静时透明，hover 提示；命中由 document 捕获代理接管） -->
      <div
        v-if="uiStore.stagingOpen"
        class="absolute inset-y-0 -right-2 z-10 w-4 cursor-ew-resize touch-none select-none bg-transparent hover:bg-primary/25"
        :data-resize-width="true"
        title="拖动调节面板宽度"
      />
    </div>
  </div>
</template>
