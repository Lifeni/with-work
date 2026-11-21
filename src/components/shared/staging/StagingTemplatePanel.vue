<script setup lang="ts">
import { nextTick, ref } from "vue";
import { FileText, ListNumbers, Pencil, Replace, Settings, Trash } from "@vicons/tabler";
import Button from "@/components/ui/button.vue";
import ConfirmDialog from "@/components/shared/ConfirmDialog.vue";
import RulesDialog from "@/components/shared/RulesDialog.vue";
import TemplatesDialog from "@/components/shared/TemplatesDialog.vue";
import TextTemplatesDialog from "@/components/shared/TextTemplatesDialog.vue";
import TooltipIconButton from "@/components/ui/tooltip-icon-button.vue";
import { useCardDrag } from "@/hooks/useCardDrag";
import { getToolInput } from "@/lib/applyTool";
import { getActiveEditor } from "@/lib/editorBridge";
import { hasDragType } from "@/lib/drag";
import { applyReplacements } from "@/lib/replace";
import { sortByReference } from "@/lib/sort";
import { splitLines } from "@/lib/split";
import { cn, uid } from "@/lib/utils";
import { useRulesStore } from "@/stores/rules";
import { useTemplatesStore } from "@/stores/templates";
import { useTextTemplatesStore } from "@/stores/textTemplates";
import { useToastStore } from "@/stores/toast";
import { useWorkspaceStore } from "@/stores/workspace";
import type { ReplaceRule, SortTemplate, TextTemplate } from "@/types";

type PendingDelete = { kind: "text-template" | "sort-template" | "rule"; id: string; name: string };

const TEMPLATE_TABS = [
  { value: "text", label: "文本模板" },
  { value: "sort", label: "排序模板" },
  { value: "rules", label: "替换规则" },
] as const;

const rulesStore = useRulesStore();
const templatesStore = useTemplatesStore();
const textTemplatesStore = useTextTemplatesStore();
const toast = useToastStore().push;
const { startCardDrag } = useCardDrag();
const tplTab = ref<"text" | "sort" | "rules">("text");
const dragOver = ref(false);
const templatesOpen = ref(false);
const textTemplatesOpen = ref(false);
const rulesOpen = ref(false);
const editTextTemplateId = ref<string | null>(null);
const editSortTemplateId = ref<string | null>(null);
const editRuleId = ref<string | null>(null);
const pendingDelete = ref<PendingDelete | null>(null);

