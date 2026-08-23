<script setup lang="ts">
import { markRaw, onBeforeUnmount, onMounted, ref, watch } from "vue";
import * as monaco from "monaco-editor";

/** 对比弹窗内的只读双栏 Diff 编辑器（不影响下方两个常驻编辑器） */

const props = withDefaults(
  defineProps<{
    original: string;
    modified: string;
    language?: string;
    theme?: string;
    options?: monaco.editor.IStandaloneDiffEditorConstructionOptions;
  }>(),
  { language: "plaintext", theme: "light", options: undefined },
);

const host = ref<HTMLDivElement | null>(null);
let diff: monaco.editor.IStandaloneDiffEditor | null = null;
let originalModel: monaco.editor.ITextModel | null = null;
let modifiedModel: monaco.editor.ITextModel | null = null;

onMounted(() => {
  if (!host.value) return;
  originalModel = monaco.editor.createModel(props.original, props.language);
  modifiedModel = monaco.editor.createModel(props.modified, props.language);
  diff = markRaw(
    monaco.editor.createDiffEditor(host.value, {
      theme: props.theme,
      ...props.options,
    }),
  );
  diff.setModel({ original: originalModel, modified: modifiedModel });
});

watch(
  () => props.original,
  (v) => originalModel?.setValue(v),
);
watch(
  () => props.modified,
  (v) => modifiedModel?.setValue(v),
);

onBeforeUnmount(() => {
  diff?.dispose();
  originalModel?.dispose();
  modifiedModel?.dispose();
  diff = null;
  originalModel = null;
  modifiedModel = null;
});
</script>

<template>
  <div ref="host" class="h-full w-full overflow-hidden"></div>
</template>
