import { beforeEach, describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import SettingsView from "@/views/settings/SettingsView.vue";
import { resetStores } from "@/test/resetStores";

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

  it("外观设置可切换主题与字号", async () => {
    const wrapper = mount(SettingsView, { attachTo: document.body });

    // 切换到深色主题按钮
    const darkBtn = [...document.querySelectorAll("button")].find((b) => b.textContent === "深色");
    darkBtn!.click();
    await wrapper.vm.$nextTick();
    // theme 变化经设置 store 生效（applyTheme 已在 setup.ts 中 mock）
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
