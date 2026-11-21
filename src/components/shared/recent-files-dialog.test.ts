import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import RecentFilesDialog from "@/components/shared/RecentFilesDialog.vue";
import { recentFiles, resetRecentFilesForTests } from "@/lib/recentFiles";
import { resetStores } from "@/test/resetStores";

const tick = () => new Promise((resolve) => setTimeout(resolve, 20));

beforeEach(() => {
  resetStores();
  resetRecentFilesForTests();
});

describe("RecentFilesDialog", () => {
  it("展示最近文件并可单独移除历史", async () => {
    recentFiles.value = [
      {
        id: "recent-1",
        name: "notes.txt",
        handle: { name: "notes.txt", kind: "file" } as FileSystemFileHandle,
        lastOpenedAt: Date.now(),
      },
    ];
    const wrapper = mount(RecentFilesDialog, {
      props: { open: true },
      attachTo: document.body,
    });
    await tick();

    expect(document.body.textContent).toContain("notes.txt");
    const remove = document.querySelector<HTMLButtonElement>(
      'button[aria-label="从历史移除 notes.txt"]',
    );
    expect(remove).not.toBeNull();
    remove!.click();

    await vi.waitFor(() => expect(recentFiles.value).toHaveLength(0));
    expect(document.body.textContent).toContain("暂无最近文件");
    wrapper.unmount();
  });
});
