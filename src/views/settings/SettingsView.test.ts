import { beforeEach, describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { NInputNumber, NRadioGroup } from "naive-ui";
import SettingsView from "@/views/settings/SettingsView.vue";
import { resetStores } from "@/test/resetStores";
import { useSettingsStore } from "@/stores/settings";

beforeEach(() => {
  resetStores();
});

describe("SettingsView 关于板块", () => {
  it("提供单文件版本下载与 GitHub 仓库链接", () => {
    // 测试环境 __BUILD_MODE__ 为 deploy，显示下载单文件版按钮
    const wrapper = mount(SettingsView, { attachTo: document.body });

    const download = document.querySelector('a[download="一点微小的工作.html"]');
    expect(download).not.toBeNull();
    expect(download?.getAttribute("href")).toBe("./with-work-single.html");

    const github = document.querySelector('a[title="在 GitHub 上查看源码"]');
    expect(github).not.toBeNull();
    expect(github?.getAttribute("href")).toBe("https://github.com/Lifeni/with-work");
    expect(github?.getAttribute("target")).toBe("_blank");
    wrapper.unmount();
  });

  it("关于中展示版本信息与构建时间", () => {
    const wrapper = mount(SettingsView, { attachTo: document.body });
    expect(document.body.textContent).toContain("一点微小的工作");
    expect(document.body.textContent).toContain("构建时间");
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
});

describe("SettingsView 数据管理", () => {
  it("提供导出备份与清空数据按钮", () => {
    const wrapper = mount(SettingsView, { attachTo: document.body });
    expect(document.body.textContent).toContain("导出全部备份");
    expect(document.body.textContent).toContain("清空所有数据");
    wrapper.unmount();
  });
});
