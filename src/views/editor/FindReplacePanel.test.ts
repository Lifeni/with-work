import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { NDropdown, NSelect } from "naive-ui";
import FindReplacePanel from "@/views/editor/FindReplacePanel.vue";
import ToolbarVisibilityMenu from "@/components/shared/ToolbarVisibilityMenu.vue";
import { resetStores } from "@/test/resetStores";
import { createMockEditor } from "@/test/mockEditor";
import { useRulesStore } from "@/stores/rules";
import { useSettingsStore } from "@/stores/settings";
import { useTemplatesStore } from "@/stores/templates";
import { useToastStore } from "@/stores/toast";

beforeEach(() => {
  resetStores();
});

afterEach(() => {
  document.body.innerHTML = "";
});

function mountPanel(content = "hello world\nhello vue") {
  const focused = createMockEditor(content);
  const wrapper = mount(FindReplacePanel, {
    props: { focusedEditor: focused.editor },
  });
  return { wrapper, focused };
}

/** 触发输入并等待防抖（200ms） */
async function typeFind(wrapper: ReturnType<typeof mountPanel>["wrapper"], text: string) {
  const input = wrapper.find('input[placeholder="查找"]');
  await input.setValue(text);
  await new Promise((r) => setTimeout(r, 250));
  await wrapper.vm.$nextTick();
}

function dropdownForOption(wrapper: ReturnType<typeof mountPanel>["wrapper"], key: string) {
  const dropdown = wrapper
    .findAllComponents(NDropdown)
    .find((candidate) =>
      (candidate.props("options") as Array<{ key?: string }> | undefined)?.some(
        (option) => option.key === key,
      ),
    );
  if (!dropdown) throw new Error(`找不到包含 ${key} 的下拉菜单`);
  return dropdown;
}

function selectForPlaceholder(
  wrapper: ReturnType<typeof mountPanel>["wrapper"],
  placeholder: string,
) {
  const select = wrapper
    .findAllComponents(NSelect)
    .find((candidate) => candidate.props("placeholder") === placeholder);
  if (!select) throw new Error(`找不到占位文本为 ${placeholder} 的下拉选择`);
  return select;
}

describe("FindReplacePanel 查找", () => {
  it("查找、替换和筛选控件具有可访问名称", async () => {
    const { wrapper } = mountPanel();

    expect(wrapper.get('input[placeholder="查找"]').attributes("aria-label")).toBe("查找文本");
    expect(wrapper.get('input[placeholder="替换为"]').attributes("aria-label")).toBe("替换为");
    const ruleSelect = selectForPlaceholder(wrapper, "替换规则");
    expect(ruleSelect.props("inputProps")).toMatchObject({
      role: "combobox",
      "aria-label": "替换规则",
      "aria-autocomplete": "list",
      "aria-expanded": false,
    });
    expect(ruleSelect.props("filterable")).toBe(true);
    expect(ruleSelect.props("menuProps")).toMatchObject({
      role: "listbox",
      "aria-label": "替换规则",
    });
    expect(
      (ruleSelect.props("nodeProps") as (option: { value: string }) => Record<string, unknown>)({
        value: "rule-1",
      }),
    ).toMatchObject({
      role: "option",
      "aria-selected": "false",
    });

    const sortSelect = selectForPlaceholder(wrapper, "排序模板");
    expect(sortSelect.props("inputProps")).toMatchObject({
      role: "combobox",
      "aria-label": "排序模板",
      "aria-autocomplete": "list",
      "aria-expanded": false,
    });
    expect(sortSelect.props("filterable")).toBe(true);
    expect(sortSelect.props("menuProps")).toMatchObject({
      role: "listbox",
      "aria-label": "排序模板",
    });

    ruleSelect.vm.$emit("update:show", true);
    await wrapper.vm.$nextTick();
    expect(ruleSelect.props("inputProps")).toMatchObject({ "aria-expanded": true });
    wrapper.unmount();
  });

  it("无效正则使用 alert 实时播报", async () => {
    const { wrapper } = mountPanel();
    await wrapper.get('[aria-label="正则表达式"]').trigger("click");
    await typeFind(wrapper, "[");

    expect(wrapper.get('[role="alert"]').text()).toContain("正则表达式无效");
    wrapper.unmount();
  });

  it("输入查找词后显示匹配计数并自动高亮", async () => {
    const { wrapper } = mountPanel();
    await typeFind(wrapper, "hello");

    // 计数格式：当前 + 1 / 总数
    expect(wrapper.text()).toContain("1/2");
    // 输入继续变化时计数跟随
    await typeFind(wrapper, "hello world");
    expect(wrapper.text()).toContain("1/1");
    wrapper.unmount();
  });

  it("无匹配显示 0", async () => {
    const { wrapper } = mountPanel();
    await typeFind(wrapper, "不存在的内容");
    expect(wrapper.text()).toContain("0");
    expect(wrapper.get('[role="status"]').attributes("aria-label")).toBe("没有匹配项");
    wrapper.unmount();
  });
});

