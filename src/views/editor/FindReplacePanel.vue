<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import * as monaco from "monaco-editor";
import {
  ArrowBigUpLine,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowsJoin,
  LetterCase,
  Highlight,
  ListNumbers,
  Braces,
  ChevronDown,
  Replace,
  Scissors,
  Settings,
} from "@vicons/tabler";
import { NDropdown, NSelect, type SelectNodeProps } from "naive-ui";
import Button from "@/components/ui/button.vue";
import Input from "@/components/ui/input.vue";
import Toggle from "@/components/ui/toggle.vue";
import RulesDialog from "@/components/shared/RulesDialog.vue";
import TemplatesDialog from "@/components/shared/TemplatesDialog.vue";
import ToolbarVisibilityMenu from "@/components/shared/ToolbarVisibilityMenu.vue";
import {
  dropdownMenuProps,
  dropdownNodeProps,
  focusFirstDropdownItem,
  restoreDropdownTriggerFocus,
} from "@/components/ui/dropdown";
import { setRuleApplyListener } from "@/lib/editorBridge";
import { joinText } from "@/lib/join";
import { computeReplacement } from "@/lib/replace";
import { sortAlphabetical, sortByReference } from "@/lib/sort";
import { splitLines, splitText, type SplitDelimiter } from "@/lib/split";
import { useDebounce } from "@/hooks/useDebounce";
import { useRulesStore } from "@/stores/rules";
import { useSettingsStore } from "@/stores/settings";
import { useTemplatesStore } from "@/stores/templates";
import { useToastStore } from "@/stores/toast";
import type { ToolbarVisibilityGroup } from "@/tools/toolbarVisibility";
import type { ReplaceRule } from "@/types";

interface MatchInfo {
  line: number;
  col: number;
  range: monaco.IRange;
  text: string;
  groups: string[];
}

interface Props {
  /** 当前聚焦的编辑器（查找、替换与列表工具的处理目标） */
  focusedEditor: monaco.editor.IStandaloneCodeEditor | null;
}
const props = defineProps<Props>();

const editor = computed(() => props.focusedEditor); // 查找/替换作用于当前聚焦的编辑器

const find = ref("");
const replace = ref("");
const isRegex = ref(false);
const matchCase = ref(false);
const highlightAll = ref(true);
const matches = ref<MatchInfo[]>([]);
const current = ref(0);
const findError = ref<string | null>(null);
const rulesOpen = ref(false);
const ruleDraft = ref<{
  find: string;
  replace: string;
  isRegex: boolean;
  matchCase: boolean;
} | null>(null);
const findInputRef = ref<HTMLInputElement | null>(null);
const decorationsRef = ref<monaco.editor.IEditorDecorationsCollection | null>(null);
const currentRef = ref(0);

const rulesStore = useRulesStore();
const templatesStore = useTemplatesStore();
const settingsStore = useSettingsStore();
const toast = useToastStore().push;
const delimiter = ref<SplitDelimiter>("auto");

const EDITOR_TOOLBAR_GROUPS: ToolbarVisibilityGroup[] = [
  {
    key: "find-replace",
    label: "查找与替换",
    items: [
      { id: "find-options", label: "查找模式", icon: Highlight },
      { id: "find-navigation", label: "上一个 / 下一个", icon: ArrowUp },
      { id: "replace-rules", label: "替换规则", icon: Replace },
      { id: "replace-actions", label: "执行替换", icon: ArrowRight },
      { id: "replace-manage", label: "管理替换规则", icon: Settings },
    ],
  },
  {
    key: "text-tools",
    label: "文本处理",
    items: [
      { id: "split-join", label: "分割与组合", icon: Scissors },
      { id: "sort-rules", label: "排序规则", icon: ListNumbers },
      { id: "sort-manage", label: "管理排序模板", icon: Settings },
    ],
  },
];

const DELIMITER_OPTIONS: Array<{
  value: SplitDelimiter;
  label: string;
  shortLabel: string;
}> = [
  { value: "auto", label: "自动检测", shortLabel: "自动" },
  { value: "newline", label: "换行", shortLabel: "换行" },
  { value: "comma", label: "英文逗号", shortLabel: "," },
  { value: "cn-comma", label: "中文逗号", shortLabel: "，" },
  { value: "semicolon", label: "英文分号", shortLabel: ";" },
  { value: "cn-semicolon", label: "中文分号", shortLabel: "；" },
  { value: "cn-dunhao", label: "顿号", shortLabel: "、" },
  { value: "space", label: "空格 / Tab", shortLabel: "空格" },
  { value: "custom", label: "自定义正则", shortLabel: "正则" },
];