function handleTemplateTabKeydown(event: KeyboardEvent, index: number) {
  const tabs = Array.from(
    (event.currentTarget as HTMLElement).parentElement?.querySelectorAll<HTMLElement>(
      '[role="tab"]',
    ) ?? [],
  );
  if (tabs.length === 0) return;
  let nextIndex: number | null = null;
  if (event.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
  else if (event.key === "ArrowLeft") nextIndex = (index - 1 + tabs.length) % tabs.length;
  else if (event.key === "Home") nextIndex = 0;
  else if (event.key === "End") nextIndex = tabs.length - 1;
  if (nextIndex === null) return;
  event.preventDefault();
  const nextTab = tabs[nextIndex];
  const nextValue = TEMPLATE_TABS[nextIndex]?.value;
  if (!nextTab || !nextValue) return;
  tplTab.value = nextValue;
  void nextTick(() => nextTab.focus());
}

function applyTemplate(template: SortTemplate) {
  const input = getToolInput();
  if (!input.trim()) {
    toast("编辑器没有可排序的内容");
    return;
  }
  const lines = splitLines(input);
  const result = sortByReference(lines, template.items);
  const text = [...result.sorted, ...result.unmatched].join("\n");
  const editor = getActiveEditor();
  const model = editor?.getModel();
  const selection = editor?.getSelection();
  if (editor && model && selection && !selection.isEmpty()) {
    editor.executeEdits("ww-template", [{ range: selection, text }]);
  } else if (editor && model) {
    editor.executeEdits("ww-template", [{ range: model.getFullModelRange(), text }]);
  } else {
    const workspaceStore = useWorkspaceStore();
    if (workspaceStore.activeId) workspaceStore.setLeft(workspaceStore.activeId, text);
  }
  toast(
    `已按模板「${template.name}」排序` +
      (result.unmatched.length > 0 ? `，${result.unmatched.length} 项未匹配已保留在末尾` : ""),
  );
}

function applyRuleToEditor(rule: ReplaceRule) {
  const editor = getActiveEditor();
  const model = editor?.getModel();
  if (editor && model) {
    const selection = editor.getSelection();
    const range = selection && !selection.isEmpty() ? selection : model.getFullModelRange();
    const source = model.getValueInRange(range);
    const result = applyReplacements(source, rule.find, rule.replace, rule.isRegex, rule.matchCase);
    editor.executeEdits("ww-rule", [{ range, text: result }]);
    editor.focus();
    toast(`已按规则「${rule.name}」替换`);
    return;
  }

  const workspaceStore = useWorkspaceStore();
  const active = workspaceStore.workspaces.find((item) => item.id === workspaceStore.activeId);
  if (!active) {
    toast("没有可应用规则的工作区");
    return;
  }
  workspaceStore.setLeft(
    active.id,
    applyReplacements(active.left ?? "", rule.find, rule.replace, rule.isRegex, rule.matchCase),
  );
  toast(`已按规则「${rule.name}」替换`);
}

function insertTextTemplate(template: TextTemplate) {
  const editor = getActiveEditor();
  const model = editor?.getModel();
  const selection = editor?.getSelection();
  if (editor && model) {
    const cursor = editor.getPosition() ?? { lineNumber: 1, column: 1 };
    const range = selection ?? {
      startLineNumber: cursor.lineNumber,
      startColumn: cursor.column,
      endLineNumber: cursor.lineNumber,
      endColumn: cursor.column,
    };
    editor.executeEdits("ww-text-template", [{ range, text: template.text }]);
    editor.focus();
  } else {
    const workspaceStore = useWorkspaceStore();
    const active = workspaceStore.workspaces.find((item) => item.id === workspaceStore.activeId);
    if (!active) {
      toast("没有可插入模板的工作区");
      return;
    }
    const separator = active.left && !active.left.endsWith("\n") ? "\n" : "";
    workspaceStore.setLeft(active.id, `${active.left ?? ""}${separator}${template.text}`);
  }
  toast(`已插入模板「${template.name}」`);
}

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

function handleDragOver(event: DragEvent) {
  if (!hasDragType(event.dataTransfer?.types, "text/plain")) return;
  event.preventDefault();
  event.dataTransfer!.dropEffect = "copy";
  dragOver.value = true;
}

function handleDrop(event: DragEvent) {
  event.preventDefault();
  dragOver.value = false;
  const transfer = event.dataTransfer;
  if (!transfer) return;
  if (transfer.getData("application/x-with-work-source") === "templates") return;
  const text = transfer.getData("text/plain");
  if (!text.trim()) return;
  const name = text.length > 12 ? `${text.slice(0, 12)}…` : text;
  textTemplatesStore.addTemplate({ id: uid(), name, text, group: undefined });
  toast(`已保存为文本模板「${name}」`);
}
</script>

<template>
  <div
    data-testid="template-drop-zone"
    :class="cn('min-w-0 shrink-0 transition-colors overflow-hidden', dragOver && 'bg-accent/60')"
    @dragover="handleDragOver"
    @dragleave="dragOver = false"
    @drop="handleDrop"
  >
    <div class="flex h-full flex-col">
      <div class="flex flex-nowrap items-center gap-1.5 overflow-hidden px-3 py-2">
        <div
          role="tablist"
          aria-label="模板类型"
          class="flex shrink-0 items-center gap-0.5 rounded-md bg-muted p-0.5"
        >
          <button
            v-for="(tab, index) in TEMPLATE_TABS"
            :id="`ww-staging-tab-${tab.value}`"
            :key="tab.value"
            type="button"
            role="tab"
            :aria-selected="tplTab === tab.value"
            aria-controls="ww-staging-template-panel"
            :tabindex="tplTab === tab.value ? 0 : -1"
            @click="tplTab = tab.value"
            @keydown="handleTemplateTabKeydown($event, index)"
            :class="
              cn(
                'min-h-6 whitespace-nowrap rounded px-2 py-1 text-xs transition-colors',
                tplTab === tab.value
                  ? 'bg-background font-medium shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )
            "
          >
            {{ tab.label }}
          </button>
        </div>
        <div class="flex-1" />
        <Button
          variant="ghost"
          size="icon-sm"
          :title="
            tplTab === 'text' ? '管理文本模板' : tplTab === 'sort' ? '管理排序模板' : '管理替换规则'
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

      <div
        id="ww-staging-template-panel"
        role="tabpanel"
        :aria-labelledby="`ww-staging-tab-${tplTab}`"
        class="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-3"
      >
        <template v-if="tplTab === 'text'">
          <p
            v-if="textTemplatesStore.templates.length === 0"
            class="rounded-md border border-dashed border-border p-3 text-center text-[11px] text-muted-foreground"
          >
            暂无文本模板<br />点击右上角管理按钮创建<br />（一段可复用文本，可拖入编辑器）
          </p>
          <div
            v-for="group in [
              ...new Set(
                textTemplatesStore.templates.map((template) => template.group ?? '未分组'),
              ),
            ]"
            :key="group"
          >
            <p class="mb-1 text-[10px] font-medium text-muted-foreground">{{ group }}</p>
            <div class="space-y-1.5">
              <div
                v-for="template in textTemplatesStore.templates.filter(
                  (candidate) => (candidate.group ?? '未分组') === group,
                )"
                :key="template.id"
                title="拖拽到编辑器可快速插入，双击可编辑"
                @dblclick="editTextTemplate(template.id)"
                @pointerdown="
                  (event: PointerEvent) =>
                    startCardDrag(event, { kind: 'text-template', text: template.text })
                "
                class="cursor-grab select-none rounded-md border border-border bg-background p-2 active:cursor-grabbing"
              >
                <div class="flex items-center gap-1.5 text-xs">
                  <span class="min-w-0 flex-1 truncate font-medium" :title="template.name">
                    {{ template.name }}
                  </span>
                  <span class="shrink-0 text-[10px] text-muted-foreground">
                    {{ template.text.length }} 字符
                  </span>
                  <TooltipIconButton
                    title="插入到编辑器"
                    @click="insertTextTemplate(template)"
                    class="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  >
                    <FileText class="size-3" />
                  </TooltipIconButton>
                  <TooltipIconButton
                    title="编辑模板"
                    @click="editTextTemplate(template.id)"
                    class="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  >
                    <Pencil class="size-3" />
                  </TooltipIconButton>
                  <TooltipIconButton
                    title="删除模板"
                    @click="
                      pendingDelete = {
                        kind: 'text-template',
                        id: template.id,
                        name: template.name,
                      }
                    "
                    class="shrink-0 rounded p-0.5 text-destructive hover:bg-accent"
                  >
                    <Trash class="size-3" />
                  </TooltipIconButton>
                </div>
                <p
                  class="mt-0.5 line-clamp-2 whitespace-pre-wrap break-all text-[10px] text-muted-foreground"
                >
                  {{ template.text.length > 60 ? `${template.text.slice(0, 60)}…` : template.text }}
                </p>
              </div>
            </div>
          </div>
        </template>

        <template v-else-if="tplTab === 'sort'">
          <p
            v-if="templatesStore.templates.length === 0"
            class="rounded-md border border-dashed border-border p-3 text-center text-[11px] text-muted-foreground"
          >
            暂无排序模板<br />点击右上角管理按钮创建<br />（提供顺序列表，用于自定义排序）
          </p>
          <div
            v-for="group in [
              ...new Set(templatesStore.templates.map((template) => template.group ?? '未分组')),
            ]"
            :key="group"
          >
            <p class="mb-1 text-[10px] font-medium text-muted-foreground">{{ group }}</p>
            <div class="space-y-1.5">
              <div
                v-for="template in templatesStore.templates.filter(
                  (candidate) => (candidate.group ?? '未分组') === group,
                )"
                :key="template.id"
                title="拖拽到编辑器可快速插入，双击可编辑"
                @dblclick="editSortTemplate(template.id)"
                @pointerdown="
                  (event: PointerEvent) =>
                    startCardDrag(event, {
                      kind: 'sort-template',
                      text: template.items.join('\n'),
                    })
                "
                class="cursor-grab select-none rounded-md border border-border bg-background p-2 active:cursor-grabbing"
              >
                <div class="flex items-center gap-1.5 text-xs">
                  <span class="min-w-0 flex-1 truncate font-medium" :title="template.name">
                    {{ template.name }}
                  </span>
                  <span
                    v-if="template.prefixMatch"
                    class="shrink-0 text-[10px] text-muted-foreground"
                  >
                    开头匹配
                  </span>
                  <span class="shrink-0 text-[10px] text-muted-foreground">
                    {{ template.items.length }} 条
                  </span>
                  <TooltipIconButton
                    title="按此模板排序编辑器文本"
                    @click="applyTemplate(template)"
                    class="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  >
                    <ListNumbers class="size-3" />
                  </TooltipIconButton>
                  <TooltipIconButton
                    title="编辑模板"
                    @click="editSortTemplate(template.id)"
                    class="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  >
                    <Pencil class="size-3" />
                  </TooltipIconButton>
                  <TooltipIconButton
                    title="删除模板"
                    @click="
                      pendingDelete = {
                        kind: 'sort-template',
                        id: template.id,
                        name: template.name,
                      }
                    "
                    class="shrink-0 rounded p-0.5 text-destructive hover:bg-accent"
                  >
                    <Trash class="size-3" />
                  </TooltipIconButton>
                </div>
                <p class="mt-0.5 truncate text-[10px] text-muted-foreground">
                  {{ template.items.slice(0, 3).join("、")
                  }}{{ template.items.length > 3 ? "…" : "" }}
                </p>
              </div>
            </div>
          </div>
        </template>

        <template v-else>
          <p
            v-if="rulesStore.rules.length === 0"
            class="rounded-md border border-dashed border-border p-3 text-center text-[11px] text-muted-foreground"
          >
            暂无替换规则<br />点击右上角管理按钮创建<br />（查找替换时可一键应用）
          </p>
          <div
            v-for="rule in rulesStore.rules"
            :key="rule.id"
            title="双击编辑，拖到编辑器按此规则替换"
            @dblclick="editRule(rule.id)"
            @pointerdown="
              (event: PointerEvent) =>
                startCardDrag(event, {
                  kind: 'rule',
                  text: `${rule.name}：${rule.find} → ${rule.replace}`,
                  ruleId: rule.id,
                })
            "
            class="cursor-grab select-none rounded-md border border-border bg-background p-2 transition-colors hover:bg-accent/60 active:cursor-grabbing"
          >
            <div class="flex items-center gap-1.5 text-xs">
              <span class="min-w-0 flex-1 truncate font-medium" :title="rule.name">
                {{ rule.name }}
              </span>
              <span v-if="rule.isRegex" class="shrink-0 text-[10px] text-muted-foreground">
                正则
              </span>
              <TooltipIconButton
                title="应用规则到编辑器"
                @click.stop="applyRuleToEditor(rule)"
                class="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              >
                <Replace class="size-3" />
              </TooltipIconButton>
              <TooltipIconButton
                title="编辑规则"
                @click.stop="editRule(rule.id)"
                class="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              >
                <Pencil class="size-3" />
              </TooltipIconButton>
              <TooltipIconButton
                title="删除规则"
                @click.stop="pendingDelete = { kind: 'rule', id: rule.id, name: rule.name }"
                class="shrink-0 rounded p-0.5 text-destructive hover:bg-accent"
              >
                <Trash class="size-3" />
              </TooltipIconButton>
            </div>
            <p
              class="mt-0.5 truncate font-mono text-[10px] text-muted-foreground"
              :title="`${rule.find} → ${rule.replace}`"
            >
              {{ rule.find }} → {{ rule.replace }}
            </p>
          </div>
        </template>
      </div>
    </div>

    <TemplatesDialog
      :key="editSortTemplateId ?? 'manage-sort'"
      :open="templatesOpen"
      :edit-id="editSortTemplateId"
      @update:open="(value: boolean) => (templatesOpen = value)"
    />
    <TextTemplatesDialog
      :key="editTextTemplateId ?? 'manage-text'"
      :open="textTemplatesOpen"
      :edit-id="editTextTemplateId"
      @update:open="(value: boolean) => (textTemplatesOpen = value)"
    />
    <RulesDialog
      :key="editRuleId ?? 'manage-rule'"
      :open="rulesOpen"
      :edit-id="editRuleId"
      @update:open="(value: boolean) => (rulesOpen = value)"
    />
    <ConfirmDialog
      :open="pendingDelete !== null"
      title="删除确认"
      :description="
        pendingDelete
          ? (
              {
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
          if (pendingDelete.kind === 'text-template') {
            textTemplatesStore.removeTemplate(pendingDelete.id);
          } else if (pendingDelete.kind === 'sort-template') {
            templatesStore.removeTemplate(pendingDelete.id);
          } else {
            rulesStore.removeRule(pendingDelete.id);
          }
          toast('已删除');
          pendingDelete = null;
        }
      "
      @cancel="pendingDelete = null"
    />
  </div>
</template>
