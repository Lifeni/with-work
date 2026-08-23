import { beforeEach, describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import StagingPanel from "@/components/shared/StagingPanel.vue";
import { resetStores } from "@/test/resetStores";
import { useSettingsStore } from "@/stores/settings";
import { useStagingStore } from "@/stores/staging";
import { useTemplatesStore } from "@/stores/templates";
import { useTextTemplatesStore } from "@/stores/textTemplates";

beforeEach(() => {
  resetStores();
});

function mountPanel() {
  const wrapper = mount(StagingPanel, { attachTo: document.body });
  return wrapper;
}

async function confirmDialog(confirmText: string) {
  // ConfirmDialog 通过 reka-ui Teleport 渲染到 body
  await new Promise((r) => setTimeout(r, 20));
  const buttons = [...document.querySelectorAll("button")];
  const target = buttons.find((b) => b.textContent?.trim() === confirmText);
  target?.click();
}

describe("StagingPanel 全局暂存区", () => {
  it("通过添加按钮把输入文本加入暂存区", async () => {
    const staging = useStagingStore();
    const wrapper = mountPanel();

    await wrapper.get("textarea").setValue("第一条文本");
    const addBtn = wrapper.findAll("button").find((b) => b.text() === "添加");
    expect(addBtn).toBeDefined();
    await addBtn!.trigger("click");

    expect(staging.items).toHaveLength(1);
    expect(staging.items[0].text).toBe("第一条文本");
    expect(wrapper.text()).toContain("第一条文本");
    // 输入框已清空
    expect((wrapper.get("textarea").element as HTMLTextAreaElement).value).toBe("");
  });

  it("条目数量反映在列表内容中", async () => {
    const staging = useStagingStore();
    staging.add("a");
    staging.add("b");
    const wrapper = mountPanel();
    expect(wrapper.text()).toContain("全局暂存区");
    expect(wrapper.text()).toContain("a");
    expect(wrapper.text()).toContain("b");
    wrapper.unmount();
  });

  it("双击条目进入行内编辑，保存后更新文本", async () => {
    const staging = useStagingStore();
    staging.add("原始文本");
    const wrapper = mountPanel();

    await wrapper.get(".cursor-grab").trigger("dblclick");
    // 编辑态 textarea 是页面上的第二个（第一个是草稿输入框）
    const editArea = wrapper.findAll("textarea")[1];
    expect(editArea.exists()).toBe(true);
    await editArea.setValue("修改后的文本");
    const saveBtn = wrapper.findAll("button").find((b) => b.text() === "保存");
    await saveBtn!.trigger("click");

    expect(staging.items[0].text).toBe("修改后的文本");
  });

  it("清空需要确认弹窗确认", async () => {
    const staging = useStagingStore();
    staging.add("x");
    const wrapper = mountPanel();

    await wrapper.get('[aria-label="清空暂存区"]').trigger("click");
    await confirmDialog("清空");
    expect(staging.items).toHaveLength(0);
  });

  it("清空确认弹窗点取消不删除", async () => {
    const staging = useStagingStore();
    staging.add("x");
    const wrapper = mountPanel();

    await wrapper.get('[aria-label="清空暂存区"]').trigger("click");
    await confirmDialog("取消");
    expect(staging.items).toHaveLength(1);
  });

  it("删除单个条目需要确认", async () => {
    const staging = useStagingStore();
    staging.add("要删除的条目");
    const wrapper = mountPanel();

    await wrapper.get('[title="删除此条目"]').trigger("click");
    await confirmDialog("删除");
    expect(staging.items).toHaveLength(0);
  });

  it("自绘拖拽：按下后移动超过阈值出现幽灵层，松手清除", async () => {
    const staging = useStagingStore();
    staging.add("拖拽内容");
    const wrapper = mountPanel();
    const card = wrapper.get(".cursor-grab");

    // jsdom 无 PointerEvent，用 MouseEvent 构造 pointer 系列事件（window 层监听）
    card.element.dispatchEvent(
      new MouseEvent("pointerdown", { clientX: 100, clientY: 100, bubbles: true, cancelable: true }),
    );
    // 未达阈值：不出现幽灵
    window.dispatchEvent(new MouseEvent("pointermove", { clientX: 102, clientY: 100 }));
    expect(document.querySelector(".ww-drag-ghost")).toBeNull();
    // 超过阈值：出现幽灵
    window.dispatchEvent(new MouseEvent("pointermove", { clientX: 180, clientY: 140 }));
    const ghost = document.querySelector(".ww-drag-ghost");
    expect(ghost).not.toBeNull();
    expect(ghost?.textContent).toContain("拖拽内容");
    // 未命中编辑器（jsdom 无 elementFromPoint）：松手后无插入，幽灵清除
    window.dispatchEvent(new MouseEvent("pointerup", { clientX: 180, clientY: 140 }));
    await wrapper.vm.$nextTick();
    expect(document.querySelector(".ww-drag-ghost")).toBeNull();
    expect(staging.items).toHaveLength(1);
    wrapper.unmount();
  });

  it("自绘拖拽：点击（未超过阈值）不产生拖拽副作用", async () => {
    const staging = useStagingStore();
    staging.add("条目文本");
    const wrapper = mountPanel();
    const card = wrapper.get(".cursor-grab");

    card.element.dispatchEvent(
      new MouseEvent("pointerdown", { clientX: 50, clientY: 50, bubbles: true, cancelable: true }),
    );
    window.dispatchEvent(new MouseEvent("pointermove", { clientX: 51, clientY: 51 }));
    window.dispatchEvent(new MouseEvent("pointerup", { clientX: 51, clientY: 51 }));
    await wrapper.vm.$nextTick();
    expect(document.querySelector(".ww-drag-ghost")).toBeNull();
    wrapper.unmount();
  });
});

describe("StagingPanel 模板区", () => {
  it("切换标签显示排序模板与替换规则", async () => {
    useTemplatesStore().addTemplate({ id: "t1", name: "城市顺序", items: ["济南", "青岛"] });
    const wrapper = mountPanel();

    const tabs = wrapper
      .findAll("button")
      .filter((b) => ["文本模板", "排序模板", "替换规则"].includes(b.text()));
    const sortTab = tabs.find((b) => b.text() === "排序模板")!;
    await sortTab.trigger("click");
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain("城市顺序");
  });

  it("管理按钮打开对应管理对话框", async () => {
    const wrapper = mountPanel();
    await wrapper.get('[aria-label="管理文本模板"]').trigger("click");
    await new Promise((r) => setTimeout(r, 20));
    // n-modal 的卡片由 AppDialog 自绘（.ww-dialog-content）
    const dialog = document.querySelector(".ww-dialog-content");
    expect(dialog?.textContent).toContain("自定义文本模板");
  });

  it("拖入文本保存为文本模板（来源标记相同不重复添加）", async () => {
    const textTpl = useTextTemplatesStore();
    const wrapper = mountPanel();
    const zone = wrapper.get('[data-testid="template-drop-zone"]');
    // jsdom 无 DragEvent，用普通 Event + defineProperty 注入 dataTransfer
    const fireDrop = (source: string, text: string) => {
      const dt = {
        types: ["text/plain"],
        setData: () => {},
        getData: (k: string) => (k === "application/x-with-work-source" ? source : text),
      };
      const ev = new Event("drop", { bubbles: true, cancelable: true });
      Object.defineProperty(ev, "dataTransfer", { value: dt });
      zone.element.dispatchEvent(ev);
    };

    // 先拖入一次（来源为编辑器 → 添加）
    fireDrop("editor", "新文本");
    await wrapper.vm.$nextTick();
    expect(textTpl.templates).toHaveLength(1);

    // 再拖回（来源相同 → 不重复添加）
    fireDrop("templates", "新文本");
    await wrapper.vm.$nextTick();
    expect(textTpl.templates).toHaveLength(1);
  });
});

describe("StagingPanel 收起与尺寸调节", () => {
  it("拖动右缘手柄可调节面板宽度（记忆到设置）", async () => {
    const settings = useSettingsStore();
    const wrapper = mountPanel();
    const handle = wrapper.find('[title="拖动调节面板宽度"]');
    expect(handle.exists()).toBe(true);

    // jsdom 无 PointerEvent，用 MouseEvent 构造 pointer 系列事件（由 document 捕获代理接管）
    // 手柄在面板右缘：向右拖 40px → 宽度 320 + 40 = 360
    const down = new MouseEvent("pointerdown", { clientX: 360, bubbles: true, cancelable: true });
    handle.element.dispatchEvent(down);
    window.dispatchEvent(new MouseEvent("pointermove", { clientX: 400 }));
    window.dispatchEvent(new MouseEvent("pointerup"));
    await wrapper.vm.$nextTick();
    expect(settings.stagingWidth).toBe(360);
    // 拖动时直接写 DOM 样式：面板根元素宽度跟随（wrapper.element 是挂载容器，需向下查找）
    const root = wrapper.find("div.bg-card").element as HTMLElement;
    expect(root.style.width).toBe("360px");
    wrapper.unmount();
  });

  it("拖动模板区上方分隔条可调节模板区高度（记忆到设置）", async () => {
    const settings = useSettingsStore();
    const wrapper = mountPanel();
    const handle = wrapper.find('[title="拖动调节模板区高度"]');
    expect(handle.exists()).toBe(true);

    // 增量式：起点高 240，向上拖 40px → 280
    const down = new MouseEvent("pointerdown", { clientY: 300, bubbles: true, cancelable: true });
    handle.element.dispatchEvent(down);
    window.dispatchEvent(new MouseEvent("pointermove", { clientY: 260 }));
    window.dispatchEvent(new MouseEvent("pointerup"));
    await wrapper.vm.$nextTick();
    expect(settings.stagingTemplateHeight).toBe(280);
    // 模板区根元素高度直接写入 DOM
    const zone = wrapper.get('[data-testid="template-drop-zone"]').element as HTMLElement;
    expect(zone.style.height).toBe("280px");
    wrapper.unmount();
  });
});
