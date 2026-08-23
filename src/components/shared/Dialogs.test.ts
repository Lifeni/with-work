import { beforeEach, describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import RulesDialog from "@/components/shared/RulesDialog.vue";
import TemplatesDialog from "@/components/shared/TemplatesDialog.vue";
import TextTemplatesDialog from "@/components/shared/TextTemplatesDialog.vue";
import { resetStores } from "@/test/resetStores";
import { useRulesStore } from "@/stores/rules";
import { useTemplatesStore } from "@/stores/templates";
import { useTextTemplatesStore } from "@/stores/textTemplates";

beforeEach(() => {
  resetStores();
});

/** reka-ui DialogContent 通过 Teleport 渲染到 body，统一从 document 查询 */
function dialogEl() {
  return document.querySelector(".ww-dialog-content")!;
}
function dialogInputs(): HTMLInputElement[] {
  return [...dialogEl().querySelectorAll("input")];
}
function dialogButtons(): HTMLButtonElement[] {
  return [...dialogEl().querySelectorAll("button")];
}
function dialogButton(text: string) {
  return dialogButtons().find((b) => b.textContent?.trim() === text);
}
const tick = () => new Promise((r) => setTimeout(r, 20));

describe("RulesDialog 替换规则管理", () => {
  it("填写表单保存新规则", async () => {
    const wrapper = mount(RulesDialog, { props: { open: true } });
    await tick();

    const inputs = dialogInputs();
    // setValue 等价于设置属性 + 触发 input；vue-test-utils 无法直接操作 teleport 内容，手动模拟
    const setInput = (el: HTMLInputElement, v: string) => {
      el.value = v;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    };
    setInput(inputs[0], "我的规则");
    setInput(inputs[1], "a");
    setInput(inputs[2], "b");
    dialogButton("保存规则")!.click();

    const rules = useRulesStore().rules;
    expect(rules).toHaveLength(1);
    expect(rules[0]).toMatchObject({ name: "我的规则", find: "a", replace: "b" });
    wrapper.unmount();
  });

  it("打开时带入 initialDraft", async () => {
    const wrapper = mount(RulesDialog, {
      props: {
        open: true,
        initialDraft: { find: "x", replace: "y", isRegex: true, matchCase: false },
      },
    });
    await tick();
    const inputs = dialogInputs();
    expect(inputs[1].value).toBe("x");
    expect(inputs[2].value).toBe("y");
    wrapper.unmount();
  });

  it("编辑已有规则并更新", async () => {
    const store = useRulesStore();
    store.addRule({
      id: "r1",
      name: "旧规则",
      find: "old",
      replace: "new",
      isRegex: false,
      matchCase: false,
    });
    const wrapper = mount(RulesDialog, { props: { open: true } });
    await tick();

    const editBtn = dialogButtons().find((b) => b.getAttribute("aria-label") === "编辑");
    editBtn!.click();
    await tick();
    const inputs = dialogInputs();
    const setInput = (el: HTMLInputElement, v: string) => {
      el.value = v;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    };
    setInput(inputs[0], "新规则名");
    setInput(inputs[1], "newfind");
    dialogButton("更新规则")!.click();

    expect(store.rules).toHaveLength(1);
    expect(store.rules[0]).toMatchObject({ name: "新规则名", find: "newfind" });
    wrapper.unmount();
  });

  it("删除规则需要确认", async () => {
    const store = useRulesStore();
    store.addRule({
      id: "r1",
      name: "规则A",
      find: "a",
      replace: "b",
      isRegex: false,
      matchCase: false,
    });
    const wrapper = mount(RulesDialog, { props: { open: true } });
    await tick();

    dialogButtons()
      .find((b) => b.getAttribute("aria-label") === "删除")!
      .click();
    await tick();
    const confirm = [...document.querySelectorAll("button")].find(
      (b) => b.textContent === "删除" && b.closest(".ww-dialog-content"),
    );
    confirm!.click();
    await tick();

    expect(store.rules).toHaveLength(0);
    wrapper.unmount();
  });
});

describe("TemplatesDialog 排序模板管理", () => {
  it("按行输入条目保存模板", async () => {
    const wrapper = mount(TemplatesDialog, { props: { open: true } });
    await tick();

    const inputs = dialogInputs();
    const setInput = (el: HTMLInputElement, v: string) => {
      el.value = v;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    };
    const setTextarea = (el: HTMLTextAreaElement, v: string) => {
      el.value = v;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    };
    setInput(inputs[0], "城市顺序");
    setTextarea(dialogEl().querySelector("textarea")!, "济南\n青岛\n淄博");
    dialogButton("保存模板")!.click();

    const templates = useTemplatesStore().templates;
    expect(templates).toHaveLength(1);
    expect(templates[0]).toMatchObject({ name: "城市顺序", items: ["济南", "青岛", "淄博"] });
    wrapper.unmount();
  });

  it("空内容不允许保存并提示", async () => {
    const wrapper = mount(TemplatesDialog, { props: { open: true } });
    await tick();
    dialogButton("保存模板")!.click();
    expect(useTemplatesStore().templates).toHaveLength(0);
    wrapper.unmount();
  });
});

describe("TextTemplatesDialog 文本模板管理", () => {
  it("保存带名称的文本模板", async () => {
    const wrapper = mount(TextTemplatesDialog, { props: { open: true } });
    await tick();

    const setInput = (el: HTMLInputElement, v: string) => {
      el.value = v;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    };
    const setTextarea = (el: HTMLTextAreaElement, v: string) => {
      el.value = v;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    };
    setInput(dialogInputs()[0], "问候语");
    setTextarea(dialogEl().querySelector("textarea")!, "你好，世界");
    dialogButton("保存模板")!.click();

    const templates = useTextTemplatesStore().templates;
    expect(templates).toHaveLength(1);
    expect(templates[0]).toMatchObject({ name: "问候语", text: "你好，世界" });
    wrapper.unmount();
  });

  it("editId 打开时直接进入该模板的编辑状态", async () => {
    useTextTemplatesStore().addTemplate({ id: "tt1", name: "模板1", text: "内容1" });
    const wrapper = mount(TextTemplatesDialog, {
      props: { open: true, editId: "tt1" },
    });
    await tick();
    expect(dialogInputs()[0].value).toBe("模板1");
    expect(dialogButton("更新模板")).toBeDefined();
    wrapper.unmount();
  });
});
