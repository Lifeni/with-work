import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { NDropdown } from "naive-ui";
import TitleBar from "@/components/shared/TitleBar.vue";
import ConfirmDialog from "@/components/shared/ConfirmDialog.vue";
import TooltipIconButton from "@/components/ui/tooltip-icon-button.vue";
import { resetStores } from "@/test/resetStores";
import { useWorkspaceStore } from "@/stores/workspace";

beforeEach(() => {
  resetStores();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function mountBar() {
  const wrapper = mount(TitleBar, { attachTo: document.body });
  return wrapper;
}

describe("TitleBar 工作区标签", () => {
  it("渲染全部工作区并高亮激活项", () => {
    const store = useWorkspaceStore();
    store.createWorkspace(); // 工作区 1
    const id2 = store.createWorkspace(); // 工作区 2
    store.setActive(id2);

    const wrapper = mountBar();
    const tabs = wrapper.findAll('[role="tab"]');
    expect(tabs).toHaveLength(2);
    expect(tabs[1].text()).toContain("工作区 2");
    expect(tabs[1].attributes("aria-selected")).toBe("true");
  });

  it("点击新建按钮创建工作区并激活", async () => {
    const store = useWorkspaceStore();
    store.createWorkspace();
    const wrapper = mountBar();

    await wrapper.get('[aria-label="新建工作区"]').trigger("click");
    expect(store.workspaces).toHaveLength(2);
    expect(store.activeId).toBe(store.workspaces[1].id);
    // 新增 tab 出现在列表中
    await wrapper.vm.$nextTick();
    expect(wrapper.findAll('[role="tab"]')).toHaveLength(2);
  });

  it("点击 tab 切换激活工作区", async () => {
    const store = useWorkspaceStore();
    const id1 = store.createWorkspace();
    const id2 = store.createWorkspace();
    store.setActive(id1);
    const wrapper = mountBar();

    await wrapper.findAll('[role="tab"]')[1].trigger("click");
    expect(store.activeId).toBe(id2);
  });

  it("标签使用 tablist 语义，并支持方向键切换", async () => {
    const store = useWorkspaceStore();
    const id1 = store.createWorkspace();
    const id2 = store.createWorkspace();
    store.setActive(id1);
    const wrapper = mountBar();

    expect(wrapper.get('[role="tablist"]').attributes("aria-label")).toBe("工作区标签");
    let tabs = wrapper.findAll('[role="tab"]');
    expect(tabs[0].attributes("tabindex")).toBe("0");
    expect(tabs[1].attributes("tabindex")).toBe("-1");
    expect(tabs[0].attributes("aria-label")).toBe("工作区 1");

    await tabs[0].trigger("keydown", { key: "ArrowRight" });
    await nextTick();
    tabs = wrapper.findAll('[role="tab"]');

    expect(store.activeId).toBe(id2);
    expect(tabs[1].attributes("tabindex")).toBe("0");
    wrapper.unmount();
  });

  it("标签页支持 Home / End 并移动实际焦点", async () => {
    const store = useWorkspaceStore();
    const id1 = store.createWorkspace();
    store.createWorkspace();
    store.createWorkspace();
    store.setActive(id1);
    const wrapper = mountBar();

    const first = wrapper.findAll('[role="tab"]')[0];
    await first.trigger("keydown", { key: "End" });
    await nextTick();

    expect(store.activeId).toBe(store.workspaces[2].id);
    expect(document.activeElement).toBe(wrapper.findAll('[role="tab"]')[2].element);
    wrapper.unmount();
  });

  it("双击 tab 进入重命名，回车提交", async () => {
    const store = useWorkspaceStore();
    store.createWorkspace();
    const wrapper = mountBar();

    await wrapper.get('[role="tab"]').trigger("dblclick");
    const input = wrapper.get("header input.text-xs");
    await input.setValue("重命名后");
    await input.trigger("keydown", { key: "Enter" });

    expect(store.workspaces[0].name).toBe("重命名后");
    expect(wrapper.find("header input.text-xs").exists()).toBe(false);
  });

  it("点击关闭按钮删除工作区", async () => {
    const store = useWorkspaceStore();
    store.createWorkspace();
    const wrapper = mountBar();

    await wrapper.get('[aria-label="关闭工作区"]').trigger("click");
    expect(store.workspaces).toHaveLength(0);
  });

  it("标准标签关闭按钮不使用 tooltip", () => {
    const store = useWorkspaceStore();
    store.createWorkspace();
    const wrapper = mountBar();

    expect(wrapper.findComponent(TooltipIconButton).exists()).toBe(false);
    const closeButton = wrapper.get('[aria-label="关闭工作区"]');
    expect(closeButton.attributes("title")).toBeUndefined();
    expect(closeButton.classes()).toContain("size-6");
    wrapper.unmount();
  });

  it("右键标签会激活目标并显示 Naive 右键菜单", async () => {
    const store = useWorkspaceStore();
    const first = store.createWorkspace();
    store.createWorkspace();
    const wrapper = mountBar();

    await wrapper.findAll('[role="tab"]')[0].trigger("contextmenu", {
      clientX: 96,
      clientY: 28,
    });
    await nextTick();

    const menu = wrapper.findComponent(NDropdown);
    expect(store.activeId).toBe(first);
    expect(menu.props("show")).toBe(true);
    expect(menu.props("x")).toBe(96);
    expect(menu.props("y")).toBe(28);
    expect(JSON.stringify(menu.props("options"))).toContain("关闭其他");
    expect(JSON.stringify(menu.props("options"))).toContain("关闭右侧");
    wrapper.unmount();
  });

  it("右键菜单可重命名目标标签", async () => {
    const store = useWorkspaceStore();
    store.createWorkspace();
    const wrapper = mountBar();

    await wrapper.get('[role="tab"]').trigger("contextmenu");
    wrapper.findComponent(NDropdown).vm.$emit("select", "rename");
    await nextTick();

    expect(wrapper.find("header input.text-xs").exists()).toBe(true);
    wrapper.unmount();
  });

  it("关闭其他工作区保留右键目标", async () => {
    const store = useWorkspaceStore();
    store.createWorkspace();
    const target = store.createWorkspace();
    store.createWorkspace();
    const wrapper = mountBar();

    await wrapper.findAll('[role="tab"]')[1].trigger("contextmenu");
    wrapper.findComponent(NDropdown).vm.$emit("select", "close-others");
    await nextTick();

    expect(store.workspaces.map((w) => w.id)).toEqual([target]);
    expect(store.activeId).toBe(target);
    wrapper.unmount();
  });

  it("关闭右侧工作区只删除目标之后的工作区", async () => {
    const store = useWorkspaceStore();
    const first = store.createWorkspace();
    store.createWorkspace();
    store.createWorkspace();
    const wrapper = mountBar();

    await wrapper.findAll('[role="tab"]')[0].trigger("contextmenu");
    wrapper.findComponent(NDropdown).vm.$emit("select", "close-right");
    await nextTick();

    expect(store.workspaces.map((w) => w.id)).toEqual([first]);
    wrapper.unmount();
  });

  it("右键关闭有内容的工作区时先确认", async () => {
    const store = useWorkspaceStore();
    const id = store.createWorkspace();
    store.setLeft(id, "未保存内容");
    const wrapper = mountBar();

    await wrapper.get('[role="tab"]').trigger("contextmenu");
    wrapper.findComponent(NDropdown).vm.$emit("select", "close");
    await nextTick();

    expect(store.workspaces).toHaveLength(1);
    const confirm = wrapper
      .findAllComponents(ConfirmDialog)
      .find((dialog) => dialog.props("open") === true);
    expect(confirm?.props("description")).toContain("关闭后");
    wrapper.unmount();
  });
});

describe("TitleBar 暂存区开关", () => {
  it("点击按钮切换暂存区展开/收起", async () => {
    const { useUiStore } = await import("@/stores/ui");
    const ui = useUiStore();
    ui.setStagingOpen(false);
    const wrapper = mountBar();

    const btn = wrapper.get('[aria-label="展开暂存区"]');
    expect(btn.attributes("aria-controls")).toBe("ww-staging-panel");
    expect(btn.attributes("aria-expanded")).toBe("false");
    await btn.trigger("click");
    expect(ui.stagingOpen).toBe(true);
    // 收起状态图标语义切换
    expect(wrapper.get('[aria-label="收起暂存区"]').attributes("aria-expanded")).toBe("true");
    wrapper.unmount();
  });

  it("窄屏打开暂存区后把焦点送入抽屉", async () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: true,
      media: "(max-width: 1023px)",
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    });
    document.body.insertAdjacentHTML(
      "beforeend",
      '<div id="ww-staging-panel"><button type="button" aria-label="折叠暂存区"></button></div>',
    );
    const { useUiStore } = await import("@/stores/ui");
    useUiStore().setStagingOpen(false);
    const wrapper = mountBar();

    await wrapper.get('[aria-label="展开暂存区"]').trigger("click");
    await nextTick();

    expect(document.activeElement?.getAttribute("aria-label")).toBe("折叠暂存区");
    wrapper.unmount();
  });
});
