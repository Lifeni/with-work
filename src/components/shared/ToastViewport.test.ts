import { beforeEach, describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import ToastViewport from "@/components/shared/ToastViewport.vue";
import { resetStores } from "@/test/resetStores";
import { useToastStore } from "@/stores/toast";

beforeEach(() => {
  resetStores();
});

describe("ToastViewport", () => {
  it("以非打断式 live region 播报提示", () => {
    const toast = useToastStore();
    toast.push("已保存");
    const wrapper = mount(ToastViewport);
    const region = wrapper.get('[role="status"]');

    expect(region.attributes("aria-live")).toBe("polite");
    expect(region.text()).toContain("已保存");
    wrapper.unmount();
  });
});
