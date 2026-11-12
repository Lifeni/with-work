import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { NInput } from "naive-ui";
import Input from "@/components/ui/input.vue";
import Textarea from "@/components/ui/textarea.vue";

describe("表单控件可访问名称", () => {
  it("Input 将 aria-label 传给原生输入框", () => {
    const wrapper = mount(Input, {
      attrs: { "aria-label": "查找文本" },
    });

    expect(wrapper.get("input").attributes("aria-label")).toBe("查找文本");
  });

  it("Textarea 将 aria-label 传给原生文本域", () => {
    const wrapper = mount(Textarea, {
      attrs: { "aria-label": "模板内容" },
    });

    expect(wrapper.get("textarea").attributes("aria-label")).toBe("模板内容");
  });

  it("Input 和 Textarea 显式采用 Naive 有边框形态", () => {
    const input = mount(Input);
    const textarea = mount(Textarea);
    expect(input.findComponent(NInput).props("bordered")).toBe(true);
    expect(textarea.findComponent(NInput).props("bordered")).toBe(true);
    input.unmount();
    textarea.unmount();
  });
});
