import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { NTooltip } from "naive-ui";
import Button from "@/components/ui/button.vue";

describe("Button tooltip", () => {
  it("图标按钮使用 Naive UI tooltip，并保留 aria-label", async () => {
    const wrapper = mount(Button, {
      props: { size: "icon-sm", title: "测试图标按钮" },
      slots: { default: "<span>icon</span>" },
    });

    const tooltip = wrapper.findComponent(NTooltip);
    expect(tooltip.exists()).toBe(true);
    const button = wrapper.get('[aria-label="测试图标按钮"]');
    expect(button.attributes("title")).toBeUndefined();
    expect(button.classes()).toContain("shrink-0");
    expect(button.attributes("style")).toContain("width: 28px");
    expect(button.attributes("style")).toContain("height: 28px");
    await button.trigger("mouseenter");
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(document.body.textContent).toContain("测试图标按钮");
  });

  it("带文字的按钮不使用图标 tooltip", () => {
    const wrapper = mount(Button, {
      props: { size: "sm", title: "文字按钮提示" },
      slots: { default: "提交" },
    });

    expect(wrapper.findComponent(NTooltip).exists()).toBe(false);
    expect(wrapper.get("button").attributes("title")).toBe("文字按钮提示");
  });

  it("可强制为响应式纯图标按钮启用 tooltip", async () => {
    const wrapper = mount(Button, {
      props: { size: "sm", title: "响应式图标提示", tooltip: true },
      slots: { default: "<span>icon</span>" },
    });

    expect(wrapper.findComponent(NTooltip).exists()).toBe(true);
    const button = wrapper.get('[aria-label="响应式图标提示"]');
    expect(button.attributes("title")).toBeUndefined();
    expect(button.classes()).not.toContain("ww-icon-btn");
  });
});
