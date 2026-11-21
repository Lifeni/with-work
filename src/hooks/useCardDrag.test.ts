import { afterEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { defineComponent, h } from "vue";
import { useCardDrag } from "@/hooks/useCardDrag";

const Harness = defineComponent({
  setup() {
    const { startCardDrag } = useCardDrag();
    return () =>
      h("div", {
        "data-testid": "drag-card",
        onPointerdown: (event: PointerEvent) =>
          startCardDrag(event, { kind: "staging", text: "暂存内容" }),
      });
  },
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

function setupDragTarget() {
  const wrapper = mount(Harness, { attachTo: document.body });
  const editor = document.createElement("div");
  editor.dataset.wwEditor = "left";
  document.body.appendChild(editor);
  const onDrop = vi.fn();
  editor.addEventListener("ww-card-drop", onDrop);
  Object.defineProperty(document, "elementFromPoint", {
    configurable: true,
    value: () => editor,
  });
  return { wrapper, card: wrapper.get('[data-testid="drag-card"]'), editor, onDrop };
}

function pointer(type: string, x: number, y: number) {
  return new MouseEvent(type, {
    bubbles: true,
    button: 0,
    clientX: x,
    clientY: y,
  });
}

describe("useCardDrag", () => {
  it("正常松开时向落点编辑器派发拖放事件", async () => {
    const { wrapper, card, editor, onDrop } = setupDragTarget();

    card.element.dispatchEvent(pointer("pointerdown", 0, 0));
    window.dispatchEvent(pointer("pointermove", 30, 30));
    window.dispatchEvent(pointer("pointerup", 30, 30));

    expect(onDrop).toHaveBeenCalledTimes(1);
    expect((onDrop.mock.calls[0][0] as CustomEvent).detail).toMatchObject({
      kind: "staging",
      text: "暂存内容",
    });
    expect(editor.style.outline).toBe("");
    wrapper.unmount();
  });

  it("pointercancel 或窗口失焦只清理拖拽，不触发插入", async () => {
    const { wrapper, card, editor, onDrop } = setupDragTarget();

    card.element.dispatchEvent(pointer("pointerdown", 0, 0));
    window.dispatchEvent(pointer("pointermove", 30, 30));
    window.dispatchEvent(pointer("pointercancel", 30, 30));
    expect(onDrop).not.toHaveBeenCalled();
    expect(editor.style.outline).toBe("");

    card.element.dispatchEvent(pointer("pointerdown", 0, 0));
    window.dispatchEvent(pointer("pointermove", 30, 30));
    window.dispatchEvent(new Event("blur"));
    expect(onDrop).not.toHaveBeenCalled();
    expect(editor.style.outline).toBe("");
    wrapper.unmount();
  });

  it("拖拽进行中忽略第二个 pointerdown，避免遗留幽灵层", async () => {
    const { wrapper, card } = setupDragTarget();

    card.element.dispatchEvent(pointer("pointerdown", 0, 0));
    window.dispatchEvent(pointer("pointermove", 20, 20));
    card.element.dispatchEvent(pointer("pointerdown", 0, 0));
    window.dispatchEvent(pointer("pointermove", 40, 40));

    expect(document.querySelectorAll(".ww-drag-ghost")).toHaveLength(1);
    window.dispatchEvent(pointer("pointercancel", 40, 40));
    expect(document.querySelectorAll(".ww-drag-ghost")).toHaveLength(0);
    wrapper.unmount();
  });
});
