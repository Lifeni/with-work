import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { Palette } from "@vicons/tabler";
import SectionCard from "./section-card.vue";

describe("SectionCard", () => {
  it("统一渲染卡片标题、图标、内容与右侧动作", () => {
    const wrapper = mount(SectionCard, {
      props: { title: "外观", icon: Palette },
      slots: {
        default: "<p>内容</p>",
        actions: '<button type="button">刷新</button>',
      },
    });

    expect(wrapper.get("section").classes()).toContain("rounded-lg");
    expect(wrapper.get("section").classes()).toContain("bg-card");
    expect(wrapper.get("h2").text()).toContain("外观");
    expect(wrapper.get("h2").find("svg").exists()).toBe(true);
    expect(wrapper.get("h2").find("button").exists()).toBe(false);
    expect(wrapper.text()).toContain("内容");
    expect(wrapper.get("button").text()).toBe("刷新");
  });
});
