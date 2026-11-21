<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from "vue";
import {
  ArrowsLeftRight,
  ClipboardCheck,
  LayoutSidebarLeftCollapse,
  Plus,
  Trash,
} from "@vicons/tabler";
import Button from "@/components/ui/button.vue";
import ConfirmDialog from "@/components/shared/ConfirmDialog.vue";
import StagingEntries from "@/components/shared/staging/StagingEntries.vue";
import StagingTemplatePanel from "@/components/shared/staging/StagingTemplatePanel.vue";
import Textarea from "@/components/ui/textarea.vue";
import { cn } from "@/lib/utils";
import { MAX_STAGING_WIDTH, MIN_STAGING_WIDTH, MIN_TEMPLATE_HEIGHT } from "@/lib/settingsMigration";
import { useStagingStore } from "@/stores/staging";
import { useSettingsStore } from "@/stores/settings";
import { useToastStore } from "@/stores/toast";
import { useUiStore } from "@/stores/ui";

const stagingStore = useStagingStore();
const uiStore = useUiStore();
const settingsStore = useSettingsStore();
const toast = useToastStore().push;

const stagingWidth = ref(settingsStore.stagingWidth ?? 320);
const templateHeight = ref(settingsStore.stagingTemplateHeight ?? 240);
const panelRef = ref<HTMLDivElement | null>(null);
const outerRef = ref<HTMLDivElement | null>(null);
let resizing = false;

const draft = ref("");
const confirmClear = ref(false);

const NARROW_QUERY = "(max-width: 1023px)";
const narrowQuery = window.matchMedia(NARROW_QUERY);
const isNarrow = ref(narrowQuery.matches);

function closeStagingPanel() {
  uiStore.setStagingOpen(false);
  void nextTick(() => {
    document.querySelector<HTMLElement>('button[aria-controls="ww-staging-panel"]')?.focus();
  });
}

const onNarrowChange = (event: MediaQueryListEvent) => {
  isNarrow.value = event.matches;
  if (event.matches) uiStore.setStagingOpen(false);
};

const onGlobalKeydown = (event: KeyboardEvent) => {
  if (event.defaultPrevented || event.key !== "Escape" || !isNarrow.value || !uiStore.stagingOpen) {
    return;
  }
  const target = event.target as HTMLElement | null;
  if (target?.closest('[role="dialog"], [role="menu"], .n-popover')) return;
  event.preventDefault();
  closeStagingPanel();
};

const RESIZE_WIDTH_MARK = "data-resize-width";
const RESIZE_HEIGHT_MARK = "data-resize-height";

function onDocResizeDown(event: Event) {
  const target = event.target as HTMLElement | null;
  if (!target?.closest) return;
  if (target.closest(`[${RESIZE_WIDTH_MARK}]`)) startResize(event as MouseEvent);
  else if (target.closest(`[${RESIZE_HEIGHT_MARK}]`)) startTemplateResize(event as MouseEvent);
}

onMounted(() => {
  document.addEventListener("pointerdown", onDocResizeDown, { capture: true });
  document.addEventListener("mousedown", onDocResizeDown, { capture: true });
  document.addEventListener("keydown", onGlobalKeydown);
  if (narrowQuery.matches) uiStore.setStagingOpen(false);
  narrowQuery.addEventListener("change", onNarrowChange);
});

onUnmounted(() => {
  document.removeEventListener("pointerdown", onDocResizeDown, { capture: true });
  document.removeEventListener("mousedown", onDocResizeDown, { capture: true });
  document.removeEventListener("keydown", onGlobalKeydown);
  narrowQuery.removeEventListener("change", onNarrowChange);
});

function applyStagingWidth(width: number) {
  const next = Math.min(MAX_STAGING_WIDTH, Math.max(MIN_STAGING_WIDTH, Math.round(width)));
  stagingWidth.value = next;
  settingsStore.setStagingWidth(next);
  if (outerRef.value) {
    outerRef.value.style.width = `${next}px`;
    outerRef.value.style.minWidth = `${next}px`;
    outerRef.value.style.maxWidth = `${next}px`;
    outerRef.value.style.flexBasis = `${next}px`;
  }
}

function handleStagingWidthKeydown(event: KeyboardEvent) {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  event.preventDefault();
  const step = event.shiftKey ? 64 : 16;
  applyStagingWidth(stagingWidth.value + (event.key === "ArrowRight" ? step : -step));
}

