<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import * as monaco from "monaco-editor";
import {
  ArrowBigUpLine,
  ArrowDown,
  ArrowUp,
  LetterCase,
  Highlight,
  ListNumbers,
  Braces,
  Replace,
  Scissors,
  Settings,
} from "@vicons/tabler";
import Button from "@/components/ui/button.vue";
import Input from "@/components/ui/input.vue";
import Toggle from "@/components/ui/toggle.vue";
import RulesDialog from "@/components/shared/RulesDialog.vue";
import TemplatesDialog from "@/components/shared/TemplatesDialog.vue";
import { setRuleApplyListener } from "@/lib/editorBridge";
import { computeReplacement } from "@/lib/replace";
import { sortAlphabetical, sortByReference } from "@/lib/sort";
import { splitLines, splitText, type SplitDelimiter } from "@/lib/split";
import { useDebounce } from "@/hooks/useDebounce";
import { useRulesStore } from "@/stores/rules";
import { useTemplatesStore } from "@/stores/templates";
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
  /** 当前聚焦的编辑器（查找/替换/预览的源） */
  focusedEditor: monaco.editor.IStandaloneCodeEditor | null;
  /** 另一侧编辑器（替换预览的结果目标） */
  otherEditor: monaco.editor.IStandaloneCodeEditor | null;
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
const toast = useToastStore().push;

// 监听目标编辑器内容版本：内容变化时自动重跑搜索
const modelVersion = ref(0);
watch(
  () => props.focusedEditor,
  (ed) => {
    decorationsRef.value?.clear();
    decorationsRef.value = null;
    const model = ed?.getModel();
    if (!model) return;
    const sub = model.onDidChangeContent(() => {
      modelVersion.value++;
    });
    onUnmounted(() => sub.dispose());
  },
);

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

// ---------- 列表工具（分割：聚焦 → 另一侧；排序规则：作用于另一侧） ----------
const delimiter = ref<SplitDelimiter>("auto");
const customRegex = ref("");
const templatesOpen = ref(false);
// 规则下拉框（受控，选中后应用并复位）
const ruleSelect = ref("");
const templateSelect = ref("");
// 排序匹配模式：以模板列表项开头即匹配
const prefixMatch = ref(false);

/** 把文本写入目标编辑器（整体替换，可撤销） */
const writeToEditor = (dst: monaco.editor.IStandaloneCodeEditor | null, text: string) => {
  const model = dst?.getModel();
  if (!dst || !model) return false;
  dst.executeEdits("ww-list", [{ range: model.getFullModelRange(), text }]);
  return true;
};

