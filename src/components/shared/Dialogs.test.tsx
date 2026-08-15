import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RulesDialog } from "@/components/shared/RulesDialog";
import { TemplatesDialog } from "@/components/shared/TemplatesDialog";
import { TextTemplatesDialog } from "@/components/shared/TextTemplatesDialog";
import { resetStores } from "@/test/resetStores";
import { useRulesStore } from "@/stores/rules";
import { useTemplatesStore } from "@/stores/templates";
import { useTextTemplatesStore } from "@/stores/textTemplates";
import type { ReplaceRule } from "@/types";

const noop = () => {};

function makeRule(overrides: Partial<ReplaceRule> = {}): ReplaceRule {
  return {
    id: "r1",
    name: "规则甲",
    find: "foo",
    replace: "bar",
    isRegex: false,
    matchCase: false,
    ...overrides,
  };
}

describe("RulesDialog", () => {
  beforeEach(() => {
    resetStores();
  });

  it("填写表单并保存规则", async () => {
    const user = userEvent.setup();
    render(<RulesDialog open onOpenChange={noop} />);

    await user.type(screen.getByPlaceholderText("规则名称（可选）"), "转小写");
    // user-event 会把 [A-Z]+ 当键盘描述符解析，直接触发 change 设置正则文本
    fireEvent.change(screen.getByPlaceholderText("查找内容"), { target: { value: "[A-Z]+" } });
    await user.type(screen.getByPlaceholderText("替换为"), "x");
    await user.click(screen.getByRole("button", { name: "正则" }));
    await user.click(screen.getByRole("button", { name: "保存规则" }));

    const rules = useRulesStore.getState().rules;
    expect(rules).toHaveLength(1);
    expect(rules[0]).toMatchObject({ name: "转小写", find: "[A-Z]+", replace: "x", isRegex: true });
    expect(screen.getByText("转小写")).toBeInTheDocument();
  });

  it("未填查找内容时拒绝保存", async () => {
    const user = userEvent.setup();
    render(<RulesDialog open onOpenChange={noop} />);

    await user.click(screen.getByRole("button", { name: "保存规则" }));
    expect(useRulesStore.getState().rules).toHaveLength(0);
  });

  it("展示已有规则并可删除（需确认）", async () => {
    const user = userEvent.setup();
    useRulesStore.getState().addRule(makeRule());
    render(<RulesDialog open onOpenChange={noop} />);

    expect(screen.getByText("规则甲")).toBeInTheDocument();

    await user.click(screen.getByTitle("删除"));
    // 未确认前不删除
    expect(useRulesStore.getState().rules).toHaveLength(1);
    const confirm = screen.getByRole("dialog", { name: "删除规则" });
    await user.click(within(confirm).getByRole("button", { name: "删除" }));
    expect(useRulesStore.getState().rules).toHaveLength(0);
  });

  it("编辑已有规则", async () => {
    const user = userEvent.setup();
    useRulesStore.getState().addRule(makeRule());
    render(<RulesDialog open onOpenChange={noop} />);

    await user.click(screen.getByTitle("编辑"));
    const nameInput = screen.getByPlaceholderText("规则名称（可选）");
    await user.clear(nameInput);
    await user.type(nameInput, "新名字");
    await user.click(screen.getByRole("button", { name: "更新规则" }));

    expect(useRulesStore.getState().rules[0].name).toBe("新名字");
    expect(useRulesStore.getState().rules).toHaveLength(1);
  });

  it("导入规则文件", async () => {
    const file = new File(
      [JSON.stringify([makeRule({ id: "imported", name: "导入规则" })])],
      "rules.json",
      { type: "application/json" },
    );
    render(<RulesDialog open onOpenChange={noop} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(useRulesStore.getState().rules).toHaveLength(1);
    });
    expect(useRulesStore.getState().rules[0].name).toBe("导入规则");
  });
});

