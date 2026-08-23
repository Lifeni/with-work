import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import EditorView from "@/views/editor/EditorView.vue";
import { resetStores } from "@/test/resetStores";
import { useWorkspaceStore } from "@/stores/workspace";

vi.mock("@/components/shared/MonacoEditor.vue", async () => {
  const { monacoEditorStub } = await import("@/test/stubs");
  return { default: monacoEditorStub };
});
vi.mock("@/components/shared/DiffEditor.vue", async () => {
  const { diffEditorStub } = await import("@/test/stubs");
  return { default: diffEditorStub };
});
vi.mock("@/views/editor/FindReplacePanel.vue", () => ({
  default: { name: "FindReplacePanelStub", template: "<div />" },
}));

beforeEach(() => {
  resetStores();
});

/** 派发 drop 事件（jsdom 无 DragEvent，用 Event + defineProperty 注入 dataTransfer） */
function fireDrop(el: Element, text: string, source = "staging") {
  const dt = {
    types: ["text/plain", "application/x-with-work-source"],
    getData: (k: string) =>
      k === "text/plain" ? text : k === "application/x-with-work-source" ? source : "",
  };
  const ev = new Event("drop", { bubbles: true, cancelable: true });
  Object.defineProperty(ev, "dataTransfer", { value: dt });
  el.dispatchEvent(ev);
}

describe("EditorView 拖入", () => {
  it("普通文本拖入左编辑器并插入（落点坐标系不可用时退化到光标处）", async () => {
    const store = useWorkspaceStore();
    const id = store.createWorkspace();
    store.setLeft(id, "原始内容\n第二行");

    const wrapper = mount(EditorView, { attachTo: document.body });
    await nextTick();

    // stub 渲染于左右两个容器内，取第一个（左编辑器）所在容器
    const stub = wrapper.get(".monaco-editor-stub");
    const zone = stub.element.parentElement!;
    fireDrop(zone, "拖入的文本");
    await nextTick();
    await nextTick();

    // mockEditor 的 getTargetAtClientPoint 返回 null → fallback 到光标处（1:1）插入
    expect(store.workspaces[0].left).toBe("拖入的文本原始内容\n第二行");
    wrapper.unmount();
  });

  it("规则拖入左编辑器按规则替换全文", async () => {
    const store = useWorkspaceStore();
    const id = store.createWorkspace();
    store.setLeft(id, "hello world");
    useWorkspaceStore().setLeft(id, "hello world");
    const { useRulesStore } = await import("@/stores/rules");
    useRulesStore().addRule({
      id: "r1",
      name: "规则",
      find: "hello",
      replace: "你好",
      isRegex: false,
      matchCase: false,
    });

    const wrapper = mount(EditorView, { attachTo: document.body });
    await nextTick();

    const stub = wrapper.get(".monaco-editor-stub");
    const zone = stub.element.parentElement!;
    // 规则数据
    const dt = {
      types: ["application/x-with-work-rule", "text/plain"],
      getData: (k: string) => (k === "application/x-with-work-rule" ? "r1" : ""),
    };
    const ev = new Event("drop", { bubbles: true, cancelable: true });
    Object.defineProperty(ev, "dataTransfer", { value: dt });
    zone.dispatchEvent(ev);
    await nextTick();
    await nextTick();

    expect(store.workspaces[0].left).toBe("你好 world");
    wrapper.unmount();
  });
});