const delimiterMenuOptions = DELIMITER_OPTIONS.map((option) => ({
  key: option.value,
  label: option.label,
}));
const delimiterOption = computed(() =>
  DELIMITER_OPTIONS.find((option) => option.value === delimiter.value)!,
);

const ruleSelectOptions = computed(() =>
  rulesStore.rules.map((rule) => ({ label: rule.name, value: rule.id })),
);
const templateSelectOptions = computed(() =>
  templatesStore.templates.map((template) => ({ label: template.name, value: template.id })),
);
const SELECT_MENU_PROPS = { class: "ww-select-menu" };
const RULE_SELECT_MENU_PROPS = {
  ...SELECT_MENU_PROPS,
  id: "ww-replace-rule-options",
  role: "listbox",
  "aria-label": "替换规则",
};
const TEMPLATE_SELECT_MENU_PROPS = {
  ...SELECT_MENU_PROPS,
  id: "ww-sort-template-options",
  role: "listbox",
  "aria-label": "排序规则",
};
const RULE_SELECT_INPUT_PROPS = {
  role: "combobox" as const,
  "aria-label": "替换规则",
  "aria-autocomplete": "list" as const,
  "aria-haspopup": "listbox" as const,
  "aria-controls": "ww-replace-rule-options",
};
const TEMPLATE_SELECT_INPUT_PROPS = {
  role: "combobox" as const,
  "aria-label": "排序规则",
  "aria-autocomplete": "list" as const,
  "aria-haspopup": "listbox" as const,
  "aria-controls": "ww-sort-template-options",
};
const ruleSelectOpen = ref(false);
const templateSelectOpen = ref(false);
const ruleSelectInputProps = computed(() => ({
  ...RULE_SELECT_INPUT_PROPS,
  "aria-expanded": ruleSelectOpen.value,
}));
const templateSelectInputProps = computed(() => ({
  ...TEMPLATE_SELECT_INPUT_PROPS,
  "aria-expanded": templateSelectOpen.value,
}));
const ruleNodeProps: SelectNodeProps = (option) => ({
  role: "option",
  "aria-selected":
    String((option as { value?: string | number }).value ?? "") === String(ruleSelect.value ?? "")
      ? "true"
      : "false",
});
const templateNodeProps: SelectNodeProps = (option) => ({
  role: "option",
  "aria-selected":
    String((option as { value?: string | number }).value ?? "") ===
    String(templateSelect.value ?? "")
      ? "true"
      : "false",
});

function editorToolbarVisible(id: string) {
  return !settingsStore.hiddenEditorToolbarItems.includes(id);
}

function updateHiddenEditorToolbarItems(ids: string[]) {
  settingsStore.setHiddenEditorToolbarItems(ids);
}

// 监听目标编辑器内容版本：内容变化时自动重跑搜索
const modelVersion = ref(0);
let contentSub: monaco.IDisposable | null = null;
let modelChangeSub: monaco.IDisposable | null = null;

/** 把内容订阅挂到编辑器当前的 Model 上（换绑 Model 时需要重新挂） */
function attachContentSub(ed: monaco.editor.IStandaloneCodeEditor) {
  contentSub?.dispose();
  contentSub = null;
  const model = ed.getModel();
  if (!model) return;
  contentSub = model.onDidChangeContent(() => {
    modelVersion.value++;
  });
}

/**
 * 换绑目标编辑器：先释放上一个编辑器的订阅，再订阅新 Model。
 * 不能把 onUnmounted 写进 watch 回调——那会在调度阶段找不到组件实例而注册失败，
 * 既泄漏订阅又漏掉「挂载即有编辑器」这一次订阅。
 * 编辑器实例是复用的：切换工作区走的是同一个实例的 setModel，此时 props 引用不变，
 * 必须靠 onDidChangeModel 把订阅迁到新 Model，否则搜索不会随新内容刷新。
 */
