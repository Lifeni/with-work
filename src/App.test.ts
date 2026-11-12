import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { NConfigProvider } from "naive-ui";
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

  it("提供页面主标题和跳到编辑器的键盘捷径", async () => {
    const wrapper = mount(App, { attachTo: document.body });
    await tick();

    expect(wrapper.get("h1").text()).toBe("一点微小的工作");
    expect(wrapper.get('a[href="#ww-editor-main"]').text()).toBe("跳到编辑器");
    expect(wrapper.get("main").attributes("id")).toBe("ww-editor-main");
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
    await wrapper.get('[aria-label="新建工作区"]').trigger("click");
    await nextTick();
    expect(useWorkspaceStore().workspaces).toHaveLength(2);
    wrapper.unmount();
  });

  it("左右复制按钮使用可区分的方向名称", async () => {
    const wrapper = mount(App, { attachTo: document.body });
    await tick();

    expect(wrapper.find('[aria-label="复制左编辑器到右编辑器"]').exists()).toBe(true);
    expect(wrapper.find('[aria-label="复制右编辑器到左编辑器"]').exists()).toBe(true);
    expect(wrapper.find('[aria-label="复制到另一侧"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it("统一输入、选择和下拉菜单的控件字号与弹层样式", async () => {
    const wrapper = mount(App, { attachTo: document.body });
    await nextTick();

    expect(wrapper.findComponent(NConfigProvider).props("themeOverrides")).toMatchObject({
      Input: {
        fontSizeSmall: "12px",
      },
      Dropdown: {
        fontSizeSmall: "12px",
        optionHeightSmall: "28px",
      },
      Select: {
        peers: {
          InternalSelection: {
            fontSizeSmall: "12px",
          },
          InternalSelectMenu: {
            optionFontSizeSmall: "12px",
            optionHeightSmall: "28px",
          },
        },
      },
      Radio: {
        fontSizeSmall: "12px",
      },
    });
    const overrides = wrapper.findComponent(NConfigProvider).props("themeOverrides") as {
      Dropdown: Record<string, unknown>;
      Select: {
        peers: { InternalSelectMenu: Record<string, unknown> };
      };
    };
    expect(overrides.Dropdown).not.toHaveProperty("borderRadius");
    expect(overrides.Select).not.toHaveProperty("menuBoxShadow");
    expect(overrides.Select.peers.InternalSelectMenu).not.toHaveProperty("borderRadius");
    wrapper.unmount();
  });
});

describe("App 底部状态栏", () => {
  it("显示当前工作区名称，并以非打断式状态播报自动保存", async () => {
    const wrapper = mount(App, { attachTo: document.body });
    await tick();
    expect(wrapper.text()).toContain("工作区 1");
    expect(wrapper.text()).toContain("已自动保存");
    const saveStatus = wrapper.get("footer [role='status']");
    expect(saveStatus.attributes("aria-live")).toBe("polite");
    expect(saveStatus.text()).toContain("已自动保存");
    wrapper.unmount();
  });
});
