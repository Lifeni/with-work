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
vi.mock("@/components/shared/FloatingEditorToolbar.vue", () => ({
  default: { name: "FloatingEditorToolbarStub", template: "<div />" },
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

  it("DataTransfer.types 为 DOMStringList（无 includes）时拖入仍可用", async () => {
    const store = useWorkspaceStore();
    const id = store.createWorkspace();
    store.setLeft(id, "原始内容");

    const wrapper = mount(EditorView, { attachTo: document.body });
    await nextTick();
    const stub = wrapper.get(".monaco-editor-stub");
    const zone = stub.element.parentElement!;

    // 模拟 Chrome 行为：types 是仅含 contains 的 DOMStringList-like 对象
    const dt = {
      types: {
        contains: (t: string) => t === "text/plain",
      },
      getData: (k: string) => (k === "text/plain" ? "拖入文本" : ""),
    };
    const ev = new Event("drop", { bubbles: true, cancelable: true });
    Object.defineProperty(ev, "dataTransfer", { value: dt });
    zone.dispatchEvent(ev);
    await nextTick();
    await nextTick();

    expect(store.workspaces[0].left).toContain("拖入文本");
    wrapper.unmount();
  });
});

describe("EditorView 自绘拖拽（ww-card-drop）", () => {
  it("卡片文本拖入左编辑器：落点退化到光标处插入", async () => {
    const store = useWorkspaceStore();
    const id = store.createWorkspace();
    store.setLeft(id, "原始内容");

    const wrapper = mount(EditorView, { attachTo: document.body });
    await nextTick();
    const leftZone = wrapper.get('[data-ww-editor="left"]');
    // 模拟 StagingPanel pointerup 时派发的自定义事件
    leftZone.element.dispatchEvent(
      new CustomEvent("ww-card-drop", {
        bubbles: true,
        detail: { kind: "staging", text: "卡片文本", clientX: 0, clientY: 0 },
      }),
    );
    await nextTick();
    await nextTick();

    // mock 的 getTargetAtClientPoint 返回 null → 插入到光标（1:1）
    expect(store.workspaces[0].left).toBe("卡片文本原始内容");
    wrapper.unmount();
  });

  it("卡片规则拖入右编辑器：按规则替换全文", async () => {
    const store = useWorkspaceStore();
    const id = store.createWorkspace();
    store.setRight(id, "foo bar");
    const { useRulesStore } = await import("@/stores/rules");
    useRulesStore().addRule({
      id: "r2",
      name: "规则二",
      find: "foo",
      replace: "福",
      isRegex: false,
      matchCase: false,
    });

    const wrapper = mount(EditorView, { attachTo: document.body });
    await nextTick();
    const rightZone = wrapper.get('[data-ww-editor="right"]');
    rightZone.element.dispatchEvent(
      new CustomEvent("ww-card-drop", {
        bubbles: true,
        detail: { kind: "rule", ruleId: "r2", text: "规则二：foo → 福" },
      }),
    );
    await nextTick();
    await nextTick();

    expect(store.workspaces[0].right).toBe("福 bar");
    wrapper.unmount();
  });
});

describe("EditorView 设置联动", () => {
  it("修改字号/自动换行设置会实时更新编辑器选项", async () => {
    const { useSettingsStore } = await import("@/stores/settings");
    const settings = useSettingsStore();
    useWorkspaceStore().createWorkspace();
    const wrapper = mount(EditorView, { attachTo: document.body });
    await nextTick();

    const stub = wrapper.findComponent({ name: "MonacoEditorStub" });
    expect(stub.props("options")).toMatchObject({ fontSize: 14, wordWrap: "on" });

    settings.setFontSize(18);
    settings.setWordWrap(false);
    await nextTick();

    const opts = stub.props("options") as Record<string, unknown>;
    expect(opts.fontSize).toBe(18);
    expect(opts.wordWrap).toBe("off");
    wrapper.unmount();
  });
});

describe("EditorView 工作区切换防串写", () => {
  it("切换工作区时不会把旧编辑器内容串入新工作区", async () => {
    const store = useWorkspaceStore();
    const id1 = store.createWorkspace();
    store.setLeft(id1, "工作区1内容");
    const id2 = store.createWorkspace();
    store.setLeft(id2, "工作区2内容");
    store.setActive(id2);

    const wrapper = mount(EditorView, { attachTo: document.body });
    await nextTick();
    await nextTick();

    // 切换到工作区 1：换绑滞后窗口内编辑器仍持有工作区 2 的 Model，
    // 双向同步必须跳过（不得把 store 值写入旧 Model、也不得把旧 Model 内容写回 store）
    store.setActive(id1);
    await nextTick();
    await nextTick();

    expect(store.workspaces.find((w) => w.id === id1)!.left).toBe("工作区1内容");
    expect(store.workspaces.find((w) => w.id === id2)!.left).toBe("工作区2内容");
    wrapper.unmount();
  });
});