function subscribeFocusedModel(ed: monaco.editor.IStandaloneCodeEditor | null) {
  contentSub?.dispose();
  contentSub = null;
  modelChangeSub?.dispose();
  modelChangeSub = null;
  decorationsRef.value?.clear();
  decorationsRef.value = null;
  if (!ed) return;
  attachContentSub(ed);
  modelChangeSub =
    ed.onDidChangeModel?.(() => {
      attachContentSub(ed);
      // 换绑 Model 后旧的匹配坐标与装饰都指向上一个 Model，必须清掉并按新 Model 重搜
      decorationsRef.value?.clear();
      decorationsRef.value = null;
      matches.value = [];
      current.value = 0;
      modelVersion.value++;
    }) ?? null;
}

watch(() => props.focusedEditor, subscribeFocusedModel, { immediate: true });

const debouncedFind = useDebounce(find, 200);

watch(current, (v) => {
  currentRef.value = v;
});

function applyDecorations(infos: MatchInfo[], idx: number, highlight: boolean) {
  const ed = editor.value;
  if (!ed) return;
  const coll = decorationsRef.value ?? ed.createDecorationsCollection();
  decorationsRef.value = coll;
  const decs: monaco.editor.IModelDeltaDecoration[] = [];
  infos.forEach((m, i) => {
    if (!highlight && i !== idx) return;
    decs.push({
      range: m.range,
      options: {
        className: i === idx ? "ww-find-current" : "ww-find-match",
        stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
      },
    });
  });
  coll.set(decs);
}

// 搜索：输入防抖 + 编辑器内容变化时自动重跑
watch(
  [debouncedFind, isRegex, matchCase, highlightAll, () => props.focusedEditor, modelVersion],
  () => {
    const ed = editor.value;
    const model = ed?.getModel();
    if (!ed || !model || !debouncedFind.value) {
      decorationsRef.value?.clear();
      decorationsRef.value = null;
      matches.value = [];
      current.value = 0;
      findError.value = null;
      return;
    }
    if (isRegex.value) {
      try {
        // Monaco 的模型搜索在部分版本/替身中会把无效正则吞成空结果；先显式校验，
        // 确保用户能收到可操作的语法错误，而不是误以为“没有匹配项”。
        new RegExp(debouncedFind.value, matchCase.value ? "" : "i");
      } catch {
        decorationsRef.value?.clear();
        decorationsRef.value = null;
        findError.value = "正则表达式无效";
        matches.value = [];
        current.value = 0;
        return;
      }
    }
    let ms: monaco.editor.FindMatch[];
    try {
      ms = model.findMatches(
        debouncedFind.value,
        true,
        isRegex.value,
        matchCase.value,
        null,
        true,
        10000,
      );
    } catch {
      findError.value = "正则表达式无效";
      matches.value = [];
      current.value = 0;
      return;
    }
    findError.value = null;
    const infos: MatchInfo[] = ms.map((m) => ({
      line: m.range.startLineNumber,
      col: m.range.startColumn,
      range: m.range,
      text: m.matches?.[0] ?? "",
      groups: m.matches?.slice(1) ?? [],
    }));
    matches.value = infos;
    const idx = Math.min(currentRef.value, Math.max(infos.length - 1, 0));
    current.value = idx;
    applyDecorations(infos, idx, highlightAll.value);
  },
);

function navigate(idx: number) {
  if (idx < 0 || idx >= matches.value.length || !editor.value) return;
  current.value = idx;
  currentRef.value = idx;
  applyDecorations(matches.value, idx, highlightAll.value);
  editor.value.revealRangeInCenter(matches.value[idx].range);
  editor.value.setPosition({ lineNumber: matches.value[idx].line, column: matches.value[idx].col });
  editor.value.focus();
}

function replaceOne() {
  const ed = editor.value;
  if (!ed) return;
  const m = matches.value[currentRef.value];
  if (!m) {
    toast("没有匹配项可替换");
    return;
  }
  ed.executeEdits("ww-replace", [
    { range: m.range, text: computeReplacement(replace.value, isRegex.value, m.text, m.groups) },
  ]);
}

function replaceAll() {
  const ed = editor.value;
  if (!ed) return;
  if (matches.value.length === 0) {
    toast("没有匹配项可替换");
    return;
  }
  ed.executeEdits(
    "ww-replace-all",
    matches.value.map((m) => ({
      range: m.range,
      text: computeReplacement(replace.value, isRegex.value, m.text, m.groups),
    })),
  );
  toast(`已替换 ${matches.value.length} 处`);
}

