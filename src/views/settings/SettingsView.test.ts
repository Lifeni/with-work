import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { NInputNumber, NRadioGroup } from "naive-ui";
import SettingsView from "@/views/settings/SettingsView.vue";
import { resetStores } from "@/test/resetStores";
import { useSettingsStore } from "@/stores/settings";
import { useToastStore } from "@/stores/toast";
import { checkPwaUpdateNow } from "@/lib/pwaUpdateService";

vi.mock("@/lib/pwaUpdateService", () => ({
  checkPwaUpdateNow: vi.fn(async () => "latest"),
}));

beforeEach(() => {
  resetStores();
  vi.mocked(checkPwaUpdateNow).mockClear();
});

describe("SettingsView 关于板块", () => {
  it("提供 GitHub 仓库链接且不再提供单文件下载", () => {
    const wrapper = mount(SettingsView, { attachTo: document.body });

    const download = document.querySelector("a[download]");
    expect(download).toBeNull();

    const github = document.querySelector('a[title="在 GitHub 上查看源码"]');
    expect(github).not.toBeNull();
    expect(github?.getAttribute("href")).toBe("https://github.com/Lifeni/with-work");
    expect(github?.getAttribute("target")).toBe("_blank");
    expect(github?.classList.contains("h-7")).toBe(true);
    expect(github?.classList.contains("n-button")).toBe(true);
    expect(document.querySelector('a[title="反馈问题"]')?.getAttribute("href")).toBe(
      "https://github.com/Lifeni/with-work/issues",
    );
    expect(document.querySelector('a[title="查看版本历史"]')?.getAttribute("href")).toBe(
      "https://github.com/Lifeni/with-work/releases",
    );
    wrapper.unmount();
  });

  it("关于中展示版本信息与构建时间", () => {
    const wrapper = mount(SettingsView, { attachTo: document.body });
    expect(document.body.textContent).toContain("一点微小的工作");
    expect(document.body.textContent).toContain("构建时间");
    wrapper.unmount();
  });

  it("关于中提供手动检查更新入口", async () => {
    const wrapper = mount(SettingsView, { attachTo: document.body });
    const button = [...document.querySelectorAll<HTMLButtonElement>("button")].find((item) =>
      item.textContent?.includes("检查更新"),
    );
    expect(button).toBeDefined();
    button!.click();
    await flushPromises();

    expect(checkPwaUpdateNow).toHaveBeenCalledTimes(1);
    expect(useToastStore().toasts.at(-1)?.message).toBe("当前已是最新版本");
    wrapper.unmount();
  });

  it("版本号来自构建期注入的 __APP_VERSION__（与 package.json 一致）", async () => {
    const pkg = (await import("../../../package.json")).default;
    const wrapper = mount(SettingsView, { attachTo: document.body });
    expect(typeof __APP_VERSION__).toBe("string");
    expect(document.body.textContent).toContain(`版本 ${__APP_VERSION__}`);
    expect(__APP_VERSION__).toBe(pkg.version);
    wrapper.unmount();
  });

  it("主题使用分段单选控件并可清晰切换选中状态", async () => {
    const wrapper = mount(SettingsView, { attachTo: document.body });
    const settings = useSettingsStore();

    const themeGroup = document.querySelector(".n-radio-group");
    expect(themeGroup).not.toBeNull();
    expect(themeGroup?.classList.contains("ww-theme-switch")).toBe(true);
    expect(themeGroup?.classList.contains("ww-control-text")).toBe(false);
    expect(themeGroup?.getAttribute("aria-label")).toBe("主题");
    const themeRadioGroup = wrapper.findComponent(NRadioGroup);
    expect(themeRadioGroup.props("size")).toBe("small");
    expect(document.querySelector(".n-input-number")?.classList.contains("ww-control-text")).toBe(
      true,
    );
    const fontSizeInput = wrapper.findComponent(NInputNumber);
    expect(fontSizeInput.props("bordered")).toBe(true);
    expect(fontSizeInput.props("showButton")).toBe(false);
    expect(fontSizeInput.props("inputProps")).toMatchObject({ "aria-label": "编辑器字号" });
    const darkBtn = [...document.querySelectorAll<HTMLElement>(".n-radio-button")].find(
      (button) => button.textContent?.trim() === "深色",
    );
    expect(darkBtn).toBeDefined();
    darkBtn!.click();
    await wrapper.vm.$nextTick();

    expect(settings.theme).toBe("dark");
    expect(darkBtn!.classList.contains("n-radio-button--checked")).toBe(true);
    wrapper.unmount();
  });

  it("编辑器字体输入会实时更新设置", async () => {
    const wrapper = mount(SettingsView, { attachTo: document.body });
    const settings = useSettingsStore();
    const fontInput = wrapper.get<HTMLInputElement>('input[aria-label="编辑器字体"]');

    await fontInput.setValue("Fira Code");

    expect(settings.editorFontFamily).toBe("Fira Code");
    wrapper.unmount();
  });
});

describe("SettingsView 数据管理", () => {
  it("提供导出备份与清空数据按钮", () => {
    const wrapper = mount(SettingsView, { attachTo: document.body });
    expect(document.body.textContent).toContain("导出全部备份");
    expect(document.body.textContent).toContain("清空所有数据");
    wrapper.unmount();
  });

  it("展示本地存储用量与持久化状态", () => {
    const wrapper = mount(SettingsView, { attachTo: document.body });
    expect(document.body.textContent).toContain("本地存储");
    expect(document.body.textContent).toContain("IndexedDB");
    expect(document.body.textContent).toContain("持久化保护");
    wrapper.unmount();
  });
});
