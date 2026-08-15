import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StagingPanel } from "@/components/shared/StagingPanel";
import { setActiveEditor, setRuleApplyListener } from "@/lib/editorBridge";
import { createMockEditor } from "@/test/mockEditor";
import { resetStores } from "@/test/resetStores";
import { useRulesStore } from "@/stores/rules";
import { useStagingStore } from "@/stores/staging";
import { useTemplatesStore } from "@/stores/templates";
import { useTextTemplatesStore } from "@/stores/textTemplates";
import { useWorkspaceStore } from "@/stores/workspace";

describe("StagingPanel", () => {
  beforeEach(() => {
    resetStores();
    setRuleApplyListener(null);
  });

  it("输入文本并添加后显示在列表中", async () => {
    const user = userEvent.setup();
    render(<StagingPanel />);

    await user.type(screen.getByPlaceholderText(/粘贴或输入文本/), "第一条文本");
    await user.click(screen.getByRole("button", { name: /添加/ }));

    expect(useStagingStore.getState().items).toHaveLength(1);
    expect(screen.getByText("第一条文本")).toBeInTheDocument();
    expect(
      screen.getByText(useStagingStore.getState().items.length.toString()),
    ).toBeInTheDocument();
  });

  it("复制按钮调用剪贴板", async () => {
    const user = userEvent.setup();
    useStagingStore.getState().add("可复制的文本");
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
    render(<StagingPanel />);

    await user.click(screen.getByTitle("复制"));
    expect(writeText).toHaveBeenCalledWith("可复制的文本");
  });

  it("清空需经确认对话框", async () => {
    const user = userEvent.setup();
    useStagingStore.getState().add("要删除的文本");
    render(<StagingPanel />);

    await user.click(screen.getByTitle("清空暂存区"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "清空" }));

    expect(useStagingStore.getState().items).toHaveLength(0);
  });

  it("模板区标签可在 文本模板 / 排序模板 / 替换规则 间切换", async () => {
    const user = userEvent.setup();
    useTemplatesStore.getState().addTemplate({ id: "t1", name: "排序甲", items: ["a"] });
    useTextTemplatesStore.getState().addTemplate({ id: "tt1", name: "文本甲", text: "内容" });
    useRulesStore.getState().addRule({
      id: "r1",
      name: "规则甲",
      find: "a",
      replace: "b",
      isRegex: false,
      matchCase: false,
    });
    render(<StagingPanel />);

    // 默认显示文本模板
    expect(screen.getByText("文本甲")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "排序模板" }));
    expect(screen.getByText("排序甲")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "替换规则" }));
    expect(screen.getByText("规则甲")).toBeInTheDocument();
    expect(screen.getByText("a → b")).toBeInTheDocument();
  });

  it("双击替换规则进入编辑状态（表单预填）", async () => {
    const user = userEvent.setup();
    const rule = {
      id: "r1",
      name: "规则甲",
      find: "foo",
      replace: "bar",
      isRegex: false,
      matchCase: false,
    };
    useRulesStore.getState().addRule(rule);
    render(<StagingPanel />);

    await user.click(screen.getByRole("button", { name: "替换规则" }));
    await user.dblClick(screen.getByText("规则甲"));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("规则名称（可选）")).toHaveValue("规则甲");
    expect(screen.getByPlaceholderText("查找内容")).toHaveValue("foo");
    expect(screen.getByRole("button", { name: "更新规则" })).toBeInTheDocument();
  });

  it("替换规则列表删除按钮可直接删除规则", async () => {
    const user = userEvent.setup();
    useRulesStore.getState().addRule({
      id: "r1",
      name: "规则甲",
      find: "a",
      replace: "b",
      isRegex: false,
      matchCase: false,
    });
    render(<StagingPanel />);

    await user.click(screen.getByRole("button", { name: "替换规则" }));
    await user.click(screen.getByTitle("删除规则"));

    expect(useRulesStore.getState().rules).toHaveLength(0);
    expect(screen.queryByText("规则甲")).not.toBeInTheDocument();
  });

  it("文本模板点击插入到聚焦编辑器", async () => {
    const user = userEvent.setup();
    const mock = createMockEditor();
    setActiveEditor(mock.editor);
    useTextTemplatesStore.getState().addTemplate({ id: "tt1", name: "问候语", text: "你好，世界" });
    render(<StagingPanel />);

    await user.click(screen.getByTitle("插入到编辑器"));

    expect(mock.getValue()).toBe("你好，世界");
  });

  it("排序模板列表可一键按模板排序编辑器内容", async () => {
    const user = userEvent.setup();
    const ws = useWorkspaceStore.getState();
    const id = ws.createWorkspace();
    ws.setContent(id, "c\nb\na");
    const mock = createMockEditor("c\nb\na");
    setActiveEditor(mock.editor);
    useTemplatesStore.getState().addTemplate({ id: "t1", name: "正序", items: ["a", "b", "c"] });
    render(<StagingPanel />);

    await user.click(screen.getByRole("button", { name: "排序模板" }));
    await user.click(screen.getByTitle("按此模板排序编辑器文本"));

    expect(mock.getValue()).toBe("a\nb\nc");
  });

  it("编辑器文本可拖入暂存区", () => {
    render(<StagingPanel />);
    const zone = screen.getByTestId("staging-drop-zone");
    const dt = {
      types: ["text/plain"],
      dropEffect: "",
      getData: (t: string) => (t === "text/plain" ? "拖入的文本" : ""),
    };
    fireEvent.dragOver(zone, { dataTransfer: dt });
    fireEvent.drop(zone, { dataTransfer: dt });

    expect(useStagingStore.getState().items).toHaveLength(1);
    expect(useStagingStore.getState().items[0].text).toBe("拖入的文本");
  });

  it("从暂存区拖回暂存区不重复添加", () => {
    useStagingStore.getState().add("已有条目");
    render(<StagingPanel />);
    const zone = screen.getByTestId("staging-drop-zone");

    // 带来源标记（staging → staging）：忽略，不添加
    const fromStaging = {
      types: ["text/plain", "application/x-with-work-source"],
      dropEffect: "",
      getData: (t: string) =>
        t === "text/plain"
          ? "已有条目"
          : t === "application/x-with-work-source"
            ? "staging"
            : "",
    };
    fireEvent.dragOver(zone, { dataTransfer: fromStaging });
    fireEvent.drop(zone, { dataTransfer: fromStaging });
    expect(useStagingStore.getState().items).toHaveLength(1);

    // 无来源标记（如从编辑器拖入）：正常添加
    const fromOutside = {
      types: ["text/plain"],
      dropEffect: "",
      getData: (t: string) => (t === "text/plain" ? "新文本" : ""),
    };
    fireEvent.dragOver(zone, { dataTransfer: fromOutside });
    fireEvent.drop(zone, { dataTransfer: fromOutside });
    expect(useStagingStore.getState().items).toHaveLength(2);
  });

  it("从模板区拖回模板区不重复保存", () => {
    render(<StagingPanel />);
    const zone = screen.getByTestId("template-drop-zone");

    // 带来源标记（templates → templates）：忽略
    const fromTemplates = {
      types: ["text/plain", "application/x-with-work-source"],
      dropEffect: "",
      getData: (t: string) =>
        t === "text/plain"
          ? "模板文本"
          : t === "application/x-with-work-source"
            ? "templates"
            : "",
    };
    fireEvent.dragOver(zone, { dataTransfer: fromTemplates });
    fireEvent.drop(zone, { dataTransfer: fromTemplates });
    expect(useTextTemplatesStore.getState().templates).toHaveLength(0);

    // 从暂存区拖入模板区：正常保存
    const fromStaging = {
      types: ["text/plain", "application/x-with-work-source"],
      dropEffect: "",
      getData: (t: string) =>
        t === "text/plain"
          ? "新模板文本"
          : t === "application/x-with-work-source"
            ? "staging"
            : "",
    };
    fireEvent.dragOver(zone, { dataTransfer: fromStaging });
    fireEvent.drop(zone, { dataTransfer: fromStaging });
    expect(useTextTemplatesStore.getState().templates).toHaveLength(1);
    expect(useTextTemplatesStore.getState().templates[0].text).toBe("新模板文本");
  });

  it("编辑器文本可拖入模板区保存为文本模板", () => {
    render(<StagingPanel />);
    const zone = screen.getByTestId("template-drop-zone");
    const dt = {
      types: ["text/plain"],
      dropEffect: "",
      getData: (t: string) => (t === "text/plain" ? "拖入的模板文本" : ""),
    };
    fireEvent.dragOver(zone, { dataTransfer: dt });
    fireEvent.drop(zone, { dataTransfer: dt });

    expect(useTextTemplatesStore.getState().templates).toHaveLength(1);
    expect(useTextTemplatesStore.getState().templates[0].text).toBe("拖入的模板文本");
  });
});