function applyRule(rule: ReplaceRule) {
  find.value = rule.find;
  replace.value = rule.replace;
  isRegex.value = rule.isRegex;
  matchCase.value = rule.matchCase;
  toast(`已应用规则：${rule.name}`);
}

// ---------- 列表工具（分割 / 组合 / 排序均原地作用于聚焦编辑器） ----------
const customRegex = ref("");
const templatesOpen = ref(false);
const delimiterMenuOpen = ref(false);
const delimiterTriggerRef = ref<HTMLElement | null>(null);
const delimiterMenuProps = dropdownMenuProps("分隔符选项");
// 规则下拉框（受控，选中后应用并复位）
const ruleSelect = ref<string | null>(null);
const templateSelect = ref<string | null>(null);
// 排序匹配模式：以模板列表项开头即匹配
const prefixMatch = ref(false);

function selectDelimiter(key: string | number) {
  delimiter.value = String(key) as SplitDelimiter;
  delimiterMenuOpen.value = false;
  restoreDropdownTriggerFocus();
}

function updateDelimiterMenu(show: boolean) {
  delimiterMenuOpen.value = show;
  if (show) focusFirstDropdownItem(delimiterTriggerRef.value);
  else restoreDropdownTriggerFocus();
}

function selectRule(value: string | number | null) {
  if (value == null) return;
  const rule = rulesStore.rules.find((candidate) => candidate.id === String(value));
  if (rule) applyRule(rule);
  ruleSelect.value = null;
}

function selectTemplate(value: string | number | null) {
  templateSelect.value = value == null ? null : String(value);
  const template = templatesStore.templates.find(
    (candidate) => candidate.id === templateSelect.value,
  );
  prefixMatch.value = template?.prefixMatch ?? false;
}

type InPlaceResult = { text: string; message: string } | { error: string };

/** 把结果写回聚焦编辑器：有选区替换选区，否则替换全文（可撤销） */
function applyToFocused(
  sel: monaco.Selection | null,
  model: monaco.editor.ITextModel,
  text: string,
) {
  const src = props.focusedEditor;
  if (!src) return;
  const range = sel && !sel.isEmpty() ? sel : model.getFullModelRange();
  src.executeEdits("ww-in-place", [{ range, text }]);
}

/**
 * 分割 / 组合的公共流程：取输入（选区优先）→ 计算 → 原地写回 → 提示。
 * 空输入在这里统一拦住，避免把聚焦编辑器清空。
 */
function runInPlace(build: (input: string) => InPlaceResult) {
  const src = props.focusedEditor;
  const model = src?.getModel();
  if (!src || !model) {
    toast("请先点击要处理的编辑器（高亮边框者）");
    return;
  }
  const sel = src.getSelection();
  const input = sel && !sel.isEmpty() ? model.getValueInRange(sel) : model.getValue();
  if (!input.trim()) {
    toast("没有可处理的内容");
    return;
  }
  const r = build(input);
  if ("error" in r) {
    toast(r.error);
    return;
  }
  applyToFocused(sel, model, r.text);
  toast(r.message);
}

/** 分割：作用于当前聚焦编辑器（选区优先），结果原地写回 */
function runSplit() {
  runInPlace((input) => {
    const r = splitText(input, {
      delimiter: delimiter.value,
      customRegex: customRegex.value,
      trim: true,
      ignoreEmpty: true,
      dedupe: false,
    });
    if (r.error) return { error: r.error };
    return { text: r.items.join("\n"), message: `已分割 ${r.items.length} 项并原地更新编辑器` };
  });
}

/**
 * 组合：把聚焦编辑器的多行（选区优先）拼成一行并原地写回，是「分割」的逆操作。
 * 组合符与分割共用同一个分隔符下拉。
 */
function runJoin() {
  runInPlace((input) => {
    const r = joinText(input, { delimiter: delimiter.value, customRegex: customRegex.value });
    if (r.error) return { error: r.error };
    // 兜底：全空白输入（正常路径已被 runInPlace 拦掉）不得把编辑器写成空；
    // 放在最前面，换行等分支才不会有绕过它的机会
    if (r.count === 0) {
      return { error: "没有可组合的内容（输入为空或只有空白行）" };
    }
    // 组合符为换行时结果仍是多行（只是顺带规整了空行与首尾空白），提示要如实说明
    if (r.separator === "\n") {
      return {
        text: r.text,
        message: `组合符为换行，已规整 ${r.count} 行并原地更新编辑器（结果仍是多行）`,
      };
    }
    // 只有一行时谈不上「组合成一行」，如实说明操作结果
    if (r.count === 1) {
      return { text: r.text, message: "内容只有 1 行，已原样保留" };
    }
    return { text: r.text, message: `已把 ${r.count} 行组合为一行并原地更新编辑器` };
  });
}