function startResize(event: MouseEvent) {
  if (resizing) return;
  resizing = true;
  event.preventDefault();
  const startX = event.clientX;
  const startWidth = stagingWidth.value;
  const onMove = (moveEvent: MouseEvent) => {
    applyStagingWidth(startWidth + (moveEvent.clientX - startX));
  };
  const finish = () => {
    resizing = false;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", finish);
    window.removeEventListener("pointercancel", finish);
    window.removeEventListener("blur", finish);
    document.body.style.userSelect = "";
  };
  document.body.style.userSelect = "none";
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", finish);
  window.addEventListener("pointercancel", finish);
  window.addEventListener("blur", finish);
}

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

function applyTemplateHeight(height: number) {
  const max = panelRef.value?.getBoundingClientRect().height;
  const upper = Math.max(MIN_TEMPLATE_HEIGHT, max ? max * 0.7 : 640);
  const next = Math.min(upper, Math.max(MIN_TEMPLATE_HEIGHT, Math.round(height)));
  templateHeight.value = next;
  settingsStore.setStagingTemplateHeight(next);
}

function handleTemplateHeightKeydown(event: KeyboardEvent) {
  if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
  event.preventDefault();
  const step = event.shiftKey ? 64 : 16;
  applyTemplateHeight(templateHeight.value + (event.key === "ArrowUp" ? step : -step));
}

function startTemplateResize(event: MouseEvent) {
  if (resizing) return;
  resizing = true;
  event.preventDefault();
  const startY = event.clientY;
  const startHeight = templateHeight.value;
  const onMove = (moveEvent: MouseEvent) => {
    applyTemplateHeight(startHeight + (startY - moveEvent.clientY));
  };
  const finish = () => {
    resizing = false;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", finish);
    window.removeEventListener("pointercancel", finish);
    window.removeEventListener("blur", finish);
    document.body.style.userSelect = "";
  };
  document.body.style.userSelect = "none";
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", finish);
  window.addEventListener("pointercancel", finish);
  window.addEventListener("blur", finish);
}
</script>

<template>
  <div
    id="ww-staging-panel"
    ref="outerRef"
    role="complementary"
    aria-label="全局暂存区"
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
        <Button
          variant="ghost"
          size="icon-sm"
          title="折叠暂存区"
          class="lg:hidden!"
          @click="closeStagingPanel"
        >
          <LayoutSidebarLeftCollapse />
        </Button>
        <span class="flex items-center gap-1.5 text-xs font-medium">全局暂存区</span>
        <div class="flex-1" />
        <Button variant="ghost" size="icon-sm" title="清空暂存区" @click="confirmClear = true">
          <Trash />
        </Button>
      </div>

      <div class="space-y-1.5 border-b border-border p-3">
        <Textarea
          v-model="draft"
          :rows="2"
          aria-label="暂存区输入"
          placeholder="粘贴或输入文本，暂存后供各工具取用…"
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
            <ClipboardCheck class="size-3.5" />
            从剪贴板粘贴
          </Button>
        </div>
      </div>

      <StagingEntries />

      <div
        class="flex items-center gap-1 border-t border-border px-3 py-1.5 text-[10px] text-muted-foreground"
      >
        <ArrowsLeftRight class="size-3" />
        暂存区为全局共用，所有工作区共享；拖拽条目到编辑器可快速插入
      </div>

      <div
        role="separator"
        tabindex="0"
        aria-orientation="horizontal"
        aria-label="调节模板区高度"
        :aria-valuemin="MIN_TEMPLATE_HEIGHT"
        :aria-valuemax="
          Math.max(
            MIN_TEMPLATE_HEIGHT,
            Math.round((panelRef?.getBoundingClientRect().height || 640) * 0.7),
          )
        "
        :aria-valuenow="Math.round(templateHeight)"
        @keydown="handleTemplateHeightKeydown"
        class="relative h-2 shrink-0 cursor-row-resize touch-none select-none border-t border-border"
        data-resize-height
        title="拖动调节模板区高度"
      >
        <div
          class="absolute inset-x-0 top-0 h-1.5 -translate-y-1/2 rounded bg-transparent hover:bg-primary/25"
        />
      </div>

      <StagingTemplatePanel :style="{ height: `${templateHeight}px` }" />

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

      <div
        v-if="uiStore.stagingOpen"
        role="separator"
        tabindex="0"
        aria-orientation="vertical"
        aria-label="调节暂存区宽度"
        :aria-valuemin="MIN_STAGING_WIDTH"
        :aria-valuemax="MAX_STAGING_WIDTH"
        :aria-valuenow="Math.round(stagingWidth)"
        @keydown="handleStagingWidthKeydown"
        class="absolute inset-y-0 -right-2 z-10 w-4 cursor-ew-resize touch-none select-none bg-transparent hover:bg-primary/25"
        data-resize-width
        title="拖动调节面板宽度"
      />
    </div>
  </div>
</template>
