import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "@/App";
import { resetStores } from "@/test/resetStores";
import { useWorkspaceStore } from "@/stores/workspace";
import type { MockEditor } from "@/test/mockEditor";

/**
 * @monaco-editor/react 替身：模拟真实组件的时序——
 * 挂载后在 passive effect 中创建编辑器实例并调用 onMount（真实组件在 effect 中
 * 异步 loader.init() 后创建实例，晚于父组件的 useLayoutEffect）；
 * 卸载时标记实例已 dispose（真实组件会调用 editor.dispose()）。
 * 这样能真实复现「对已 dispose 实例调用 setModel 抛异常」的崩溃路径。
 */
vi.mock("@monaco-editor/react", async () => {
  const React = await import("react");
  const { createMockEditor } = await import("@/test/mockEditor");

  return {
    /** 替身组件：挂载后在 passive effect 中创建实例并调用 onMount（真实组件在异步 loader 后 onMount） */
    default: function MockEditorComponent({ onMount }: { onMount?: (ed: unknown) => void }) {
      const onMountRef = React.useRef(onMount);
      onMountRef.current = onMount;
      React.useEffect(() => {
        const mock: MockEditor = createMockEditor("");
        onMountRef.current?.(mock.editor);
        return () => {
          (mock.editor as unknown as { _markDisposed: () => void })._markDisposed();
        };
      }, []);
      return <div data-testid="mock-editor" />;
    },
    DiffEditor: () => <div data-testid="mock-diff-editor" />,
  };
});

describe("App：工作区生命周期", () => {
  beforeEach(() => {
    resetStores();
  });

  it("关闭最后一个工作区后自动新建并重建编辑器，不崩溃", async () => {
    const user = userEvent.setup();
    render(<App />);

    // 首屏无工作区时自动创建第一个
    await waitFor(() => {
      expect(useWorkspaceStore.getState().workspaces).toHaveLength(1);
      expect(useWorkspaceStore.getState().activeId).not.toBeNull();
    });

    // 左右两个编辑器实例完成挂载
    await waitFor(() => {
      expect(screen.getAllByTestId("mock-editor")).toHaveLength(2);
    });

    // 关闭最后一个工作区：App 会自动新建，编辑器实例重新挂载。
    // 未修复时，重建瞬间的 useLayoutEffect 会对已 dispose 实例调用 setModel
    // 并抛异常（React 无 ErrorBoundary → 整页白屏），此处测试将直接失败
    await user.click(screen.getByTitle("关闭工作区"));
    await waitFor(() => {
      expect(useWorkspaceStore.getState().workspaces).toHaveLength(1);
      expect(useWorkspaceStore.getState().activeId).not.toBeNull();
      expect(screen.getAllByTestId("mock-editor")).toHaveLength(2);
    });
  });
});
