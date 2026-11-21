import { beforeEach, describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import StatusBar from "@/components/shared/StatusBar.vue";
import { resetStores } from "@/test/resetStores";
import { persistenceState } from "@/stores/persist";
import { useWorkspaceStore } from "@/stores/workspace";
import { otherTabCount } from "@/lib/multiTab";
import { resetRecentFilesForTests, workspaceFileBindings } from "@/lib/recentFiles";

beforeEach(() => {
  resetStores();
  resetRecentFilesForTests();
  persistenceState.status = "saved";
  persistenceState.savedAt = null;
  persistenceState.error = null;
  otherTabCount.value = 0;
});

describe("StatusBar 保存状态", () => {
  it("按持久化层状态显示保存中、失败与真实保存时间", async () => {
    const wrapper = mount(StatusBar, { attachTo: document.body });

    persistenceState.status = "saving";
    await nextTick();
    expect(wrapper.get("[role='status']").text()).toContain("保存中");

    persistenceState.status = "error";
    persistenceState.error = "本地存储写入失败，最近的编辑可能没有保存";
    await nextTick();
    const failed = wrapper.get("[role='status']");
    expect(failed.text()).toContain("保存失败");
    expect(failed.attributes("title")).toContain("写入失败");

    persistenceState.status = "saved";
    persistenceState.savedAt = new Date(2026, 0, 2, 3, 4, 5).getTime();
    persistenceState.error = null;
    await nextTick();
    expect(wrapper.get("[role='status']").text()).toContain("已自动保存 03:04:05");

    wrapper.unmount();
  });

  it("网络断开时展示离线状态", async () => {
    const wrapper = mount(StatusBar, { attachTo: document.body });
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    window.dispatchEvent(new Event("offline"));
    await nextTick();
    expect(wrapper.text()).toContain("离线");

    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    window.dispatchEvent(new Event("online"));
    await nextTick();
    expect(wrapper.text()).not.toContain("离线");
    wrapper.unmount();
  });

  it("显示当前工作区绑定的原文件", async () => {
    const workspace = useWorkspaceStore();
    const workspaceId = workspace.createWorkspace("会议");
    workspaceFileBindings.value = [
      {
        workspaceId,
        name: "会议记录.md",
        handle: {} as FileSystemFileHandle,
        boundAt: 1,
        side: "left",
      },
    ];

    const wrapper = mount(StatusBar, { attachTo: document.body });

    expect(wrapper.text()).toContain("会议记录.md");
    expect(wrapper.get("[title*='会议记录.md']").attributes("title")).toContain(
      "Ctrl/Cmd+S 将写回",
    );
    expect(wrapper.get("[title*='会议记录.md']").attributes("title")).toContain("左栏文件");
    wrapper.unmount();
  });

  it("检测到其他标签页时显示冲突提醒", () => {
    otherTabCount.value = 2;
    const wrapper = mount(StatusBar, { attachTo: document.body });

    expect(wrapper.text()).toContain("2 个其他标签页");
    expect(wrapper.get("[title*='后写覆盖']")).toBeDefined();
    wrapper.unmount();
  });
});
