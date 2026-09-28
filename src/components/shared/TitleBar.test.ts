import { beforeEach, describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import TitleBar from "@/components/shared/TitleBar.vue";
import { resetStores } from "@/test/resetStores";
import { useWorkspaceStore } from "@/stores/workspace";

beforeEach(() => {
  resetStores();
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

    await wrapper.get('[title="关闭工作区"]').trigger("click");
    expect(store.workspaces).toHaveLength(0);
  });
});

describe("TitleBar 暂存区开关", () => {
  it("点击按钮切换暂存区展开/收起", async () => {
    const { useUiStore } = await import("@/stores/ui");
    const ui = useUiStore();
    ui.setStagingOpen(false);
    const wrapper = mountBar();

    const btn = wrapper.get('[aria-label="展开暂存区"]');
    await btn.trigger("click");
    expect(ui.stagingOpen).toBe(true);
    // 收起状态图标语义切换
    expect(wrapper.find('[aria-label="收起暂存区"]').exists()).toBe(true);
    wrapper.unmount();
  });
});
