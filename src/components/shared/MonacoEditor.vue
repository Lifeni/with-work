<script setup lang="ts">
import { markRaw, onBeforeUnmount, onMounted, ref, watch } from "vue";
import * as monaco from "monaco-editor";

/**
 * Monaco 编辑器封装：接受外部工作区 Model（由 workspaceModels 缓存管理），
 * 换绑 Model 即切换工作区（撤销/重做历史跟随 Model 独立保留）。
 * 拖放由外层编辑器区域的捕获事件接管（Monaco 原生拖入会在 $0 上做 snippet 展开）。
 */

const props = withDefaults(
  defineProps<{
    model: monaco.editor.ITextModel | null;
    theme?: string;
    options?: monaco.editor.IStandaloneEditorConstructionOptions;
  }>(),
  { theme: "light", options: undefined },
);

const emit = defineEmits<{
  mount: [editor: monaco.editor.IStandaloneCodeEditor];
  /** 内容变化：同时携带当前 Model 引用，供上层按归属写入对应工作区（防换绑滞后串写） */
  "model-change": [value: string, model: monaco.editor.ITextModel | null];
}>();

const host = ref<HTMLDivElement | null>(null);
let editor: monaco.editor.IStandaloneCodeEditor | null = null;

onMounted(() => {
  if (!host.value) return;
  editor = markRaw(
    monaco.editor.create(host.value, {
      model: props.model ?? undefined,
      theme: props.theme,
      ...props.options,
    }),
  );
  editor.onDidChangeModelContent(() => {
    emit("model-change", editor?.getValue() ?? "", editor?.getModel() ?? null);
  });
  emit("mount", editor);
});

// 切换工作区 / 备份导入：换绑 Model（编辑器实例复用，不重建，避免闪烁）
watch(
  () => props.model,
  (m) => {
    editor?.setModel(m ?? null);
  },
);

watch(
  () => props.theme,
  (t) => {
    if (editor) monaco.editor.setTheme(t ?? "light");
  },
);

watch(
  () => props.options,
  (opts) => {
    editor?.updateOptions(opts ?? {});
  },
  { deep: true },
);

onBeforeUnmount(() => {
  editor?.dispose();
  editor = null;
});
</script>

<template>
  <div ref="host" class="h-full w-full overflow-hidden"></div>
</template>
