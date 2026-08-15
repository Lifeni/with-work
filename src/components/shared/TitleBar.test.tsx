import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TitleBar } from "@/components/shared/TitleBar";
import { setActiveEditor } from "@/lib/editorBridge";
import { createMockEditor } from "@/test/mockEditor";
import { resetStores } from "@/test/resetStores";
import { useUiStore } from "@/stores/ui";
import { useWorkspaceStore } from "@/stores/workspace";

describe("TitleBar", () => {
  beforeEach(() => {
    resetStores();
  });

  it("渲染工作区标签并可新建", async () => {
    const user = userEvent.setup();
    useWorkspaceStore.getState().createWorkspace();
    render(<TitleBar />);

    expect(screen.getByRole("tab", { name: /工作区 1/ })).toBeInTheDocument();

    await user.click(screen.getByTitle("新建工作区"));
    expect(useWorkspaceStore.getState().workspaces).toHaveLength(2);
    expect(screen.getByRole("tab", { name: /工作区 2/ })).toBeInTheDocument();
  });

  it("点击标签切换激活工作区", async () => {
    const user = userEvent.setup();
    const store = useWorkspaceStore.getState();
    store.createWorkspace();
    store.createWorkspace();
    render(<TitleBar />);

    await user.click(screen.getByRole("tab", { name: /工作区 2/ }));
    expect(useWorkspaceStore.getState().activeId).toBe(
      useWorkspaceStore.getState().workspaces[1].id,
    );
  });

  it("双击标签可重命名（Enter 提交）", async () => {
    const user = userEvent.setup();
    const store = useWorkspaceStore.getState();
    store.createWorkspace();
    render(<TitleBar />);

    const tab = screen.getByRole("tab", { name: /工作区 1/ });
    await user.dblClick(tab);
    const input = screen.getByRole("textbox");
    await user.clear(input);
    await user.type(input, "我的工作区");
    await user.keyboard("{Enter}");

    expect(useWorkspaceStore.getState().workspaces[0].name).toBe("我的工作区");
    expect(screen.getByRole("tab", { name: /我的工作区/ })).toBeInTheDocument();
  });

  it("关闭按钮删除工作区，删除激活工作区后自动切换", async () => {
    const user = userEvent.setup();
    const store = useWorkspaceStore.getState();
    store.createWorkspace();
    store.createWorkspace();
    render(<TitleBar />);

    await user.click(screen.getAllByTitle("关闭工作区")[0]);
    expect(useWorkspaceStore.getState().workspaces).toHaveLength(1);
    expect(useWorkspaceStore.getState().activeId).toBe(
      useWorkspaceStore.getState().workspaces[0].id,
    );
  });

  it("设置按钮切换全局设置视图", async () => {
    const user = userEvent.setup();
    render(<TitleBar />);

    await user.click(screen.getByTitle("设置"));
    expect(useUiStore.getState().settingsOpen).toBe(true);

    // 再次点击回到编辑器视图
    await user.click(screen.getByTitle("设置"));
    expect(useUiStore.getState().settingsOpen).toBe(false);
  });

  it("撤销 / 重做按钮作用于聚焦编辑器", async () => {
    const user = userEvent.setup();
    const mock = createMockEditor("abc");
    setActiveEditor(mock.editor);
    const trigger = vi.spyOn(mock.editor as unknown as { trigger: () => void }, "trigger");
    render(<TitleBar />);

    await user.click(screen.getByTitle("撤销 (Ctrl+Z)"));
    expect(trigger).toHaveBeenCalledWith("toolbar", "undo", null);

    await user.click(screen.getByTitle("重做"));
    expect(trigger).toHaveBeenCalledWith("toolbar", "redo", null);
  });
});