/** 分割：作用于当前聚焦编辑器（选区优先），结果自动写入另一侧 */
function runSplit() {
  const src = props.focusedEditor;
  const model = src?.getModel();
  if (!src || !model) {
    toast("请先点击要分割的编辑器（高亮边框者）");
    return;
  }
  const sel = src.getSelection();
  const input = sel && !sel.isEmpty() ? model.getValueInRange(sel) : model.getValue();
  const r = splitText(input, {
    delimiter: delimiter.value,
    customRegex: customRegex.value,
    trim: true,
    ignoreEmpty: true,
    dedupe: false,
  });
  if (r.error) {
    toast(r.error);
    return;
  }
  if (!writeToEditor(props.otherEditor, r.items.join("\n"))) {
    toast("另一侧编辑器尚未就绪");
    return;
  }
  toast(`已分割 ${r.items.length} 项并写入另一侧编辑器`);
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
    applyToFocused(sel, model, r.sorted.join("\n"));
    if (r.unmatched.length > 0) {
      const moved = writeToEditor(props.otherEditor, r.unmatched.join("\n"));
      toast(
        `已按「${t.name}」排序 ${r.sorted.length} 项` +
          (moved
            ? `，${r.unmatched.length} 项未匹配已移至另一侧`
            : `，${r.unmatched.length} 项未匹配（另一侧未就绪）`),
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

/** 把结果写入聚焦编辑器：有选区替换选区，否则替换全文（可撤销） */
const applyToFocused = (
  sel: monaco.Selection | null,
  model: monaco.editor.ITextModel,
  text: string,
) => {
  const src = props.focusedEditor;
  if (!src) return;
  if (sel && !sel.isEmpty()) {
    src.executeEdits("ww-sort", [{ range: sel, text }]);
  } else {
    src.executeEdits("ww-sort", [{ range: model.getFullModelRange(), text }]);
  }
};

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
    <!-- 单行四功能：查找 → 替换 → 分割 → 排序（窄屏自动换行） -->
    <div class="flex flex-wrap items-center gap-1.5">
      <div class="relative min-w-28 flex-1 basis-40">
        <Input
          ref="findInputRef"
          v-model="find"
          placeholder="查找"
          class="w-full"
          :style="{ '--n-padding-right': '48px' }"
        />
        <!-- 匹配数：显示在查找输入框内部右对齐（有输入才显示） -->
        <span
          v-if="find.trim()"
          title="匹配数（当前 / 总数）"
          :class="[
            'pointer-events-none absolute inset-y-0 right-2.5 flex items-center font-mono text-[10px]',
            findError ? 'text-destructive' : 'text-muted-foreground',
          ]"
        >
          {{ findError ? "无效" : matches.length > 0 ? `${current + 1}/${matches.length}` : "0" }}
        </span>
      </div>
      <Toggle
        :active="isRegex"
        title="正则表达式"
        @click="isRegex = !isRegex"
        class="h-6.5 px-1.5 text-[10px]"
      >
        <Braces />
      </Toggle>
      <Toggle
        :active="matchCase"
        title="区分大小写"
        @click="matchCase = !matchCase"
        class="h-6.5 px-1.5 text-[10px]"
      >
        <LetterCase />
      </Toggle>
      <Toggle
        :active="highlightAll"
        title="全部高亮"
        @click="highlightAll = !highlightAll"
        class="h-6.5 px-1.5 text-[10px]"
      >
        <Highlight />
      </Toggle>
      <Button
        variant="ghost"
        size="icon-sm"
        class="w-6.5"
        title="上一个"
        :disabled="matches.length === 0"
        @click="navigate(current - 1)"
      >
        <ArrowUp />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        class="w-6.5"
        title="下一个"
        :disabled="matches.length === 0"
        @click="navigate(current + 1)"
      >
        <ArrowDown />
      </Button>

      <span class="mx-0.5 h-4 w-px shrink-0 bg-border" />

      <Input v-model="replace" placeholder="替换为" class="min-w-24 flex-1 basis-32" />
      <select
        :value="ruleSelect"
        @change="
          (e: Event) => {
            const rule = rulesStore.rules.find(
              (r) => r.id === (e.target as HTMLSelectElement).value,
            );
            if (rule) applyRule(rule);
            ruleSelect = '';
          }
        "
        title="替换规则"
        class="h-6.5 max-w-28 rounded-md border border-border bg-card px-1.5 text-xs outline-none"
      >
        <option value="">替换规则</option>
        <option v-for="r in rulesStore.rules" :key="r.id" :value="r.id">{{ r.name }}</option>
      </select>
      <Button
        size="sm"
        variant="secondary"
        class="h-6.5 shrink-0 px-2 text-[11px]"
        @click="replaceOne"
      >
        替换
      </Button>
      <Button size="sm" class="h-6.5 shrink-0 px-2 text-[11px]" @click="replaceAll">
        <Replace class="size-3" />
        全部替换
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        class="w-6.5"
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

      <span class="mx-0.5 h-4 w-px shrink-0 bg-border" />

      <select
        :value="delimiter"
        @change="delimiter = ($event.target as HTMLSelectElement).value as SplitDelimiter"
        title="分割分隔符"
        class="h-6.5 rounded-md border border-border bg-card px-1.5 text-xs outline-none"
      >
        <option value="auto">自动检测</option>
        <option value="newline">换行</option>
        <option value="comma">英文逗号</option>
        <option value="cn-comma">中文逗号</option>
        <option value="semicolon">英文分号</option>
        <option value="cn-semicolon">中文分号</option>
        <option value="cn-dunhao">顿号</option>
        <option value="space">空格 / Tab</option>
        <option value="custom">自定义正则</option>
      </select>
      <Input
        v-if="delimiter === 'custom'"
        v-model="customRegex"
        placeholder="分隔正则"
        class="min-w-24 flex-1 basis-32 font-mono"
      />
      <Button size="sm" class="h-6.5 shrink-0 px-2 text-[11px]" @click="runSplit">
        <Scissors class="size-3" />
        分割
      </Button>

      <span class="mx-0.5 h-4 w-px shrink-0 bg-border" />

      <select
        :value="templateSelect"
        @change="
          (e: Event) => {
            templateSelect = (e.target as HTMLSelectElement).value;
            // 选中模板后同步开头匹配开关状态（模板自带属性或关闭）
            const t = templatesStore.templates.find((x) => x.id === templateSelect);
            prefixMatch = t?.prefixMatch ?? false;
          }
        "
        title="排序规则"
        class="h-6.5 max-w-28 rounded-md border border-border bg-card px-1.5 text-xs outline-none"
      >
        <option value="">排序规则</option>
        <option v-for="t in templatesStore.templates" :key="t.id" :value="t.id">
          {{ t.name }}
        </option>
      </select>
      <Toggle
        :active="prefixMatch"
        @click="prefixMatch = !prefixMatch"
        title="开头匹配：文本以模板列表项开头即算匹配"
        class="h-6.5 w-6.5 px-0"
      >
        <ArrowBigUpLine class="size-3.5" />
      </Toggle>
      <Button size="sm" class="h-6.5 shrink-0 px-2 text-[11px]" @click="runSort">
        <ListNumbers class="size-3" />
        排序
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        class="w-6.5"
        title="管理排序规则"
        @click="templatesOpen = true"
      >
        <Settings />
      </Button>
    </div>

    <p v-if="findError" class="mt-1 text-xs text-destructive">正则表达式无效，请检查语法</p>

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