describe("FindReplacePanel 编辑器订阅", () => {
  it("切换聚焦编辑器时释放上一个编辑器的内容订阅", async () => {
    const first = createMockEditor("aaa");
    const second = createMockEditor("bbb");
    const wrapper = mount(FindReplacePanel, {
      props: { focusedEditor: first.editor },
    });
    expect(first.listenerCount()).toBe(1);

    await wrapper.setProps({ focusedEditor: second.editor });

    expect(first.listenerCount()).toBe(0);
    expect(second.listenerCount()).toBe(1);
    wrapper.unmount();
  });

  it("卸载时释放内容订阅", async () => {
    const focused = createMockEditor("aaa");
    const wrapper = mount(FindReplacePanel, {
      props: { focusedEditor: focused.editor },
    });
    expect(focused.listenerCount()).toBe(1);

    wrapper.unmount();

    expect(focused.listenerCount()).toBe(0);
  });

  it("同一编辑器换绑 Model（切换工作区）后订阅跟随到新 Model", async () => {
    const first = createMockEditor("aaa");
    const wrapper = mount(FindReplacePanel, {
      props: { focusedEditor: first.editor },
    });
    expect(first.listenerCount()).toBe(1);

    const next = createMockEditor("bbb");
    first.swapModel(next.model);

    expect(first.listenerCount()).toBe(0);
    expect(next.listenerCount()).toBe(1);

    wrapper.unmount();
    expect(next.listenerCount()).toBe(0);
  });

  it("换绑 Model 后按新 Model 重新搜索，不残留旧匹配", async () => {
    const first = createMockEditor("hello world");
    const wrapper = mount(FindReplacePanel, {
      props: { focusedEditor: first.editor },
    });
    await typeFind(wrapper, "hello");
    expect(wrapper.text()).toContain("1/1");

    // 切换工作区：同一编辑器实例换绑到没有匹配项的 Model
    first.swapModel(createMockEditor("没有匹配词").model);
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain("0");
    wrapper.unmount();
  });
});

describe("FindReplacePanel 替换", () => {
  it("全部替换把聚焦编辑器全部匹配替换", async () => {
    const { wrapper, focused } = mountPanel("a1\na2\na3");
    await typeFind(wrapper, "a");

    const replaceInput = wrapper.find('input[placeholder="替换为"]');
    await replaceInput.setValue("X");
    const btn = wrapper.findAll("button").find((b) => b.text() === "全部替换");
    await btn!.trigger("click");

    expect(focused.getValue()).toBe("X1\nX2\nX3");
    wrapper.unmount();
  });

  it("从替换规则下拉选择规则并应用", async () => {
    const store = useRulesStore();
    store.addRule({
      id: "r1",
      name: "测试规则",
      find: "vue",
      replace: "React",
      isRegex: false,
      matchCase: false,
    });
    const { wrapper } = mountPanel("hello vue");
    selectForPlaceholder(wrapper, "替换规则").vm.$emit("update:value", "r1");
    await wrapper.vm.$nextTick();

    // 规则应用后查找/替换输入框被填入
    expect((wrapper.find('input[placeholder="查找"]').element as HTMLInputElement).value).toBe(
      "vue",
    );
    expect((wrapper.find('input[placeholder="替换为"]').element as HTMLInputElement).value).toBe(
      "React",
    );
    wrapper.unmount();
  });
});

describe("FindReplacePanel 分割", () => {
  it("分割聚焦编辑器内容并原地更新", async () => {
    const { wrapper, focused } = mountPanel("a,b,c");
    dropdownForOption(wrapper, "comma").vm.$emit("select", "comma");
    await wrapper.vm.$nextTick();
    const btn = wrapper.findAll("button").find((b) => b.text() === "分割");
    await btn!.trigger("click");

    expect(focused.getValue()).toBe("a\nb\nc");
    wrapper.unmount();
  });

  it("未聚焦编辑器时提示", async () => {
    const wrapper = mount(FindReplacePanel, {
      props: { focusedEditor: null },
    });
    const btn = wrapper.findAll("button").find((b) => b.text() === "分割");
    await btn!.trigger("click");
    expect(useToastStore().toasts.some((t) => t.message.includes("请先点击"))).toBe(true);
    wrapper.unmount();
  });
});

