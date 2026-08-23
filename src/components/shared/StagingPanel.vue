<script setup lang="ts">
import { onMounted, ref } from "vue";
import {
  ArrowRightLeft,
  ClipboardPaste,
  Copy,
  FileDiff,
  FileText,
  Inbox,
  ListOrdered,
  PanelRightOpen,
  Pencil,
  Plus,
  Settings2,
  Trash2,
  X,
} from "@lucide/vue";
import Badge from "@/components/ui/badge.vue";
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

// 窄屏（<lg）下暂存区默认收起，通过右下角悬浮按钮打开
onMounted(() => {
  if (window.matchMedia("(max-width: 1023px)").matches) uiStore.setStagingOpen(false);
});

/** 拖动调节面板宽度（增量式，按下时记录起点避免突跳；记忆在设置中） */
function startResize(e: MouseEvent) {
  e.preventDefault();
  const startX = e.clientX;
  const startWidth = stagingWidth.value;
  const onMove = (ev: MouseEvent) => {
    const w = startWidth + (startX - ev.clientX);
    const next = Math.min(560, Math.max(240, w));
    stagingWidth.value = next;
    settingsStore.setStagingWidth(next);
  };
  const onUp = () => {
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
  };
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
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
    if (wsStore.activeId) wsStore.setContent(wsStore.activeId, text);
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
    if (wsStore.activeId) wsStore.setContent(wsStore.activeId, t.text);
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
function handleDragOver(e: DragEvent, zone: "staging" | "templates") {
  if (e.dataTransfer?.types.includes("text/plain")) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
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

/** 拖动调节模板区高度（记忆在设置中） */
function startTemplateResize(e: MouseEvent) {
  e.preventDefault();
  const onMove = (ev: MouseEvent) => {
    const rect = panelRef.value?.getBoundingClientRect();
    if (!rect) return;
    const h = rect.bottom - ev.clientY;
    const next = Math.min(rect.height * 0.7, Math.max(160, h));
    templateHeight.value = next;
    settingsStore.setStagingTemplateHeight(next);
  };
  const onUp = () => {
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
  };
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
}

/** 拖拽来源标记：拖出暂存区 / 模板区时写入，防止拖回时重复添加 */
function setDragSource(e: DragEvent, zone: string) {
  e.dataTransfer?.setData("application/x-with-work-source", zone);
  e.dataTransfer!.effectAllowed = "copy";
}
</script>

<template>
  <!-- 宽屏停靠式面板；窄屏改为右侧悬浮抽屉（默认收起，右下角按钮打开） -->
  <div
    :class="
      cn(
        'bg-card',
        uiStore.stagingOpen
          ? 'fixed inset-y-0 right-0 z-40 shadow-2xl lg:z-auto lg:shadow-none'
          : 'hidden lg:block',
        'lg:relative lg:shrink-0 lg:overflow-hidden lg:border-l lg:border-border',
      )
    "
    :style="{ width: uiStore.stagingOpen ? stagingWidth : 0 }"
  >
    <!-- 左边缘拖拽手柄（悬停高亮，贴边显示） -->
    <div
      class="absolute inset-y-0 left-0 z-10 w-2 cursor-ew-resize rounded hover:bg-primary/20"
      title="拖动调节面板宽度"
      @mousedown="startResize"
    />
    <div ref="panelRef" class="flex h-full flex-col" :style="{ width: stagingWidth }">
      <div class="flex h-9 items-center gap-2 border-b border-border px-3">
        <!-- 标题靠左：图标 + 文字 + 计数徽标 -->
        <span class="flex items-center gap-1.5 text-xs font-medium">
          <Inbox class="size-3.5" />
          全局暂存区
          <Badge variant="secondary">{{ stagingStore.items.length }}</Badge>
        </span>
        <div class="flex-1" />
        <Button variant="ghost" size="icon-sm" title="清空暂存区" @click="confirmClear = true">
          <Trash2 />
        </Button>
        <Button variant="ghost" size="icon-sm" title="收起" @click="uiStore.setStagingOpen(false)">
          <X />
        </Button>
      </div>

      <div class="space-y-1.5 border-b border-border p-3">
        <Textarea
          v-model="draft"
          rows="2"
          placeholder="粘贴或输入文本，暂存后供各工具取用…"
          class="min-h-12 text-xs"
        />
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
            <ClipboardPaste class="size-3.5" />
            从剪贴板粘贴
          </Button>
        </div>
      </div>

      <div
        data-testid="staging-drop-zone"
        :class="
          cn(
            'min-h-0 flex-1 space-y-2 overflow-y-auto p-3 transition-colors',
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
          <div
            v-for="item in stagingStore.items"
            :key="item.id"
            class="rounded-md border border-border bg-background p-2"
          >
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
                draggable
                title="拖拽到编辑器可快速插入，双击可编辑"
                @dblclick="startItemEdit(item.id)"
                @dragstart="
                  (e: DragEvent) => {
                    e.dataTransfer?.setData('text/plain', item.text);
                    setDragSource(e, 'staging');
                  }
                "
                class="cursor-grab rounded-md border border-border bg-background p-2 active:cursor-grabbing"
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
                    <Trash2 class="size-3" />
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
        <ArrowRightLeft class="size-3" />
        暂存区为全局共用，所有工作区共享；拖拽条目到编辑器可快速插入
      </div>

      <!-- 上下分栏分隔条：拖动调节模板区高度 -->
      <div class="relative shrink-0 border-t border-border">
        <div
          class="absolute -top-1.5 left-0 h-3 w-full cursor-row-resize rounded hover:bg-primary/20"
          title="拖动调节模板区高度"
          @mousedown="startTemplateResize"
        />
      </div>

      <!-- 下半部：模板区（文本模板 / 排序模板 / 替换规则，标签切换；支持拖入保存为文本模板） -->
      <div
        data-testid="template-drop-zone"
        :class="cn('shrink-0 transition-colors', dragOver === 'templates' && 'bg-accent/60')"
        :style="{ height: templateHeight }"
        @dragover="(e: DragEvent) => handleDragOver(e, 'templates')"
        @dragleave="handleDragLeave"
        @drop="(e: DragEvent) => handleDrop(e, 'templates')"
      >
        <div class="flex h-full flex-col">
          <div class="flex items-center gap-1.5 px-3 py-2">
            <div class="flex items-center gap-0.5 rounded-md bg-muted p-0.5">
              <button
                type="button"
                @click="tplTab = 'text'"
                :class="
                  cn(
                    'rounded px-2 py-0.5 text-[11px] transition-colors',
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
                    'rounded px-2 py-0.5 text-[11px] transition-colors',
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
                    'rounded px-2 py-0.5 text-[11px] transition-colors',
                    tplTab === 'rules'
                      ? 'bg-background font-medium shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )
                "
              >
                替换规则
              </button>
            </div>
            <Badge variant="secondary">
              {{
                tplTab === "text"
                  ? textTemplatesStore.templates.length
                  : tplTab === "sort"
                    ? templatesStore.templates.length
                    : rulesStore.rules.length
              }}
            </Badge>
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
              <Settings2 />
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
                    draggable
                    title="拖拽到编辑器可快速插入，双击可编辑"
                    @dblclick="editTextTemplate(t.id)"
                    @dragstart="
                      (e: DragEvent) => {
                        e.dataTransfer?.setData('text/plain', t.text);
                        setDragSource(e, 'templates');
                      }
                    "
                    class="cursor-grab rounded-md border border-border bg-background p-2 active:cursor-grabbing"
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
                        <Trash2 class="size-3" />
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
                    draggable
                    title="拖拽到编辑器可快速插入，双击可编辑"
                    @dblclick="editSortTemplate(t.id)"
                    @dragstart="
                      (e: DragEvent) => {
                        e.dataTransfer?.setData('text/plain', t.items.join('\n'));
                        setDragSource(e, 'templates');
                      }
                    "
                    class="cursor-grab rounded-md border border-border bg-background p-2 active:cursor-grabbing"
                  >
                    <div class="flex items-center gap-1.5 text-xs">
                      <span class="min-w-0 flex-1 truncate font-medium" :title="t.name">
                        {{ t.name }}
                      </span>
                      <Badge v-if="t.prefixMatch" variant="outline" class="shrink-0 text-[9px]">
                        开头匹配
                      </Badge>
                      <span class="shrink-0 text-[10px] text-muted-foreground">
                        {{ t.items.length }} 条
                      </span>
                      <button
                        type="button"
                        title="按此模板排序编辑器文本"
                        @click="applyTemplate(t)"
                        class="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      >
                        <ListOrdered class="size-3" />
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
                        <Trash2 class="size-3" />
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
                draggable
                title="双击编辑，拖到编辑器按此规则替换"
                @dblclick="handleRuleDoubleClick(r)"
                @dragstart="
                  (e: DragEvent) => {
                    e.dataTransfer?.setData('text/plain', `${r.name}：${r.find} → ${r.replace}`);
                    e.dataTransfer?.setData('application/x-with-work-rule', r.id);
                    e.dataTransfer!.effectAllowed = 'copy';
                    setDragSource(e, 'templates');
                  }
                "
                class="cursor-grab rounded-md border border-border bg-background p-2 transition-colors hover:bg-accent/60 active:cursor-grabbing"
              >
                <div class="flex items-center gap-1.5 text-xs">
                  <span class="min-w-0 flex-1 truncate font-medium" :title="r.name">{{
                    r.name
                  }}</span>
                  <Badge v-if="r.isRegex" variant="secondary" class="shrink-0 text-[9px]"
                    >正则</Badge
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
                    <Trash2 class="size-3" />
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
    </div>
  </div>

  <!-- 悬浮按钮：暂存区关闭时显示（宽窄屏统一），点击打开抽屉/面板 -->
  <button
    v-if="!uiStore.stagingOpen"
    type="button"
    @click="uiStore.setStagingOpen(true)"
    title="打开暂存区"
    class="fixed bottom-9 right-3 z-30 flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105"
  >
    <PanelRightOpen class="size-4" />
  </button>
</template>