describe("TemplatesDialog（排序模板）", () => {
  beforeEach(() => {
    resetStores();
  });

  it("填写表单并保存排序模板", async () => {
    const user = userEvent.setup();
    render(<TemplatesDialog open onOpenChange={noop} />);

    await user.type(screen.getByPlaceholderText("模板名称（可选）"), "月份顺序");
    await user.type(screen.getByPlaceholderText(/每行一条/), "一月\n二月\n三月");
    await user.click(screen.getByRole("button", { name: "保存模板" }));

    const templates = useTemplatesStore.getState().templates;
    expect(templates).toHaveLength(1);
    expect(templates[0]).toMatchObject({ name: "月份顺序", items: ["一月", "二月", "三月"] });
    expect(screen.getByText("月份顺序")).toBeInTheDocument();
  });

  it("空内容拒绝保存", async () => {
    const user = userEvent.setup();
    render(<TemplatesDialog open onOpenChange={noop} />);

    await user.click(screen.getByRole("button", { name: "保存模板" }));
    expect(useTemplatesStore.getState().templates).toHaveLength(0);
  });

  it("展示与删除排序模板（需确认）", async () => {
    const user = userEvent.setup();
    useTemplatesStore.getState().addTemplate({ id: "t1", name: "序列", items: ["a", "b", "c"] });
    render(<TemplatesDialog open onOpenChange={noop} />);

    expect(screen.getByText("序列")).toBeInTheDocument();
    expect(screen.getByText("3 条")).toBeInTheDocument();

    await user.click(screen.getByTitle("删除"));
    expect(useTemplatesStore.getState().templates).toHaveLength(1);
    const confirm = screen.getByRole("dialog", { name: "删除模板" });
    await user.click(within(confirm).getByRole("button", { name: "删除" }));
    expect(useTemplatesStore.getState().templates).toHaveLength(0);
  });

  it("保存模板时可开启开头匹配选项", async () => {
    const user = userEvent.setup();
    render(<TemplatesDialog open onOpenChange={noop} />);

    await user.type(screen.getByPlaceholderText(/每行一条/), "济南\n青岛");
    await user.click(screen.getByTitle("开头匹配：文本以列表项开头即算匹配"));
    await user.click(screen.getByRole("button", { name: "保存模板" }));

    expect(useTemplatesStore.getState().templates[0]).toMatchObject({ prefixMatch: true });
  });

  it("开头匹配模板在列表中展示状态提示", () => {
    useTemplatesStore.getState().addTemplate({
      id: "t1",
      name: "山东 16 市",
      items: ["济南"],
      prefixMatch: true,
    });
    render(<TemplatesDialog open onOpenChange={noop} />);

    // 表单中的开关与列表项状态标签都会出现「开头匹配」文本
    expect(screen.getAllByText("开头匹配").length).toBeGreaterThanOrEqual(2);
  });

  it("编辑开头匹配模板时选项回显", async () => {
    const user = userEvent.setup();
    useTemplatesStore.getState().addTemplate({
      id: "t1",
      name: "山东 16 市",
      items: ["济南", "青岛"],
      prefixMatch: true,
    });
    render(<TemplatesDialog open onOpenChange={noop} editId="t1" />);

    await user.click(screen.getByRole("button", { name: "更新模板" }));
    expect(useTemplatesStore.getState().templates[0]).toMatchObject({ prefixMatch: true });
  });
});

describe("TextTemplatesDialog（文本模板）", () => {
  beforeEach(() => {
    resetStores();
  });

  it("填写表单并保存文本模板", async () => {
    const user = userEvent.setup();
    render(<TextTemplatesDialog open onOpenChange={noop} />);

    await user.type(screen.getByPlaceholderText("模板名称（可选）"), "问候语");
    await user.type(screen.getByPlaceholderText("模板文本内容"), "你好，世界！");
    await user.click(screen.getByRole("button", { name: "保存模板" }));

    const templates = useTextTemplatesStore.getState().templates;
    expect(templates).toHaveLength(1);
    expect(templates[0]).toMatchObject({ name: "问候语", text: "你好，世界！" });
  });

  it("空文本拒绝保存", async () => {
    const user = userEvent.setup();
    render(<TextTemplatesDialog open onOpenChange={noop} />);

    await user.click(screen.getByRole("button", { name: "保存模板" }));
    expect(useTextTemplatesStore.getState().templates).toHaveLength(0);
  });

  it("展示与删除文本模板（需确认）", async () => {
    const user = userEvent.setup();
    useTextTemplatesStore.getState().addTemplate({ id: "tt1", name: "段落", text: "正文内容" });
    render(<TextTemplatesDialog open onOpenChange={noop} />);

    expect(screen.getByText("段落")).toBeInTheDocument();

    await user.click(screen.getByTitle("删除"));
    expect(useTextTemplatesStore.getState().templates).toHaveLength(1);
    const confirm = screen.getByRole("dialog", { name: "删除模板" });
    await user.click(within(confirm).getByRole("button", { name: "删除" }));
    expect(useTextTemplatesStore.getState().templates).toHaveLength(0);
  });
});
