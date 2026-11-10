import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { NTooltip } from "naive-ui";
import Toggle from "@/components/ui/toggle.vue";

describe("Toggle iconOnly", () => {
  it("纯图标开关使用固定方形尺寸并启用 tooltip", () => {
    const wrapper = mount(Toggle, {
      props: { iconOnly: true, title: "正则表达式" },
      slots: { default: "<span>icon</span>" },
    });

    expect(wrapper.findComponent(NTooltip).exists()).toBe(true);
    const button = wrapper.get('[aria-label="正则表达式"]');
    expect(button.attributes("title")).toBeUndefined();
    expect(button.classes()).toContain("ww-icon-btn");
    expect(button.classes()).toContain("shrink-0");
  });

  it("开启态使用品牌主色而不是弱化背景", () => {
    const wrapper = mount(Toggle, {
      props: { active: true },
      slots: { default: "开启" },
    });

    const button = wrapper.get("button");
    expect(button.attributes("aria-pressed")).toBe("true");
    expect(button.attributes("style")).not.toContain("var(--accent)");
  });
});