/** 排序：作用于当前聚焦编辑器（选区优先）。
 *  选了排序模板 → 按模板排；未选 → 升序，再点一次切降序，循环切换 */
function runSort() {
  const src = props.focusedEditor;
  const model = src?.getModel();
  if (!src || !model) {
    toast("请先点击要排序的编辑器（高亮边框者）");
    return;
  }
  const sel = src.getSelection();
  const input = sel && !sel.isEmpty() ? model.getValueInRange(sel) : model.getValue();
  const items = splitLines(input);
  if (items.length === 0) {
    toast("该编辑器没有可排序的内容");
    return;
  }

  const t = templatesStore.templates.find((x) => x.id === templateSelect.value);
  if (t) {
    const r = sortByReference(
      items,
      t.items,
      prefixMatch.value || t.prefixMatch ? "prefix" : "exact",
    );
    if (r.sorted.length === 0) {
      toast("没有匹配的项目");
      return;
    }
    applyToFocused(sel, model, [...r.sorted, ...r.unmatched].join("\n"));
    if (r.unmatched.length > 0) {
      toast(
        `已按「${t.name}」排序 ${r.sorted.length} 项` +
          `，${r.unmatched.length} 项未匹配已保留在末尾`,
      );
    } else {
      toast(`已按「${t.name}」排序 ${r.sorted.length} 项`);
    }
    return;
  }

  // 未选规则：升序 ↔ 降序循环（内容已是升序结果则下一次降序，反之亦然）
  const ascText = sortAlphabetical(items, "asc").join("\n");
  const descText = sortAlphabetical(items, "desc").join("\n");
  let next: string;
  let order: "升序" | "降序";
  if (input === ascText) {
    next = descText;
    order = "降序";
  } else if (input === descText) {
    next = ascText;
    order = "升序";
  } else {
    next = ascText;
    order = "升序";
  }
  applyToFocused(sel, model, next);
  toast(`已按${order}排序 ${items.length} 项`);
}

// 接收来自暂存区等入口的规则应用请求，把规则填入查找/替换输入框
const ruleListener = (rule: ReplaceRule) => {
  find.value = rule.find;
  replace.value = rule.replace;
  isRegex.value = rule.isRegex;
  matchCase.value = rule.matchCase;
  toast(`已应用规则：${rule.name}`);
};

onMounted(() => {
  setRuleApplyListener(ruleListener);
  // 延迟注册避免覆盖：组件卸载时注销
});
onUnmounted(() => {
  contentSub?.dispose();
  contentSub = null;
  modelChangeSub?.dispose();
  modelChangeSub = null;
  // 工作区 Model 比组件活得久，装饰不清会在重新进入时残留在旧位置
  decorationsRef.value?.clear();
  decorationsRef.value = null;
  setRuleApplyListener(null);
});

/** Ctrl+F / Ctrl+H 聚焦查找框 */
function open() {
  void nextTick(() => setTimeout(() => findInputRef.value?.focus(), 60));
}
defineExpose({ open });
</script>