describe("FindReplacePanel 组合", () => {
  it("把聚焦编辑器多行按所选组合符拼成一行并原地更新", async () => {
    const { wrapper, focused } = mountPanel("苹果\n香蕉\n橘子");
    dropdownForOption(wrapper, "cn-dunhao").vm.$emit("select", "cn-dunhao");
    await wrapper.vm.$nextTick();
    const btn = wrapper.findAll("button").find((b) => b.text() === "组合");
    expect(btn).toBeDefined();
    await btn!.trigger("click");

    expect(focused.getValue()).toBe("苹果、香蕉、橘子");
    wrapper.unmount();
  });

  it("自动检测不到组合符时提示且不修改编辑器", async () => {
    const { wrapper, focused } = mountPanel("苹果\n香蕉");
    const btn = wrapper.findAll("button").find((b) => b.text() === "组合");
    await btn!.trigger("click");

    expect(focused.getValue()).toBe("苹果\n香蕉");
    expect(useToastStore().toasts.some((t) => t.message.includes("组合符"))).toBe(true);
    wrapper.unmount();
  });

  it("支持选区：只组合选中的行", async () => {
    const focused = createMockEditor("苹果\n香蕉\n橘子", {
      selection: {
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: 2,
        endColumn: 3,
      },
    });
    const wrapper = mount(FindReplacePanel, {
      props: { focusedEditor: focused.editor },
    });
    dropdownForOption(wrapper, "comma").vm.$emit("select", "comma");
    await wrapper.vm.$nextTick();
    await wrapper
      .findAll("button")
      .find((b) => b.text() === "组合")!
      .trigger("click");

    expect(focused.getValue()).toBe("苹果,香蕉\n橘子");
    wrapper.unmount();
  });

  it("输入为空时提示且不清空编辑器", async () => {
    const focused = createMockEditor("   \n  ");
    const wrapper = mount(FindReplacePanel, {
      props: { focusedEditor: focused.editor },
    });

    await wrapper
      .findAll("button")
      .find((b) => b.text() === "组合")!
      .trigger("click");

    expect(focused.getValue()).toBe("   \n  ");
    expect(useToastStore().toasts.some((t) => t.message.includes("没有可处理"))).toBe(true);
    wrapper.unmount();
  });
});

describe("FindReplacePanel 分割边界", () => {
  it("输入为空时提示且不清空编辑器", async () => {
    const focused = createMockEditor("   ");
    const wrapper = mount(FindReplacePanel, {
      props: { focusedEditor: focused.editor },
    });

    await wrapper
      .findAll("button")
      .find((b) => b.text() === "分割")!
      .trigger("click");

    expect(focused.getValue()).toBe("   ");
    wrapper.unmount();
  });
});

describe("FindReplacePanel 组合提示", () => {
  it("组合符为换行时如实说明结果仍是多行", async () => {
    const { wrapper, focused } = mountPanel("苹果\n香蕉");
    dropdownForOption(wrapper, "newline").vm.$emit("select", "newline");
    await wrapper.vm.$nextTick();

    await wrapper
      .findAll("button")
      .find((b) => b.text() === "组合")!
      .trigger("click");

    const message = useToastStore()
      .toasts.map((t) => t.message)
      .join("|");
    expect(message).toContain("换行");
    expect(message).not.toContain("组合为一行");
    expect(focused.getValue()).toBe("苹果\n香蕉");
    wrapper.unmount();
  });

  it("输入只有一行时说明是原样保留", async () => {
    const { wrapper, focused } = mountPanel("只有一行");
    dropdownForOption(wrapper, "comma").vm.$emit("select", "comma");
    await wrapper.vm.$nextTick();

    await wrapper
      .findAll("button")
      .find((b) => b.text() === "组合")!
      .trigger("click");

    const message = useToastStore()
      .toasts.map((t) => t.message)
      .join("|");
    expect(message).toContain("1 行");
    expect(message).toContain("原样");
    expect(focused.getValue()).toBe("只有一行");
    wrapper.unmount();
  });
});

