import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import FindReplacePanel from "@/views/editor/FindReplacePanel.vue";
import { resetStores } from "@/test/resetStores";
import { createMockEditor } from "@/test/mockEditor";
import { useRulesStore } from "@/stores/rules";
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
  const other = createMockEditor("");
  const wrapper = mount(FindReplacePanel, {
    props: { focusedEditor: focused.editor, otherEditor: other.editor },
  });
  return { wrapper, focused, other };
}

/** 触发输入并等待防抖（200ms） */
async function typeFind(wrapper: ReturnType<typeof mountPanel>["wrapper"], text: string) {
  const input = wrapper.find('input[placeholder="查找"]');
  await input.setValue(text);
  await new Promise((r) => setTimeout(r, 250));
  await wrapper.vm.$nextTick();
}

describe("FindReplacePanel 查找", () => {
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
    wrapper.unmount();
  });
});

describe("FindReplacePanel 编辑器订阅", () => {
  it("切换聚焦编辑器时释放上一个编辑器的内容订阅", async () => {
    const first = createMockEditor("aaa");
    const second = createMockEditor("bbb");
    const wrapper = mount(FindReplacePanel, {
      props: { focusedEditor: first.editor, otherEditor: second.editor },
    });
    expect(first.listenerCount()).toBe(1);

    await wrapper.setProps({ focusedEditor: second.editor, otherEditor: first.editor });

    expect(first.listenerCount()).toBe(0);
    expect(second.listenerCount()).toBe(1);
    wrapper.unmount();
  });

  it("卸载时释放内容订阅", async () => {
    const focused = createMockEditor("aaa");
    const wrapper = mount(FindReplacePanel, {
      props: { focusedEditor: focused.editor, otherEditor: null },
    });
    expect(focused.listenerCount()).toBe(1);

    wrapper.unmount();

    expect(focused.listenerCount()).toBe(0);
  });

  it("同一编辑器换绑 Model（切换工作区）后订阅跟随到新 Model", async () => {
    const first = createMockEditor("aaa");
    const wrapper = mount(FindReplacePanel, {
      props: { focusedEditor: first.editor, otherEditor: null },
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
      props: { focusedEditor: first.editor, otherEditor: null },
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
    const select = wrapper.find('select[title="替换规则"]');
    await select.setValue("r1");

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
  it("分割聚焦编辑器内容并写入另一侧", async () => {
    const { wrapper, other } = mountPanel("a,b,c");
    // 聚焦编辑器需要内容留在 model（mountPanel 已创建）
    const select = wrapper.find('select[title="分割 / 组合分隔符"]');
    await select.setValue("comma");
    const btn = wrapper.findAll("button").find((b) => b.text() === "分割");
    await btn!.trigger("click");

    expect(other.getValue()).toBe("a\nb\nc");
    wrapper.unmount();
  });

  it("未聚焦编辑器时提示", async () => {
    const wrapper = mount(FindReplacePanel, {
      props: { focusedEditor: null, otherEditor: null },
    });
    const btn = wrapper.findAll("button").find((b) => b.text() === "分割");
    await btn!.trigger("click");
    expect(useToastStore().toasts.some((t) => t.message.includes("请先点击"))).toBe(true);
    wrapper.unmount();
  });
});

describe("FindReplacePanel 组合", () => {
  it("把聚焦编辑器多行按所选组合符拼成一行写入另一侧，源内容不动", async () => {
    const { wrapper, focused, other } = mountPanel("苹果\n香蕉\n橘子");
    await wrapper.find('select[title="分割 / 组合分隔符"]').setValue("cn-dunhao");
    const btn = wrapper.findAll("button").find((b) => b.text() === "组合");
    expect(btn).toBeDefined();
    await btn!.trigger("click");

    expect(other.getValue()).toBe("苹果、香蕉、橘子");
    expect(focused.getValue()).toBe("苹果\n香蕉\n橘子");
    wrapper.unmount();
  });

  it("自动检测不到组合符时提示且不写入另一侧", async () => {
    const { wrapper, other } = mountPanel("苹果\n香蕉");
    const btn = wrapper.findAll("button").find((b) => b.text() === "组合");
    await btn!.trigger("click");

    expect(other.getValue()).toBe("");
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
    const other = createMockEditor("");
    const wrapper = mount(FindReplacePanel, {
      props: { focusedEditor: focused.editor, otherEditor: other.editor },
    });
    await wrapper.find('select[title="分割 / 组合分隔符"]').setValue("comma");
    await wrapper
      .findAll("button")
      .find((b) => b.text() === "组合")!
      .trigger("click");

    expect(other.getValue()).toBe("苹果,香蕉");
    wrapper.unmount();
  });

  it("输入为空时提示且不清空另一侧编辑器", async () => {
    const focused = createMockEditor("   \n  ");
    const other = createMockEditor("另一侧原有内容");
    const wrapper = mount(FindReplacePanel, {
      props: { focusedEditor: focused.editor, otherEditor: other.editor },
    });

    await wrapper
      .findAll("button")
      .find((b) => b.text() === "组合")!
      .trigger("click");

    expect(other.getValue()).toBe("另一侧原有内容");
    expect(useToastStore().toasts.some((t) => t.message.includes("没有可处理"))).toBe(true);
    wrapper.unmount();
  });
});

describe("FindReplacePanel 分割边界", () => {
  it("输入为空时提示且不清空另一侧编辑器", async () => {
    const focused = createMockEditor("   ");
    const other = createMockEditor("另一侧原有内容");
    const wrapper = mount(FindReplacePanel, {
      props: { focusedEditor: focused.editor, otherEditor: other.editor },
    });

    await wrapper
      .findAll("button")
      .find((b) => b.text() === "分割")!
      .trigger("click");

    expect(other.getValue()).toBe("另一侧原有内容");
    wrapper.unmount();
  });
});

describe("FindReplacePanel 工具栏分组", () => {
  it("四个功能组各自不拆行，分割与组合属于同一组", () => {
    const { wrapper } = mountPanel();
    const groups = wrapper.findAll("[data-ww-group]");
    expect(groups).toHaveLength(4);
    for (const g of groups) expect(g.classes()).toContain("flex-nowrap");

    // 第 1 组：查找（输入框 + 匹配模式 + 上下切换）
    expect(groups[0].find('input[placeholder="查找"]').exists()).toBe(true);
    expect(groups[0].findAll("button").length).toBeGreaterThanOrEqual(5);
    // 第 2 组：替换
    expect(groups[1].text()).toContain("全部替换");
    // 第 3 组：分割 / 组合
    expect(groups[2].text()).toContain("分割");
    expect(groups[2].text()).toContain("组合");
    // 第 4 组：排序
    expect(groups[3].text()).toContain("排序");
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

  it("选择排序模板后按模板顺序排序，未匹配项移到另一侧", async () => {
    const store = useTemplatesStore();
    store.addTemplate({
      id: "t1",
      name: "城市",
      items: ["济南", "青岛"],
      prefixMatch: false,
    });
    const { wrapper, focused, other } = mountPanel("青岛\n北京\n济南");
    const select = wrapper.find('select[title="排序规则"]');
    await select.setValue("t1");
    const btn = wrapper.findAll("button").find((b) => b.text() === "排序");
    await btn!.trigger("click");

    expect(focused.getValue()).toBe("济南\n青岛");
    expect(other.getValue()).toBe("北京");
    wrapper.unmount();
  });

  it("模板匹配不到任何项目时提示且不修改内容", async () => {
    const store = useTemplatesStore();
    store.addTemplate({ id: "t1", name: "城市", items: ["济南"] });
    const { wrapper, focused } = mountPanel("苹果\n香蕉");
    const select = wrapper.find('select[title="排序规则"]');
    await select.setValue("t1");
    const btn = wrapper.findAll("button").find((b) => b.text() === "排序");
    await btn!.trigger("click");

    expect(focused.getValue()).toBe("苹果\n香蕉");
    expect(useToastStore().toasts.some((t) => t.message.includes("没有匹配的项目"))).toBe(true);
    wrapper.unmount();
  });
});