<template>
  <div class="bg-background p-0">
    <div class="flex min-w-0 items-center gap-2">
      <!-- 主命令栏始终单行：输入框先收缩，仍超出时整条横向滚动 -->
      <div
        data-ww-toolbar
        class="no-scrollbar flex min-w-0 flex-1 flex-nowrap items-center gap-2 overflow-x-auto py-0.5"
      >
        <div
          data-ww-group="find"
          class="flex min-w-[17rem] flex-[1_1_24rem] flex-nowrap items-center gap-2"
        >
          <div data-ww-input-box class="relative min-w-[7rem] flex-1 basis-0">
            <Input
              ref="findInputRef"
              v-model="find"
              aria-label="查找文本"
              placeholder="查找"
              data-ww-input="find"
              class="w-full min-w-0"
              :style="{ '--n-padding-right': '48px' }"
            />
            <span
              v-if="find.trim()"
              title="匹配数（当前 / 总数）"
              role="status"
              aria-live="polite"
              aria-atomic="true"
              :aria-label="
                findError
                  ? '正则表达式无效'
                  : matches.length > 0
                    ? `第 ${current + 1} 项，共 ${matches.length} 项匹配`
                    : '没有匹配项'
              "
              :class="[
                'pointer-events-none absolute inset-y-0 right-2.5 flex items-center font-mono text-[10px]',
                findError ? 'text-destructive' : 'text-muted-foreground',
              ]"
            >
              {{
                findError ? "无效" : matches.length > 0 ? `${current + 1}/${matches.length}` : "0"
              }}
            </span>
          </div>
          <div
            v-if="editorToolbarVisible('find-options')"
            data-ww-item="find-options"
            class="relative z-10 flex shrink-0 items-center gap-2"
          >
            <Toggle
              :active="isRegex"
              icon-only
              title="正则表达式"
              @click="isRegex = !isRegex"
              class="shrink-0"
            >
              <Braces />
            </Toggle>
            <Toggle
              :active="matchCase"
              icon-only
              title="区分大小写"
              @click="matchCase = !matchCase"
              class="shrink-0"
            >
              <LetterCase />
            </Toggle>
            <Toggle
              :active="highlightAll"
              icon-only
              title="全部高亮"
              @click="highlightAll = !highlightAll"
              class="shrink-0"
            >
              <Highlight />
            </Toggle>
          </div>
          <div
            v-if="editorToolbarVisible('find-navigation')"
            data-ww-item="find-navigation"
            class="relative z-10 flex shrink-0 items-center gap-2"
          >
            <Button
              variant="outline"
              size="icon-sm"
              class="shrink-0"
              title="上一个"
              :disabled="matches.length === 0"
              @click="navigate(current - 1)"
            >
              <ArrowUp />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              class="shrink-0"
              title="下一个"
              :disabled="matches.length === 0"
              @click="navigate(current + 1)"
            >
              <ArrowDown />
            </Button>
          </div>
        </div>

        <div
          data-ww-group="replace"
          class="flex min-w-[14.75rem] flex-[1_1_22rem] items-center gap-2"
        >
          <div data-ww-input-box class="relative min-w-[7rem] flex-1 basis-0">
            <Input
              v-model="replace"
              aria-label="替换为"
              placeholder="替换为"
              data-ww-input="replace"
              class="w-full min-w-0"
            />
          </div>
          <NSelect
            v-if="editorToolbarVisible('replace-rules')"
            data-ww-item="replace-rules"
            size="small"
            clearable
            filterable
            placeholder="替换规则"
            :value="ruleSelect"
            :options="ruleSelectOptions"
            :consistent-menu-width="false"
            :menu-props="RULE_SELECT_MENU_PROPS"
            :node-props="ruleNodeProps"
            :input-props="ruleSelectInputProps"
            class="ww-control-text shrink-0"
            style="width: 7.5rem"
            @update:value="selectRule"
            @update:show="(show: boolean) => (ruleSelectOpen = show)"
          />
        </div>

        <div
          v-if="editorToolbarVisible('replace-actions')"
          data-ww-group="replace-actions"
          data-ww-item="replace-actions"
          class="flex shrink-0 items-center gap-2"
        >
          <Button
            size="sm"
            variant="secondary"
            class="h-6.5 shrink-0 px-2 text-[11px]"
            title="替换当前匹配"
            tooltip
            @click="replaceOne"
          >
            <ArrowRight class="size-3" />
            <span class="max-[1700px]:sr-only">替换</span>
          </Button>
          <Button
            size="sm"
            class="h-6.5 shrink-0 px-2 text-[11px]"
            title="全部替换"
            tooltip
            @click="replaceAll"
          >
            <Replace class="size-3" />
            <span class="max-[1700px]:sr-only">全部替换</span>
          </Button>
        </div>

        <Button
          v-if="editorToolbarVisible('replace-manage')"
          data-ww-item="replace-manage"
          variant="outline"
          size="icon-sm"
          class="shrink-0"
          title="管理替换规则"
          @click="
            () => {
              ruleDraft = find.trim() ? { find, replace, isRegex, matchCase } : null;
              rulesOpen = true;
            }
          "
        >
          <Settings />
        </Button>

        <div
          v-if="editorToolbarVisible('split-join')"
          data-ww-group="split-join"
          class="flex shrink-0 items-center gap-2"
        >
          <NDropdown
            trigger="click"
            size="small"
            placement="bottom-start"
            :options="delimiterMenuOptions"
            :menu-props="delimiterMenuProps"
            :node-props="dropdownNodeProps"
            @select="selectDelimiter"
            @update:show="updateDelimiterMenu"
          >
            <span ref="delimiterTriggerRef" class="inline-flex">
              <Button
                variant="outline"
                size="sm"
                class="h-6.5 gap-1 px-2 text-[11px]"
                aria-label="选择分隔符"
                aria-haspopup="menu"
                :aria-expanded="delimiterMenuOpen"
                :title="`分隔符：${delimiterOption.label}`"
              >
                <span class="font-mono">{{ delimiterOption.shortLabel }}</span>
                <ChevronDown class="size-3" />
              </Button>
            </span>
          </NDropdown>
          <Button
            size="sm"
            class="h-6.5 shrink-0 px-2 text-[11px]"
            title="分割"
            tooltip
            @click="runSplit"
          >
            <Scissors class="size-3" />
            <span class="max-[1700px]:sr-only">分割</span>
          </Button>
          <Button
            size="sm"
            class="h-6.5 shrink-0 px-2 text-[11px]"
            title="组合"
            tooltip
            @click="runJoin"
          >
            <ArrowsJoin class="size-3" />
            <span class="max-[1700px]:sr-only">组合</span>
          </Button>
          <Input
            v-if="delimiter === 'custom'"
            v-model="customRegex"
            aria-label="自定义分隔符正则"
            placeholder="分隔正则"
            class="w-24 shrink-0 font-mono"
          />
        </div>

        <div
          v-if="editorToolbarVisible('sort-rules')"
          data-ww-group="sort"
          class="flex shrink-0 items-center gap-2"
        >
          <NSelect
            size="small"
            clearable
            filterable
            placeholder="排序规则"
            :value="templateSelect"
            :options="templateSelectOptions"
            :consistent-menu-width="false"
            :menu-props="TEMPLATE_SELECT_MENU_PROPS"
            :node-props="templateNodeProps"
            :input-props="templateSelectInputProps"
            class="ww-control-text shrink-0"
            style="width: 7rem"
            @update:value="selectTemplate"
            @update:show="(show: boolean) => (templateSelectOpen = show)"
          />
          <Toggle
            :active="prefixMatch"
            icon-only
            @click="prefixMatch = !prefixMatch"
            title="开头匹配：文本以模板列表项开头即算匹配"
          >
            <ArrowBigUpLine class="size-3.5" />
          </Toggle>
          <Button
            size="sm"
            class="h-6.5 shrink-0 px-2 text-[11px]"
            title="排序"
            tooltip
            @click="runSort"
          >
            <ListNumbers class="size-3" />
            <span class="max-[1700px]:sr-only">排序</span>
          </Button>
        </div>

        <Button
          v-if="editorToolbarVisible('sort-manage')"
          data-ww-group="sort-manage"
          data-ww-item="sort-manage"
          variant="outline"
          size="icon-sm"
          class="shrink-0"
          title="管理排序规则"
          @click="templatesOpen = true"
        >
          <Settings />
        </Button>
      </div>

      <ToolbarVisibilityMenu
        :groups="EDITOR_TOOLBAR_GROUPS"
        :hidden-ids="settingsStore.hiddenEditorToolbarItems"
        title="自定义顶部工具栏"
        trigger-variant="outline"
        @update:hiddenIds="updateHiddenEditorToolbarItems"
      />
    </div>

    <p v-if="findError" role="alert" class="mt-1 text-xs text-destructive">
      正则表达式无效，请检查语法
    </p>

    <RulesDialog
      :key="
        rulesOpen
          ? ruleDraft
            ? `${ruleDraft.find}|${ruleDraft.replace}|${ruleDraft.isRegex}|${ruleDraft.matchCase}`
            : 'plain'
          : 'closed'
      "
      :open="rulesOpen"
      :initial-draft="ruleDraft"
      @update:open="(v: boolean) => (rulesOpen = v)"
    />

    <TemplatesDialog :open="templatesOpen" @update:open="(v: boolean) => (templatesOpen = v)" />
  </div>
</template>
