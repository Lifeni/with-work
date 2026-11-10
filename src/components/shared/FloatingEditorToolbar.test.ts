import { beforeEach, describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { NDropdown } from "naive-ui";
import FloatingEditorToolbar from "@/components/shared/FloatingEditorToolbar.vue";
import ToolbarVisibilityMenu from "@/components/shared/ToolbarVisibilityMenu.vue";
import { resetStores } from "@/test/resetStores";
import { useSettingsStore } from "@/stores/settings";
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
    expect(wrapper.find('[aria-label="去除空格和 Tab"]').exists()).toBe(true);
    expect(wrapper.find('[aria-label="撤销 (Ctrl+Z)"]').exists()).toBe(true);
    expect(wrapper.find('[aria-label="重做"]').exists()).toBe(true);
    expect(wrapper.find('[aria-label^="自动换行"]').exists()).toBe(false);
    // 隐藏工具（分割为列表、按规则替换）不出现
    expect(wrapper.find('[aria-label="分割为列表"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it("默认隐藏与顶部重复的分割和规则工具，但会加入自定义菜单", () => {
    const wrapper = mountToolbar();
    expect(wrapper.find('[aria-label="分割为列表"]').exists()).toBe(false);
    expect(wrapper.find('[aria-label="按规则替换"]').exists()).toBe(false);
    const menu = wrapper.findComponent(ToolbarVisibilityMenu);
    expect(menu.exists()).toBe(true);
    expect(menu.props("hiddenIds")).toEqual(["split-list", "apply-rule"]);
    wrapper.unmount();
  });

  it("按设置隐藏普通文本工具", () => {
    useSettingsStore().setHiddenTextToolIds(["lines-dedupe", "text-upper"]);
    const wrapper = mountToolbar();

    expect(wrapper.find('[aria-label="去重行"]').exists()).toBe(false);
    expect(wrapper.find('[aria-label="转大写"]').exists()).toBe(false);
    expect(wrapper.find('[aria-label="删除空行"]').exists()).toBe(true);
    wrapper.unmount();
  });

  it("工具栏显示菜单的选择结果写入设置", async () => {
    const wrapper = mountToolbar();
    const settings = useSettingsStore();
    wrapper.findComponent(ToolbarVisibilityMenu).vm.$emit("update:hiddenIds", ["lines-dedupe"]);
    await wrapper.vm.$nextTick();

    expect(settings.hiddenTextToolIds).toEqual(["lines-dedupe"]);
    wrapper.unmount();
  });

  it("右键工具可打开 Naive UI 菜单并从工具栏隐藏", async () => {
    const wrapper = mountToolbar();
    const settings = useSettingsStore();
    const tool = wrapper.get('[aria-label="去重行"]');

    await tool.trigger("contextmenu", { clientX: 48, clientY: 72 });
    await nextTick();

    const menu = wrapper.findComponent(NDropdown);
    expect(menu.props("show")).toBe(true);
    expect(menu.props("x")).toBe(48);
    expect(menu.props("y")).toBe(72);
    expect(JSON.stringify(menu.props("options"))).toContain("从工具栏隐藏");

    menu.vm.$emit("select", "hide");
    await nextTick();

    expect(settings.hiddenTextToolIds).toContain("lines-dedupe");
    expect(wrapper.find('[aria-label="去重行"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it("键盘 ContextMenu / Shift+F10 可打开工具菜单", async () => {
    const wrapper = mountToolbar();
    const tool = wrapper.get('[aria-label="去重行"]');

    await tool.trigger("keydown", { key: "ContextMenu" });
    await nextTick();
    let menu = wrapper.findComponent(NDropdown);
    expect(menu.props("show")).toBe(true);

    menu.vm.$emit("update:show", false);
    await tool.trigger("keydown", { key: "F10", shiftKey: true });
    await nextTick();
    menu = wrapper.findComponent(NDropdown);
    expect(menu.props("show")).toBe(true);
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
