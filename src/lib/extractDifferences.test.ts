import { describe, expect, it } from "vitest";
import { extractUniqueDifferences } from "@/lib/extractDifferences";

describe("extractUniqueDifferences", () => {
  it("保留两侧各自独有的去重行并维持原顺序", () => {
    const result = extractUniqueDifferences(
      "甲\r\n共同\r\n乙\r\n乙\r\n\r\n丙",
      "丁\n共同\n戊\n戊\n\n丙",
    );

    expect(result).toEqual({
      left: "甲\n乙",
      right: "丁\n戊",
      hasDuplicates: true,
    });
  });

  it("保留非空行的原始空白并精确比较", () => {
    const result = extractUniqueDifferences("  缩进项\n共同\n结尾空格 ", "共同\n缩进项");

    expect(result).toEqual({
      left: "  缩进项\n结尾空格 ",
      right: "缩进项",
      hasDuplicates: true,
    });
  });

  it("无重复内容时不把行尾格式规范化标记为去重", () => {
    const result = extractUniqueDifferences("甲\r\n乙\r\n", "丙");

    expect(result.hasDuplicates).toBe(false);
  });
});
