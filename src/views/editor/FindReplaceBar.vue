<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import * as monaco from "monaco-editor";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Braces,
  Highlight,
  LetterCase,
  Replace,
  Settings,
} from "@vicons/tabler";
import { NSelect, type SelectNodeProps } from "naive-ui";
import Button from "@/components/ui/button.vue";
import Input from "@/components/ui/input.vue";
import RulesDialog from "@/components/shared/RulesDialog.vue";
import Toggle from "@/components/ui/toggle.vue";
import { setRuleApplyListener } from "@/lib/editorBridge";
import { computeReplacement } from "@/lib/replace";
import { useDebounce } from "@/hooks/useDebounce";
import { useRulesStore } from "@/stores/rules";
import { useSettingsStore } from "@/stores/settings";
import { useToastStore } from "@/stores/toast";
import type { ReplaceRule } from "@/types";

interface MatchInfo {
  line: number;
  col: number;
  range: monaco.IRange;
  text: string;
  groups: string[];
}

interface Props {
  focusedEditor: monaco.editor.IStandaloneCodeEditor | null;
}

const props = defineProps<Props>();
const editor = computed(() => props.focusedEditor);
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
const findInputRef = ref<InstanceType<typeof Input> | null>(null);
const decorationsRef = ref<monaco.editor.IEditorDecorationsCollection | null>(null);
const currentRef = ref(0);
const rulesStore = useRulesStore();
const settingsStore = useSettingsStore();
const toast = useToastStore().push;

const ruleSelectOptions = computed(() =>
  rulesStore.rules.map((rule) => ({ label: rule.name, value: rule.id })),
);
const RULE_SELECT_MENU_PROPS = {
  class: "ww-select-menu",
  id: "ww-replace-rule-options",
  role: "listbox",
  "aria-label": "替换规则",
};
const RULE_SELECT_INPUT_PROPS = {
  role: "combobox" as const,
  "aria-label": "替换规则",
  "aria-autocomplete": "list" as const,
  "aria-haspopup": "listbox" as const,
  "aria-controls": "ww-replace-rule-options",
};
const ruleSelectOpen = ref(false);
const ruleSelect = ref<string | null>(null);
const ruleSelectInputProps = computed(() => ({
  ...RULE_SELECT_INPUT_PROPS,
  "aria-expanded": ruleSelectOpen.value,
}));
const ruleNodeProps: SelectNodeProps = (option) => ({
  role: "option",
  "aria-selected":
    String((option as { value?: string | number }).value ?? "") === String(ruleSelect.value ?? "")
      ? "true"
      : "false",
});

function editorToolbarVisible(id: string) {
  return !settingsStore.hiddenEditorToolbarItems.includes(id);
}

const modelVersion = ref(0);
let contentSub: monaco.IDisposable | null = null;
let modelChangeSub: monaco.IDisposable | null = null;

function attachContentSub(ed: monaco.editor.IStandaloneCodeEditor) {
  contentSub?.dispose();
  contentSub = null;
  const model = ed.getModel();
  if (!model) return;
  contentSub = model.onDidChangeContent(() => {
    modelVersion.value++;
  });
}

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

function selectRule(value: string | number | null) {
  if (value == null) return;
  const rule = rulesStore.rules.find((candidate) => candidate.id === String(value));
  if (rule) applyRule(rule);
  ruleSelect.value = null;
}

const ruleListener = (rule: ReplaceRule) => applyRule(rule);

onMounted(() => setRuleApplyListener(ruleListener));
onUnmounted(() => {
  contentSub?.dispose();
  contentSub = null;
  modelChangeSub?.dispose();
  modelChangeSub = null;
  decorationsRef.value?.clear();
  decorationsRef.value = null;
  setRuleApplyListener(null);
});

function open() {
  void nextTick(() => setTimeout(() => findInputRef.value?.focus(), 60));
}
defineExpose({ open });
</script>

<template>
  <div
    data-ww-group="find"
    class="flex min-w-min flex-[1_1_15rem] flex-nowrap items-center gap-1.5"
  >
    <div data-ww-input-box class="relative min-w-[6rem] flex-1 basis-0">
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
        {{ findError ? "无效" : matches.length > 0 ? `${current + 1}/${matches.length}` : "0" }}
      </span>
    </div>
    <div
      v-if="editorToolbarVisible('find-options')"
      data-ww-item="find-options"
      class="relative z-10 flex shrink-0 items-center gap-1.5"
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
      class="relative z-10 flex shrink-0 items-center gap-1.5"
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

  <div data-ww-group="replace" class="flex min-w-min flex-[1_1_14rem] items-center gap-1.5">
    <div data-ww-input-box class="relative min-w-[6rem] flex-1 basis-0">
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
      menu-size="small"
      bordered
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
      style="width: 7rem"
      @update:value="selectRule"
      @update:show="(show: boolean) => (ruleSelectOpen = show)"
    />
  </div>

  <div
    v-if="editorToolbarVisible('replace-actions')"
    data-ww-group="replace-actions"
    data-ww-item="replace-actions"
    class="flex shrink-0 items-center gap-1.5"
  >
    <Button
      size="sm"
      variant="secondary"
      class="h-7 shrink-0 px-2"
      title="替换当前匹配"
      tooltip
      @click="replaceOne"
    >
      <ArrowRight class="size-3" />
      <span class="max-[1700px]:sr-only">替换</span>
    </Button>
    <Button size="sm" class="h-7 shrink-0 px-2" title="全部替换" tooltip @click="replaceAll">
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

  <p v-if="findError" role="alert" class="basis-full text-xs text-destructive">
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
</template>
