import { defineComponent, h, onMounted } from "vue";
import { createMockEditor, type MockEditor } from "./mockEditor";

/**
 * MonacoEditor.vue 的测试替身：
 * 挂载时用 mockEditor 创建假编辑器并 emit mount，内容变化 emit model-change。
 * 各组件测试通过 vi.mock("@/components/shared/MonacoEditor.vue", () => ({ default: monacoEditorStub }))
 * 替换真实组件（真实 monaco-editor 在测试模式下被 alias 为 mockMonaco，无法创建实例）。
 */
export const monacoEditorStub = defineComponent({
  name: "MonacoEditorStub",
  props: {
    model: { type: Object, default: null },
    theme: { type: String, default: "light" },
    options: { type: Object, default: undefined },
  },
  emits: ["mount", "model-change"],
  setup(props, { emit }) {
    let mock: MockEditor | null = null;
    onMounted(() => {
      const initial = (props.model as { getValue?: () => string } | null)?.getValue?.() ?? "";
      mock = createMockEditor(initial);
      mock.model.onDidChangeContent(() => {
        emit("model-change", mock?.getValue() ?? "");
      });
      emit("mount", mock.editor);
    });
    return () => h("div", { class: "monaco-editor-stub", "data-testid": "monaco-editor-stub" });
  },
});

/** DiffEditor.vue 的测试替身（对比弹窗内使用） */
export const diffEditorStub = defineComponent({
  name: "DiffEditorStub",
  props: {
    original: { type: String, default: "" },
    modified: { type: String, default: "" },
  },
  render() {
    return h("div", { class: "diff-editor-stub", "data-testid": "diff-editor-stub" });
  },
});

/** 编辑行为的断言入口：通过 @mount 事件的 editor 参数拿到 mock（editor 上挂有编辑记录） */
export type { MockEditor } from "./mockEditor";
