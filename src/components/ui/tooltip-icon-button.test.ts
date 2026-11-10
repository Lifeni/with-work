import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { NTooltip } from "naive-ui";
import TooltipIconButton from "@/components/ui/tooltip-icon-button.vue";

describe("TooltipIconButton", () => {
  it("裸图标按钮使用 Naive UI tooltip 和 aria-label", () => {
    const wrapper = mount(TooltipIconButton, {
      props: { title: "测试操作" },
      slots: { default: "<span>icon</span>" },
    });

    expect(wrapper.findComponent(NTooltip).exists()).toBe(true);
    const button = wrapper.get('[aria-label="测试操作"]');
    expect(button.attributes("title")).toBeUndefined();
    expect(button.classes()).toContain("shrink-0");
    expect(button.classes()).toContain("min-h-6");
    expect(button.classes()).toContain("min-w-6");
  });
});
