import { beforeEach, describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import StagingPanel from "@/components/shared/StagingPanel.vue";
import { resetStores } from "@/test/resetStores";
import { useStagingStore } from "@/stores/staging";
import { useTemplatesStore } from "@/stores/templates";
import { useTextTemplatesStore } from "@/stores/textTemplates";
import { useUiStore } from "@/stores/ui";

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

  it("计数徽标反映条目数量", async () => {
    const staging = useStagingStore();
    staging.add("a");
    staging.add("b");
    const wrapper = mountPanel();
    expect(wrapper.text()).toContain("全局暂存区");
    expect(wrapper.get(".text-xs.font-medium").text()).toContain("2");
  });

  it("双击条目进入行内编辑，保存后更新文本", async () => {
    const staging = useStagingStore();
    staging.add("原始文本");
    const wrapper = mountPanel();

    await wrapper.get("[draggable]").trigger("dblclick");
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

    await wrapper.get('[title="清空暂存区"]').trigger("click");
    await confirmDialog("清空");
    expect(staging.items).toHaveLength(0);
  });

  it("清空确认弹窗点取消不删除", async () => {
    const staging = useStagingStore();
    staging.add("x");
    const wrapper = mountPanel();

    await wrapper.get('[title="清空暂存区"]').trigger("click");
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
    await wrapper.get('[title="管理文本模板"]').trigger("click");
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

describe("StagingPanel 收起与悬浮按钮", () => {
  it("暂存区关闭后显示悬浮按钮，点击重新打开", async () => {
    const ui = useUiStore();
    ui.setStagingOpen(false);
    const wrapper = mountPanel();

    const fab = wrapper.get('[title="打开暂存区"]');
    expect(fab.element.tagName).toBe("BUTTON");
    await fab.trigger("click");
    expect(ui.stagingOpen).toBe(true);
  });
});
