import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import ManagerDialogFrame from "@/components/shared/ManagerDialogFrame.vue";

const tick = () => new Promise((resolve) => setTimeout(resolve, 20));

describe("ManagerDialogFrame", () => {
  it("选择文件后交给业务组件解析并清空 input", async () => {
    const wrapper = mount(ManagerDialogFrame, {
      props: {
        open: true,
        title: "管理数据",
        description: "测试导入",
        importLabel: "导入规则",
        exportLabel: "导出规则",
      },
      attachTo: document.body,
    });
    await tick();

    const input = document.querySelector<HTMLInputElement>('.ww-dialog-content input[type="file"]');
    expect(input).not.toBeNull();
    const file = new File(["{}"], "rules.json", { type: "application/json" });
    Object.defineProperty(input!, "files", {
      configurable: true,
      value: [file],
    });
    input!.dispatchEvent(new Event("change", { bubbles: true }));

    expect(wrapper.emitted("import-file")?.[0]?.[0]).toBe(file);
    expect(input!.value).toBe("");
    wrapper.unmount();
  });
});
