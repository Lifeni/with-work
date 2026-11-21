import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import PwaUpdatePrompt from "@/components/shared/PwaUpdatePrompt.vue";
import { startPwaUpdate } from "@/lib/pwaUpdate";
import { checkPwaUpdateNow } from "@/lib/pwaUpdateService";

const pwaMock = vi.hoisted(() => ({
  options: null as null | {
    onNeedRefresh: () => void;
    onRegisterError?: (error: unknown) => void;
  },
  updateServiceWorker: vi.fn(async () => {}),
  checkForUpdate: vi.fn(async (): Promise<"latest" | "update"> => "latest"),
  showUpdatePrompt: vi.fn(() => true),
  dispose: vi.fn(),
}));

vi.mock("@/lib/pwaUpdate", () => ({
  startPwaUpdate: vi.fn(
    (options: { onNeedRefresh: () => void; onRegisterError?: (error: unknown) => void }) => {
      pwaMock.options = options;
      return {
        ready: Promise.resolve(),
        checkForUpdate: pwaMock.checkForUpdate,
        showUpdatePrompt: pwaMock.showUpdatePrompt,
        updateServiceWorker: pwaMock.updateServiceWorker,
        dispose: pwaMock.dispose,
      };
    },
  ),
}));

beforeEach(() => {
  pwaMock.options = null;
  pwaMock.updateServiceWorker.mockClear();
  pwaMock.checkForUpdate.mockClear();
  pwaMock.showUpdatePrompt.mockClear();
  pwaMock.dispose.mockClear();
  vi.mocked(startPwaUpdate).mockClear();
});

function mountPrompt(props: { enabled?: boolean } = {}) {
  return mount(PwaUpdatePrompt, { props, attachTo: document.body });
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
    expect(prompt.classes()).toContain("z-[2100]");
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

  it("显式关闭时不会注册 Service Worker", () => {
    const wrapper = mountPrompt({ enabled: false });
    expect(startPwaUpdate).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("把控制器提供给设置页的手动检查入口", async () => {
    const wrapper = mountPrompt();
    await expect(checkPwaUpdateNow()).resolves.toBe("latest");
    expect(pwaMock.checkForUpdate).toHaveBeenCalledTimes(1);
    wrapper.unmount();
    await expect(checkPwaUpdateNow()).resolves.toBe("unavailable");
  });

  it("手动检查发现新版本时重新显示右下角提示", async () => {
    pwaMock.checkForUpdate.mockResolvedValueOnce("update");
    const wrapper = mountPrompt();

    await expect(checkPwaUpdateNow()).resolves.toBe("update");
    expect(pwaMock.showUpdatePrompt).toHaveBeenCalledTimes(1);

    wrapper.unmount();
  });
});
