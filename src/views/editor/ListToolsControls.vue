<script setup lang="ts">
import { computed, ref } from "vue";
import * as monaco from "monaco-editor";
import {
  ArrowBigUpLine,
  ArrowsJoin,
  ChevronDown,
  ListNumbers,
  Scissors,
  Settings,
} from "@vicons/tabler";
import { NDropdown, NSelect, type SelectNodeProps } from "naive-ui";
import Button from "@/components/ui/button.vue";
import Input from "@/components/ui/input.vue";
import TemplatesDialog from "@/components/shared/TemplatesDialog.vue";
import Toggle from "@/components/ui/toggle.vue";
import {
  dropdownMenuProps,
  dropdownNodeProps,
  focusFirstDropdownItem,
  restoreDropdownTriggerFocus,
} from "@/components/ui/dropdown";
import { joinText } from "@/lib/join";
import { sortAlphabetical, sortByReference } from "@/lib/sort";
import { splitLines, splitText, type SplitDelimiter } from "@/lib/split";
import { useSettingsStore } from "@/stores/settings";
import { useTemplatesStore } from "@/stores/templates";
import { useToastStore } from "@/stores/toast";

interface Props {
  focusedEditor: monaco.editor.IStandaloneCodeEditor | null;
}

const props = defineProps<Props>();
const settingsStore = useSettingsStore();
const templatesStore = useTemplatesStore();
const toast = useToastStore().push;
const delimiter = ref<SplitDelimiter>("auto");
const customRegex = ref("");
const templatesOpen = ref(false);
const delimiterMenuOpen = ref(false);
const delimiterTriggerRef = ref<HTMLElement | null>(null);
const delimiterMenuProps = dropdownMenuProps("分隔符选项");
const templateSelect = ref<string | null>(null);
const prefixMatch = ref(false);
const templateSelectOpen = ref(false);

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
const templateSelectOptions = computed(() =>
  templatesStore.templates.map((template) => ({ label: template.name, value: template.id })),
);
const TEMPLATE_SELECT_MENU_PROPS = {
  class: "ww-select-menu",
  id: "ww-sort-template-options",
  role: "listbox",
  "aria-label": "排序模板",
};
const TEMPLATE_SELECT_INPUT_PROPS = {
  role: "combobox" as const,
  "aria-label": "排序模板",
  "aria-autocomplete": "list" as const,
  "aria-haspopup": "listbox" as const,
  "aria-controls": "ww-sort-template-options",
};
const templateSelectInputProps = computed(() => ({
  ...TEMPLATE_SELECT_INPUT_PROPS,
  "aria-expanded": templateSelectOpen.value,
}));
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

function selectTemplate(value: string | number | null) {
  templateSelect.value = value == null ? null : String(value);
  const template = templatesStore.templates.find(
    (candidate) => candidate.id === templateSelect.value,
  );
  prefixMatch.value = template?.prefixMatch ?? false;
}

type InPlaceResult = { text: string; message: string } | { error: string };

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
  const result = build(input);
  if ("error" in result) {
    toast(result.error);
    return;
  }
  applyToFocused(sel, model, result.text);
  toast(result.message);
}

function runSplit() {
  runInPlace((input) => {
    const result = splitText(input, {
      delimiter: delimiter.value,
      customRegex: customRegex.value,
      trim: true,
      ignoreEmpty: true,
      dedupe: false,
    });
    if (result.error) return { error: result.error };
    return {
      text: result.items.join("\n"),
      message: `已分割 ${result.items.length} 项并原地更新编辑器`,
    };
  });
}

function runJoin() {
  runInPlace((input) => {
    const result = joinText(input, {
      delimiter: delimiter.value,
      customRegex: customRegex.value,
    });
    if (result.error) return { error: result.error };
    if (result.count === 0) {
      return { error: "没有可组合的内容（输入为空或只有空白行）" };
    }
    if (result.separator === "\n") {
      return {
        text: result.text,
        message: `组合符为换行，已规整 ${result.count} 行并原地更新编辑器（结果仍是多行）`,
      };
    }
    if (result.count === 1) {
      return { text: result.text, message: "内容只有 1 行，已原样保留" };
    }
    return { text: result.text, message: `已把 ${result.count} 行组合为一行并原地更新编辑器` };
  });
}

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

  const template = templatesStore.templates.find(
    (candidate) => candidate.id === templateSelect.value,
  );
  if (template) {
    const result = sortByReference(
      items,
      template.items,
      prefixMatch.value || template.prefixMatch ? "prefix" : "exact",
    );
    if (result.sorted.length === 0) {
      toast("没有匹配的项目");
      return;
    }
    applyToFocused(sel, model, [...result.sorted, ...result.unmatched].join("\n"));
    toast(
      result.unmatched.length > 0
        ? `已按「${template.name}」排序 ${result.sorted.length} 项，${result.unmatched.length} 项未匹配已保留在末尾`
        : `已按「${template.name}」排序 ${result.sorted.length} 项`,
    );
    return;
  }

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
</script>

<template>
  <div
    v-if="editorToolbarVisible('split-join')"
    data-ww-group="split-join"
    class="flex shrink-0 items-center gap-1.5"
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
          class="h-7 gap-1 px-2"
          aria-label="选择分隔符"
          aria-haspopup="menu"
          :aria-expanded="delimiterMenuOpen"
          :title="`分隔符：${delimiterOption.label}`"
        >
          <span>{{ delimiterOption.shortLabel }}</span>
          <ChevronDown class="size-3" />
        </Button>
      </span>
    </NDropdown>
    <Button
      size="sm"
      variant="secondary"
      class="h-7 shrink-0 px-2"
      title="分割"
      tooltip
      @click="runSplit"
    >
      <Scissors class="size-3" />
      <span class="max-[1700px]:sr-only">分割</span>
    </Button>
    <Button
      size="sm"
      variant="secondary"
      class="h-7 shrink-0 px-2"
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
    class="flex shrink-0 items-center gap-1.5"
  >
    <NSelect
      size="small"
      menu-size="small"
      bordered
      clearable
      filterable
      placeholder="排序模板"
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
      variant="secondary"
      class="h-7 shrink-0 px-2"
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
    title="管理排序模板"
    @click="templatesOpen = true"
  >
    <Settings />
  </Button>

  <TemplatesDialog
    :open="templatesOpen"
    @update:open="(value: boolean) => (templatesOpen = value)"
  />
</template>
