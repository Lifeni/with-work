import { afterEach, describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { NPopover } from "naive-ui";
import { nextTick } from "vue";
import { Filter } from "@vicons/tabler";
import ToolbarVisibilityMenu from "@/components/shared/ToolbarVisibilityMenu.vue";

const groups = [
  {
    key: "replace",
    label: "查找与替换",
    items: [
      { id: "find-options", label: "查找选项", icon: Filter },
      { id: "replace-rules", label: "替换规则" },
    ],
  },
  {
    key: "text",
    label: "文本处理",
    items: [{ id: "split-join", label: "分割与组合" }],
  },
];

afterEach(() => {
  document.body.innerHTML = "";
});

async function mountOpen(hiddenIds: string[] = []) {
  const wrapper = mount(ToolbarVisibilityMenu, {
    attachTo: document.body,
    props: { groups, hiddenIds },
  });
  await wrapper.get('[aria-label="自定义工具栏"]').trigger("click");
  await nextTick();
  await new Promise((resolve) => setTimeout(resolve, 20));
  await nextTick();
  return wrapper;
}

describe("ToolbarVisibilityMenu", () => {
  it("把已显示项转换为隐藏项并通知父组件", async () => {
    const wrapper = await mountOpen();
    const checkboxes = [...document.body.querySelectorAll<HTMLElement>('[role="checkbox"]')];
    expect(checkboxes).toHaveLength(3);
    expect(checkboxes.every((checkbox) => checkbox.getAttribute("aria-checked") === "true")).toBe(
      true,
    );

    checkboxes[0].click();
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted("update:hiddenIds")?.[0]).toEqual([["find-options"]]);
  });

  it("隐藏项不会出现在多选值中", async () => {
    await mountOpen(["replace-rules", "split-join"]);

    const checkboxes = [...document.body.querySelectorAll<HTMLElement>('[role="checkbox"]')];
    expect(checkboxes.map((checkbox) => checkbox.getAttribute("aria-checked"))).toEqual([
      "true",
      "false",
      "false",
    ]);
  });

  it("提供始终可见的工具栏自定义入口", () => {
    const wrapper = mount(ToolbarVisibilityMenu, {
      props: { groups, hiddenIds: [] },
    });

    expect(wrapper.find('[aria-label="自定义工具栏"]').exists()).toBe(true);
  });

  it("触发按钮直接把图标放在按钮内容中，避免额外容器造成偏移", () => {
    const wrapper = mount(ToolbarVisibilityMenu, {
      props: { groups, hiddenIds: [] },
    });

    const content = wrapper.get('[aria-label="自定义工具栏"] .n-button__content');
    expect(content.element.children).toHaveLength(1);
    expect(content.element.firstElementChild?.tagName.toLowerCase()).toBe("svg");
  });

  it("使用可键盘操作的 Naive UI 浮层与复选框组", async () => {
    const wrapper = mount(ToolbarVisibilityMenu, {
      props: { groups, hiddenIds: [] },
    });

    const popover = wrapper
      .findAllComponents(NPopover)
      .find((component) => component.props("trigger") === "manual");
    expect(popover?.props("trigger")).toBe("manual");
    expect(wrapper.get('[aria-label="自定义工具栏"]').attributes("aria-expanded")).toBe("false");

    await mountOpen();
    expect(document.body.querySelector(".n-checkbox-group")).not.toBeNull();
  });

  it("打开后聚焦首个复选项，Esc 关闭并把焦点还给触发按钮", async () => {
    const wrapper = await mountOpen();
    expect(document.activeElement?.getAttribute("role")).toBe("checkbox");

    const menu = document.body.querySelector<HTMLElement>('[role="dialog"]');
    menu?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await nextTick();
    await nextTick();

    expect(wrapper.get('[aria-label="自定义工具栏"]').attributes("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(wrapper.get('[aria-label="自定义工具栏"]').element);
    wrapper.unmount();
  });

  it("点击菜单和触发按钮之外会关闭菜单", async () => {
    const wrapper = await mountOpen();

    document.body.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    await nextTick();

    expect(wrapper.get('[aria-label="自定义工具栏"]').attributes("aria-expanded")).toBe("false");
    wrapper.unmount();
  });

  it("操作按钮位于菜单底部并两端分布", async () => {
    const wrapper = await mountOpen();

    const actions = document.body.querySelector("[data-ww-menu-actions]");
    expect(actions).not.toBeNull();
    expect(actions?.classList.contains("justify-between")).toBe(true);
    const buttons = Array.from(actions?.querySelectorAll("button") ?? []);
    expect(buttons.map((button) => button.textContent?.trim())).toEqual(["全部显示", "恢复默认"]);
    expect(
      document.body.querySelector('[role="dialog"][aria-label="工具栏显示项"]'),
    ).not.toBeNull();
    expect(document.body.querySelectorAll('[role="checkbox"]')).toHaveLength(3);
    wrapper.unmount();
  });

  it("有图标的菜单项在文字左侧渲染图标", async () => {
    const wrapper = await mountOpen();

    const option = document.body.querySelector('[data-ww-menu-option="find-options"]');
    expect(option).not.toBeNull();
    expect(option?.querySelector("svg")).not.toBeNull();
    wrapper.unmount();
  });

  it("菜单内容使用项目专用 class 控制分组标题字号", () => {
    const wrapper = mount(ToolbarVisibilityMenu, {
      props: { groups, hiddenIds: [] },
    });

    expect(
      wrapper
        .findAllComponents(NPopover)
        .find((component) => component.props("trigger") === "manual")
        ?.props("contentClass"),
    ).toBe("ww-toolbar-visibility-menu");
  });
});
