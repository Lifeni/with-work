import { beforeEach, describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import FloatingEditorToolbar from "@/components/shared/FloatingEditorToolbar.vue";
import { resetStores } from "@/test/resetStores";
import { useWorkspaceStore } from "@/stores/workspace";

beforeEach(() => {
  resetStores();
});

function mountToolbar() {
  return mount(FloatingEditorToolbar, { attachTo: document.body });
}

describe("FloatingEditorToolbar 悬浮工具栏", () => {
  it("渲染文本工具与撤销/重做按钮（无自动换行）", () => {
    const wrapper = mountToolbar();
    expect(wrapper.find('[aria-label="行排序 · 升序"]').exists()).toBe(true);
    expect(wrapper.find('[aria-label="删除空行"]').exists()).toBe(true);
    expect(wrapper.find('[aria-label="撤销 (Ctrl+Z)"]').exists()).toBe(true);
    expect(wrapper.find('[aria-label="重做"]').exists()).toBe(true);
    expect(wrapper.find('[aria-label^="自动换行"]').exists()).toBe(false);
    // 隐藏工具（分割为列表、按规则替换）不出现
    expect(wrapper.find('[aria-label="分割为列表"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it("文本工具：点击升序排序作用于当前工作区内容", async () => {
    const store = useWorkspaceStore();
    const id = store.createWorkspace();
    store.setLeft(id, "b\na\nc");
    const wrapper = mountToolbar();

    await wrapper.get('[aria-label="行排序 · 升序"]').trigger("click");
    // 无编辑器实例时 applyTool 回退到工作区 store
    expect(store.workspaces[0].left).toBe("a\nb\nc");
    wrapper.unmount();
  });
});
