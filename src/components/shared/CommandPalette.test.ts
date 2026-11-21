import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { nextTick } from "vue";
import CommandPalette from "@/components/shared/CommandPalette.vue";
import { resetStores } from "@/test/resetStores";
import { useUiStore } from "@/stores/ui";
import { useWorkspaceStore } from "@/stores/workspace";

beforeEach(() => {
  resetStores();
});

async function paletteInput() {
  await vi.waitFor(() => {
    expect(document.querySelector('input[aria-label="搜索命令"]')).not.toBeNull();
  });
  return document.querySelector('input[aria-label="搜索命令"]') as HTMLInputElement;
}

async function typeQuery(input: HTMLInputElement, value: string) {
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await nextTick();
}

describe("CommandPalette", () => {
  it("Ctrl+K 打开命令面板并自动聚焦搜索框", async () => {
    const wrapper = mount(CommandPalette, { attachTo: document.body });
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }));
    await flushPromises();

    expect(useUiStore().commandPaletteOpen).toBe(true);
    const input = await paletteInput();
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(input);
    });
    wrapper.unmount();
  });

  it("目标元素阻止冒泡时仍能从捕获阶段打开命令面板", async () => {
    const wrapper = mount(CommandPalette, { attachTo: document.body });
    const target = document.createElement("textarea");
    document.body.appendChild(target);
    target.addEventListener("keydown", (event) => event.stopPropagation());
    target.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "k",
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );
    await flushPromises();

    expect(useUiStore().commandPaletteOpen).toBe(true);
    target.remove();
    wrapper.unmount();
  });

  it("Ctrl+Shift+K 保留 Monaco 删除行快捷键，不打开命令面板", async () => {
    const wrapper = mount(CommandPalette, { attachTo: document.body });
    const event = new KeyboardEvent("keydown", {
      key: "K",
      ctrlKey: true,
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(event);
    await flushPromises();

    expect(useUiStore().commandPaletteOpen).toBe(false);
    expect(event.defaultPrevented).toBe(false);
    wrapper.unmount();
  });

  it("搜索并执行新建工作区命令", async () => {
    const wrapper = mount(CommandPalette, { attachTo: document.body });
    useUiStore().setCommandPaletteOpen(true);
    const input = await paletteInput();
    await typeQuery(input, "新建");
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

    await vi.waitFor(() => {
      expect(useWorkspaceStore().workspaces).toHaveLength(1);
    });
    expect(useUiStore().commandPaletteOpen).toBe(false);
    wrapper.unmount();
  });

  it("搜索文本工具并在当前工作区执行", async () => {
    const workspace = useWorkspaceStore();
    const id = workspace.createWorkspace();
    workspace.setLeft(id, "b\na");

    const wrapper = mount(CommandPalette, { attachTo: document.body });
    useUiStore().setCommandPaletteOpen(true);
    const input = await paletteInput();
    await typeQuery(input, "升序");
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

    await vi.waitFor(() => {
      expect(workspace.workspaces[0].left).toBe("a\nb");
    });
    wrapper.unmount();
  });
});
