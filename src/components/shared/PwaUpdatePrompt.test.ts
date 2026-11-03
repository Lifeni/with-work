import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import PwaUpdatePrompt from "@/components/shared/PwaUpdatePrompt.vue";

const pwaMock = vi.hoisted(() => ({
  options: null as null | {
    onNeedRefresh: () => void;
    onRegisterError?: (error: unknown) => void;
  },
  updateServiceWorker: vi.fn(async () => {}),
  dispose: vi.fn(),
}));

vi.mock("@/lib/pwaUpdate", () => ({
  startPwaUpdate: vi.fn(
    (options: { onNeedRefresh: () => void; onRegisterError?: (error: unknown) => void }) => {
      pwaMock.options = options;
      return {
        ready: Promise.resolve(),
        updateServiceWorker: pwaMock.updateServiceWorker,
        dispose: pwaMock.dispose,
      };
    },
  ),
}));

beforeEach(() => {
  pwaMock.options = null;
  pwaMock.updateServiceWorker.mockClear();
  pwaMock.dispose.mockClear();
});

function mountPrompt() {
  return mount(PwaUpdatePrompt, { props: { enabled: true }, attachTo: document.body });
}

describe("PwaUpdatePrompt", () => {
  it("检测到新版本后在右下角显示更新提示", async () => {
    const wrapper = mountPrompt();
    expect(wrapper.find('[role="status"]').exists()).toBe(false);

    pwaMock.options?.onNeedRefresh();
    await wrapper.vm.$nextTick();

    const prompt = wrapper.get('[role="status"]');
    expect(prompt.text()).toContain("发现新版本");
    expect(prompt.classes()).toContain("fixed");
    expect(prompt.classes()).toContain("right-3");
    expect(prompt.classes()).toContain("bottom-10");
    expect(wrapper.findAll("button").map((button) => button.text())).toEqual(["稍后", "立即更新"]);
    wrapper.unmount();
  });

  it("点击稍后只关闭提示，不触发更新", async () => {
    const wrapper = mountPrompt();
    pwaMock.options?.onNeedRefresh();
    await wrapper.vm.$nextTick();

    await wrapper
      .findAll("button")
      .find((button) => button.text() === "稍后")!
      .trigger("click");

    expect(wrapper.find('[role="status"]').exists()).toBe(false);
    expect(pwaMock.updateServiceWorker).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("点击立即更新后调用刷新，并在更新期间禁用按钮", async () => {
    let finishUpdate: (() => void) | undefined;
    pwaMock.updateServiceWorker.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishUpdate = resolve;
        }),
    );
    const wrapper = mountPrompt();
    pwaMock.options?.onNeedRefresh();
    await wrapper.vm.$nextTick();

    const updateButton = wrapper.findAll("button").find((button) => button.text() === "立即更新")!;
    await updateButton.trigger("click");
    await wrapper.vm.$nextTick();

    expect(pwaMock.updateServiceWorker).toHaveBeenCalledTimes(1);
    expect(updateButton.attributes("disabled")).toBeDefined();
    expect(updateButton.text()).toContain("正在更新");

    finishUpdate?.();
    await flushPromises();
    wrapper.unmount();
  });

  it("组件卸载时释放 Service Worker 更新监听", () => {
    const wrapper = mountPrompt();
    wrapper.unmount();
    expect(pwaMock.dispose).toHaveBeenCalledTimes(1);
  });
});
