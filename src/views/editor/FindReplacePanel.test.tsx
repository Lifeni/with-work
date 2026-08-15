import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FindReplacePanel } from "@/views/editor/FindReplacePanel";
import { createMockEditor } from "@/test/mockEditor";
import { resetStores } from "@/test/resetStores";
import { useRulesStore } from "@/stores/rules";
import { useTemplatesStore } from "@/stores/templates";
import { useToastStore } from "@/stores/toast";

// 查找输入有 200ms 防抖，等待时间留足余量
const DEBOUNCE_MS = 400;

const matchBadge = () => screen.getByTitle("匹配数（当前 / 总数）");

async function expectMatchCount(text: string) {
  await waitFor(() => expect(matchBadge()).toHaveTextContent(text), { timeout: DEBOUNCE_MS });
}

describe("FindReplacePanel", () => {
  beforeEach(() => {
    resetStores();
  });

  it("输入查找词后显示匹配计数（当前 / 总数）", async () => {
    const user = userEvent.setup();
    const focused = createMockEditor("foo bar foo");
    render(<FindReplacePanel focusedEditor={focused.editor} otherEditor={null} />);

    await user.type(screen.getByPlaceholderText("查找"), "foo");
    await expectMatchCount("1/2");
  });

  it("正则开关改变匹配结果（纯文本按字面匹配）", async () => {
    const user = userEvent.setup();
    const focused = createMockEditor("a1b a2b");
    render(<FindReplacePanel focusedEditor={focused.editor} otherEditor={null} />);

    await user.type(screen.getByPlaceholderText("查找"), "a.b");
    await expectMatchCount("0");

    await user.click(screen.getByTitle("正则表达式"));
    await expectMatchCount("1/2");
  });

  it("区分大小写开关生效", async () => {
    const user = userEvent.setup();
    const focused = createMockEditor("Foo foo");
    render(<FindReplacePanel focusedEditor={focused.editor} otherEditor={null} />);

    await user.type(screen.getByPlaceholderText("查找"), "foo");
    await expectMatchCount("1/2");

    await user.click(screen.getByTitle("区分大小写"));
    await expectMatchCount("1/1");
  });

  it("替换按钮替换当前匹配处", async () => {
    const user = userEvent.setup();
    const focused = createMockEditor("foo foo");
    render(<FindReplacePanel focusedEditor={focused.editor} otherEditor={null} />);

    await user.type(screen.getByPlaceholderText("查找"), "foo");
    await expectMatchCount("1/2");
    await user.type(screen.getByPlaceholderText("替换为"), "bar");
    await user.click(screen.getByRole("button", { name: "替换" }));

    expect(focused.getValue()).toBe("bar foo");
  });

  it("全部替换按钮替换所有匹配处", async () => {
    const user = userEvent.setup();
    const focused = createMockEditor("foo foo foo");
    render(<FindReplacePanel focusedEditor={focused.editor} otherEditor={null} />);

    await user.type(screen.getByPlaceholderText("查找"), "foo");
    await expectMatchCount("1/3");
    await user.type(screen.getByPlaceholderText("替换为"), "bar");
    await user.click(screen.getByRole("button", { name: "全部替换" }));

    expect(focused.getValue()).toBe("bar bar bar");
  });

  it("正则替换支持组引用", async () => {
    const user = userEvent.setup();
    const focused = createMockEditor("2026-08-15");
    render(<FindReplacePanel focusedEditor={focused.editor} otherEditor={null} />);

    await user.type(screen.getByPlaceholderText("查找"), "(\\d+)-(\\d+)-(\\d+)");
    await user.click(screen.getByTitle("正则表达式"));
    await user.type(screen.getByPlaceholderText("替换为"), "$3/$2/$1");
    await expectMatchCount("1/1");
    await user.click(screen.getByRole("button", { name: "全部替换" }));

    expect(focused.getValue()).toBe("15/08/2026");
  });

  it("选择替换规则后填充查找与替换输入", async () => {
    const user = userEvent.setup();
    useRulesStore.getState().addRule({
      id: "r1",
      name: "合并空白",
      find: "\\s+",
      replace: " ",
      isRegex: true,
      matchCase: false,
    });
    render(<FindReplacePanel focusedEditor={null} otherEditor={null} />);

    await user.selectOptions(screen.getByTitle("替换规则"), "r1");
    expect(screen.getByPlaceholderText("查找")).toHaveValue("\\s+");
    expect(screen.getByPlaceholderText("替换为")).toHaveValue(" ");
  });

  it("分割把聚焦编辑器内容按分隔符写入另一侧", async () => {
    const user = userEvent.setup();
    const focused = createMockEditor("a，b，c");
    const other = createMockEditor();
    render(<FindReplacePanel focusedEditor={focused.editor} otherEditor={other.editor} />);

    await user.selectOptions(screen.getByTitle("分割分隔符"), "cn-comma");
    await user.click(screen.getByRole("button", { name: "分割" }));

    expect(other.getValue()).toBe("a\nb\nc");
  });

  it("分割使用自动检测分隔符", async () => {
    const user = userEvent.setup();
    const focused = createMockEditor("a;b;c");
    const other = createMockEditor();
    render(<FindReplacePanel focusedEditor={focused.editor} otherEditor={other.editor} />);

    await user.click(screen.getByRole("button", { name: "分割" }));

    expect(other.getValue()).toBe("a\nb\nc");
  });

  it("排序按钮（未选规则）按升序排序聚焦编辑器", async () => {
    const user = userEvent.setup();
    const focused = createMockEditor("c\na\nb");
    render(<FindReplacePanel focusedEditor={focused.editor} otherEditor={null} />);

    await user.click(screen.getByRole("button", { name: "排序" }));

    expect(focused.getValue()).toBe("a\nb\nc");
  });

  it("未选规则时再点一次切换为降序，循环切换", async () => {
    const user = userEvent.setup();
    const focused = createMockEditor("c\na\nb");
    render(<FindReplacePanel focusedEditor={focused.editor} otherEditor={null} />);
    const sortBtn = screen.getByRole("button", { name: "排序" });

    await user.click(sortBtn); // 升序
    expect(focused.getValue()).toBe("a\nb\nc");

    await user.click(sortBtn); // 降序
    expect(focused.getValue()).toBe("c\nb\na");

    await user.click(sortBtn); // 再升序
    expect(focused.getValue()).toBe("a\nb\nc");
  });

  it("排序按钮按所选模板排序聚焦编辑器", async () => {
    const user = userEvent.setup();
    useTemplatesStore.getState().addTemplate({
      id: "t1",
      name: "自定义序",
      items: ["a", "b", "c"],
    });
    const focused = createMockEditor("c\nb\na");
    render(<FindReplacePanel focusedEditor={focused.editor} otherEditor={null} />);

    await user.selectOptions(screen.getByTitle("排序规则"), "t1");
    await user.click(screen.getByRole("button", { name: "排序" }));

    expect(focused.getValue()).toBe("a\nb\nc");
  });

  it("按模板排序时全部不匹配则提示且不清空编辑器", async () => {
    const user = userEvent.setup();
    useTemplatesStore.getState().addTemplate({
      id: "t1",
      name: "自定义序",
      items: ["a", "b", "c"],
    });
    const focused = createMockEditor("x\ny");
    render(<FindReplacePanel focusedEditor={focused.editor} otherEditor={null} />);

    await user.selectOptions(screen.getByTitle("排序规则"), "t1");
    await user.click(screen.getByRole("button", { name: "排序" }));

    // 内容保持不变，未被清空
    expect(focused.getValue()).toBe("x\ny");
    expect(useToastStore.getState().toasts.some((t) => t.message === "没有匹配的项目")).toBe(true);
  });

  it("按模板排序时未匹配项写入另一侧编辑器", async () => {
    const user = userEvent.setup();
    useTemplatesStore.getState().addTemplate({
      id: "t1",
      name: "自定义序",
      items: ["a", "b"],
    });
    const focused = createMockEditor("b\nx\na");
    const other = createMockEditor("");
    render(<FindReplacePanel focusedEditor={focused.editor} otherEditor={other.editor} />);

    await user.selectOptions(screen.getByTitle("排序规则"), "t1");
    await user.click(screen.getByRole("button", { name: "排序" }));

    // 聚焦编辑器保留匹配项并按模板排序
    expect(focused.getValue()).toBe("a\nb");
    // 未匹配项移到另一侧
    expect(other.getValue()).toBe("x");
    expect(
      useToastStore.getState().toasts.some((t) => t.message.includes("1 项未匹配已移至另一侧")),
    ).toBe(true);
  });

  it("开启开头匹配后按模板前缀排序", async () => {
    const user = userEvent.setup();
    useTemplatesStore.getState().addTemplate({
      id: "t1",
      name: "自定义序",
      items: ["a", "b"],
    });
    const focused = createMockEditor("b市\nx\na市");
    render(<FindReplacePanel focusedEditor={focused.editor} otherEditor={null} />);

    await user.selectOptions(screen.getByTitle("排序规则"), "t1");
    await user.click(screen.getByTitle("开头匹配：文本以模板列表项开头即算匹配"));
    await user.click(screen.getByRole("button", { name: "排序" }));

    expect(focused.getValue()).toBe("a市\nb市");
  });

  it("未开启开头匹配时保持精确匹配（前缀文本不命中）", async () => {
    const user = userEvent.setup();
    useTemplatesStore.getState().addTemplate({
      id: "t1",
      name: "自定义序",
      items: ["a", "b"],
    });
    const focused = createMockEditor("a市\nb市");
    render(<FindReplacePanel focusedEditor={focused.editor} otherEditor={null} />);

    await user.selectOptions(screen.getByTitle("排序规则"), "t1");
    await user.click(screen.getByRole("button", { name: "排序" }));

    expect(focused.getValue()).toBe("a市\nb市"); // 全部不匹配，不清空
    expect(useToastStore.getState().toasts.some((t) => t.message === "没有匹配的项目")).toBe(true);
  });

  it("模板自带开头匹配属性时无需工具栏开关即可前缀匹配", async () => {
    const user = userEvent.setup();
    useTemplatesStore.getState().addTemplate({
      id: "t1",
      name: "自定义序",
      items: ["a", "b"],
      prefixMatch: true,
    });
    const focused = createMockEditor("b市\na市");
    render(<FindReplacePanel focusedEditor={focused.editor} otherEditor={null} />);

    await user.selectOptions(screen.getByTitle("排序规则"), "t1");
    await user.click(screen.getByRole("button", { name: "排序" }));

    expect(focused.getValue()).toBe("a市\nb市");
  });

  it("选择带开头匹配的模板后工具栏开关自动勾选", async () => {
    const user = userEvent.setup();
    useTemplatesStore.getState().addTemplate({
      id: "t1",
      name: "前缀模板",
      items: ["a", "b"],
      prefixMatch: true,
    });
    useTemplatesStore.getState().addTemplate({
      id: "t2",
      name: "精确模板",
      items: ["a", "b"],
    });
    render(<FindReplacePanel focusedEditor={null} otherEditor={null} />);

    const prefixToggle = screen.getByTitle("开头匹配：文本以模板列表项开头即算匹配");
    expect(prefixToggle).toHaveAttribute("aria-pressed", "false");

    await user.selectOptions(screen.getByTitle("排序规则"), "t1");
    expect(prefixToggle).toHaveAttribute("aria-pressed", "true");

    await user.selectOptions(screen.getByTitle("排序规则"), "t2");
    expect(prefixToggle).toHaveAttribute("aria-pressed", "false");
  });

  it("已移除预览按钮", () => {
    render(<FindReplacePanel focusedEditor={null} otherEditor={null} />);
    expect(screen.queryByRole("button", { name: /预览/ })).not.toBeInTheDocument();
  });
});
