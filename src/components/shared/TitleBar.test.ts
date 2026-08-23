import { beforeEach, describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import TitleBar from "@/components/shared/TitleBar.vue";
import { resetStores } from "@/test/resetStores";
import { useSettingsStore } from "@/stores/settings";
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

    await wrapper.get('[title="新建工作区"]').trigger("click");
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

describe("TitleBar 编辑操作与外观", () => {
  it("撤销 / 重做 / 自动换行按钮存在且可切换换行", async () => {
    const settings = useSettingsStore();
    const wrapper = mountBar();

    expect(wrapper.find('[title="撤销 (Ctrl+Z)"]').exists()).toBe(true);
    expect(wrapper.find('[title="重做"]').exists()).toBe(true);

    const wrap = wrapper.get('[title^="自动换行"]');
    await wrap.trigger("click");
    expect(settings.wordWrap).toBe(false);
    await wrap.trigger("click");
    expect(settings.wordWrap).toBe(true);
  });

  it("主题菜单：点击切换主题选项", async () => {
    const settings = useSettingsStore();
    settings.setTheme("light");
    const wrapper = mountBar();

    await wrapper.get('[title="切换主题"]').trigger("click");
    await new Promise((r) => setTimeout(r, 50));
    // n-dropdown 菜单渲染到 body，菜单项为 .n-dropdown-option
    const items = [...document.querySelectorAll(".n-dropdown-option")];
    const dark = items.find((el) => el.textContent?.includes("深色"));
    expect(dark).toBeDefined();
    // Naive 的 onClick 绑定在内层 .n-dropdown-option-body 上
    const body = dark!.querySelector(".n-dropdown-option-body") ?? dark!;
    body.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 50));
    expect(settings.theme).toBe("dark");
  });

  it("设置按钮切换设置弹窗开关", async () => {
    const wrapper = mountBar();
    const btn = wrapper.get('[title="设置"]');
    await btn.trigger("click");
    expect(btn.attributes("aria-pressed")).toBe("true");
    await btn.trigger("click");
    expect(btn.attributes("aria-pressed")).toBe("false");
  });
});