describe("FindReplacePanel 工具栏分组", () => {
  it("桌面工具栏始终单行，空间不足时横向滚动", () => {
    const { wrapper } = mountPanel();
    const toolbar = wrapper.get("[data-ww-toolbar]");
    expect(toolbar.classes()).toContain("flex-nowrap");
    expect(toolbar.classes()).toContain("overflow-x-auto");
    expect(toolbar.classes()).not.toContain("flex-wrap");
    wrapper.unmount();
  });

  it("默认展示查找、替换、分割组合、排序与自定义入口", () => {
    const { wrapper } = mountPanel();
    const groups = wrapper.findAll("[data-ww-group]");
    expect(groups.length).toBeGreaterThanOrEqual(6);
    expect(wrapper.find("[data-ww-item=find-options]").exists()).toBe(true);
    expect(wrapper.find("[data-ww-item=find-navigation]").exists()).toBe(true);
    expect(wrapper.find("[data-ww-group=replace-actions]").text()).toContain("全部替换");
    expect(wrapper.find("[data-ww-group=split-join]").text()).toContain("分割");
    expect(wrapper.find("[data-ww-group=split-join]").text()).toContain("组合");
    expect(wrapper.find("[data-ww-group=sort]").text()).toContain("排序");
    expect(wrapper.findComponent(ToolbarVisibilityMenu).exists()).toBe(true);
    wrapper.unmount();
  });

  it("按设置隐藏顶部功能组", () => {
    useSettingsStore().setHiddenEditorToolbarItems([
      "find-options",
      "replace-rules",
      "split-join",
      "sort-manage",
    ]);
    const { wrapper } = mountPanel();

    expect(wrapper.find("[data-ww-item=find-options]").exists()).toBe(false);
    expect(wrapper.find("[data-ww-item=replace-rules]").exists()).toBe(false);
    expect(wrapper.find("[data-ww-group=split-join]").exists()).toBe(false);
    expect(wrapper.find("[data-ww-item=sort-manage]").exists()).toBe(false);
    expect(wrapper.find('input[placeholder="查找"]').exists()).toBe(true);
    expect(wrapper.find('input[placeholder="替换为"]').exists()).toBe(true);
    wrapper.unmount();
  });

  it("排序模板管理入口与自定义菜单使用同一名称", () => {
    const { wrapper } = mountPanel();
    expect(wrapper.find('[aria-label="管理排序模板"]').exists()).toBe(true);
    expect(wrapper.find('[aria-label="管理排序规则"]').exists()).toBe(false);
    const visibilityMenu = wrapper.findComponent(ToolbarVisibilityMenu);
    const labels = (
      visibilityMenu.props("groups") as Array<{
        items: Array<{ id: string; label: string }>;
      }>
    )
      .flatMap((group) => group.items)
      .filter((item) => item.id.startsWith("sort"))
      .map((item) => item.label);
    expect(labels).toEqual(expect.arrayContaining(["排序模板", "管理排序模板"]));
    wrapper.unmount();
  });

  it("工具栏显示菜单的选择结果写入设置", async () => {
    const { wrapper } = mountPanel();
    const settings = useSettingsStore();
    wrapper
      .findComponent(ToolbarVisibilityMenu)
      .vm.$emit("update:hiddenIds", ["replace-rules", "sort-manage"]);
    await wrapper.vm.$nextTick();

    expect(settings.hiddenEditorToolbarItems).toEqual(["replace-rules", "sort-manage"]);
    wrapper.unmount();
  });

  it("查找与替换输入框按剩余空间收缩，不侵入后置控件", () => {
    const { wrapper } = mountPanel();
    const boxes = wrapper.findAll("[data-ww-input-box]");
    expect(boxes).toHaveLength(2);
    expect(boxes[0].classes()).toEqual(boxes[1].classes());
    expect(boxes[0].classes()).toContain("min-w-[7rem]");
    expect(boxes[0].classes()).not.toContain("min-w-0");
    expect(boxes[0].classes()).toContain("flex-1");
    expect(boxes[0].classes()).toContain("basis-0");
    expect(boxes[0].classes()).not.toContain("shrink-0");
    expect(boxes[0].classes()).not.toContain("w-72");
    expect(wrapper.find('[data-ww-input="find"]').classes()).toEqual(
      wrapper.find('[data-ww-input="replace"]').classes(),
    );
    expect(wrapper.find('[data-ww-input="find"]').classes()).toContain("min-w-0");
    expect(wrapper.find('[data-ww-input="find"]').classes()).not.toContain("min-w-[7rem]");
    const findGroup = wrapper.get("[data-ww-group=find]");
    expect(findGroup.classes()).toContain("flex-nowrap");
    expect(findGroup.get("[data-ww-item=find-options]").classes()).toContain("relative");
    expect(findGroup.get("[data-ww-item=find-navigation]").classes()).toContain("relative");
    expect(findGroup.classes()).toContain("min-w-min");
    expect(wrapper.get("[data-ww-group=replace]").classes()).toContain("min-w-min");
    wrapper.unmount();
  });

  it("下拉框触发器和选项菜单使用统一控件字号", () => {
    const { wrapper } = mountPanel();
    const ruleSelect = selectForPlaceholder(wrapper, "替换规则");
    const sortSelect = selectForPlaceholder(wrapper, "排序模板");

    for (const select of [ruleSelect, sortSelect]) {
      expect(select.classes()).toContain("ww-control-text");
      expect(select.props("bordered")).toBe(true);
      expect(select.props("menuSize")).toBe("small");
      expect(select.props("menuProps")).toMatchObject({ class: "ww-select-menu" });
    }
    expect(wrapper.get('[aria-label="选择分隔符"]').find(".font-mono").exists()).toBe(false);
    wrapper.unmount();
  });

  it("工具栏动作使用统一的尺寸、间距和分层强调样式", () => {
    const { wrapper } = mountPanel();
    const buttonByTitle = (title: string) => wrapper.get(`[aria-label="${title}"]`);

    for (const title of ["上一个", "下一个"]) {
      expect(buttonByTitle(title).classes()).toContain("n-button--tertiary-type");
    }
    expect(buttonByTitle("替换当前匹配").classes()).toContain("n-button--default-type");
    for (const title of ["全部替换", "分割", "组合", "排序"]) {
      expect(buttonByTitle(title).classes()).toContain("n-button--primary-type");
    }
    expect(buttonByTitle("选择分隔符").classes()).toContain("n-button--tertiary-type");
    for (const title of ["替换当前匹配", "全部替换", "分割", "组合", "排序", "选择分隔符"]) {
      expect(buttonByTitle(title).classes()).not.toContain("text-[11px]");
    }
    expect(wrapper.get("[data-ww-group=replace-actions]").classes()).toContain("gap-2");
    expect(wrapper.get("[data-ww-group=split-join]").classes()).toContain("gap-2");
    expect(wrapper.get("[data-ww-group=split-join]").find(".n-button-group").exists()).toBe(false);
    wrapper.unmount();
  });
});

