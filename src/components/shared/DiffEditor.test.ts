import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import * as monaco from "monaco-editor";
import DiffEditor from "@/components/shared/DiffEditor.vue";

describe("DiffEditor", () => {
  it("主题变化时同步更新 Monaco 全局主题", async () => {
    const setTheme = vi.spyOn(monaco.editor, "setTheme");
    const wrapper = mount(DiffEditor, {
      props: { original: "左栏", modified: "右栏", theme: "light" },
      attachTo: document.body,
    });

    await wrapper.setProps({ theme: "dark" });

    expect(setTheme).toHaveBeenCalledWith("dark");
    setTheme.mockRestore();
    wrapper.unmount();
  });
});
