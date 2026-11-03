import { describe, expect, it } from "vitest";
import { tools } from "@/tools/registry";

describe("全局文本工具", () => {
  it("去除空格和 Tab 时删除横向空白但保留换行", () => {
    const tool = tools.find((t) => t.id === "text-remove-spaces-tabs");

    expect(tool).toBeDefined();
    expect(tool!.run(" 甲\t乙 \n  丙　丁 ")).toBe("甲乙\n丙丁");
  });
});