describe("FindReplacePanel 排序", () => {
  it("无模板时按升序排序，再点一次降序", async () => {
    const { wrapper, focused } = mountPanel("banana\napple\ncherry");
    const btn = wrapper.findAll("button").find((b) => b.text() === "排序");

    await btn!.trigger("click");
    expect(focused.getValue()).toBe("apple\nbanana\ncherry");
    await btn!.trigger("click");
    expect(focused.getValue()).toBe("cherry\nbanana\napple");
    wrapper.unmount();
  });

  it("选择排序模板后按模板顺序原地排序，未匹配项保留在末尾", async () => {
    const store = useTemplatesStore();
    store.addTemplate({
      id: "t1",
      name: "城市",
      items: ["济南", "青岛"],
      prefixMatch: false,
    });
    const { wrapper, focused } = mountPanel("青岛\n北京\n济南");
    selectForPlaceholder(wrapper, "排序模板").vm.$emit("update:value", "t1");
    await wrapper.vm.$nextTick();
    const btn = wrapper.findAll("button").find((b) => b.text() === "排序");
    await btn!.trigger("click");

    expect(focused.getValue()).toBe("济南\n青岛\n北京");
    wrapper.unmount();
  });

  it("模板匹配不到任何项目时提示且不修改内容", async () => {
    const store = useTemplatesStore();
    store.addTemplate({ id: "t1", name: "城市", items: ["济南"] });
    const { wrapper, focused } = mountPanel("苹果\n香蕉");
    selectForPlaceholder(wrapper, "排序模板").vm.$emit("update:value", "t1");
    await wrapper.vm.$nextTick();
    const btn = wrapper.findAll("button").find((b) => b.text() === "排序");
    await btn!.trigger("click");

    expect(focused.getValue()).toBe("苹果\n香蕉");
    expect(useToastStore().toasts.some((t) => t.message.includes("没有匹配的项目"))).toBe(true);
    wrapper.unmount();
  });
});
