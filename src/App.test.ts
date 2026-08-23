import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import App from "@/App.vue";
import { resetStores } from "@/test/resetStores";
import { useWorkspaceStore } from "@/stores/workspace";

// 真实 Monaco 编辑器在测试环境不可用，替换为 stub（异步工厂避免提升时序问题）
vi.mock("@/components/shared/MonacoEditor.vue", async () => {
  const { monacoEditorStub } = await import("@/test/stubs");
  return { default: monacoEditorStub };
});
vi.mock("@/components/shared/DiffEditor.vue", async () => {
  const { diffEditorStub } = await import("@/test/stubs");
  return { default: diffEditorStub };
});

beforeEach(() => {
  resetStores();
});

const tick = () => new Promise((r) => setTimeout(r, 20));

describe("App 整体布局", () => {
  it("渲染导航栏、标题栏、编辑器与暂存区", async () => {
    const wrapper = mount(App, { attachTo: document.body });
    await nextTick();

    expect(wrapper.text()).toContain("一点微小的工作");
    expect(wrapper.text()).toContain("With Work");
    expect(wrapper.text()).toContain("全局暂存区");
    expect(document.body.querySelectorAll(".monaco-editor-stub").length).toBe(2);
    expect(wrapper.text()).toContain("已自动保存");
    wrapper.unmount();
  });

  it("没有工作区时自动创建一个", async () => {
    const wrapper = mount(App, { attachTo: document.body });
    await nextTick();
    expect(useWorkspaceStore().workspaces.length).toBeGreaterThanOrEqual(1);
    wrapper.unmount();
  });

  it("点击设置按钮打开设置弹窗", async () => {
    const wrapper = mount(App, { attachTo: document.body });
    await tick();
    await wrapper.get('[aria-label="设置"]').trigger("click");
    await tick();

    const dialog = document.querySelector(".ww-dialog-content");
    expect(dialog?.textContent).toContain("设置");
    expect(dialog?.textContent).toContain("外观");
    wrapper.unmount();
  });

  it("顶部新建工作区按钮创建第二个工作区", async () => {
    const wrapper = mount(App, { attachTo: document.body });
    await tick();
    await wrapper.get('[title="新建工作区"]').trigger("click");
    await nextTick();
    expect(useWorkspaceStore().workspaces).toHaveLength(2);
    wrapper.unmount();
  });
});

describe("App 底部状态栏", () => {
  it("显示当前工作区名称与暂存区计数", async () => {
    const wrapper = mount(App, { attachTo: document.body });
    await tick();
    expect(wrapper.text()).toContain("工作区 1");
    expect(wrapper.text()).toContain("暂存区 (0)");
    wrapper.unmount();
  });

  it("切换主题菜单不影响布局", async () => {
    const wrapper = mount(App, { attachTo: document.body });
    await tick();
    await wrapper.get('[aria-label="切换主题"]').trigger("click");
    await tick();
    expect(document.querySelectorAll("[data-dropdown-item]").length).toBeGreaterThan(0);
    wrapper.unmount();
  });
});
