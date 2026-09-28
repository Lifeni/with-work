import { describe, expect, it } from "vitest";
import { joinText, resolveSeparator } from "./join";

describe("resolveSeparator", () => {
  it("固定分隔符直接给出字面量", () => {
    expect(resolveSeparator("a\nb", { delimiter: "cn-comma" })).toEqual({ separator: "，" });
    expect(resolveSeparator("a\nb", { delimiter: "newline" })).toEqual({ separator: "\n" });
    expect(resolveSeparator("a\nb", { delimiter: "space" })).toEqual({ separator: " " });
    expect(resolveSeparator("a\nb", { delimiter: "cn-dunhao" })).toEqual({ separator: "、" });
  });

  it("自动检测取文本中出现最多的符号", () => {
    expect(resolveSeparator("a,b、c,d", { delimiter: "auto" })).toEqual({ separator: "," });
  });

  it("自动检测不到符号时给出可操作的提示", () => {
    const r = resolveSeparator("苹果\n香蕉", { delimiter: "auto" });
    expect("error" in r && r.error).toContain("组合符");
  });

  it("自定义正则在文本中取匹配到的字面量作为组合符", () => {
    expect(resolveSeparator("a，b", { delimiter: "custom", customRegex: "[，,]" })).toEqual({
      separator: "，",
    });
  });

  it("自定义正则缺失或非法时报错", () => {
    expect("error" in resolveSeparator("a", { delimiter: "custom", customRegex: "" })).toBe(true);
    expect("error" in resolveSeparator("a", { delimiter: "custom", customRegex: "[" })).toBe(true);
  });
});

describe("joinText", () => {
  it("把多行按组合符拼成一行", () => {
    const r = joinText("苹果\n香蕉\n橘子", { delimiter: "cn-dunhao" });
    expect(r.text).toBe("苹果、香蕉、橘子");
    expect(r.count).toBe(3);
    expect(r.separator).toBe("、");
    expect(r.error).toBeUndefined();
  });

  it("忽略空行与两端空白（与分割对称，可往返）", () => {
    const r = joinText("  苹果 \n\n 香蕉 \n", { delimiter: "comma" });
    expect(r.text).toBe("苹果,香蕉");
    expect(r.count).toBe(2);
  });

  it("出错时原样返回文本且不拼接", () => {
    const r = joinText("苹果\n香蕉", { delimiter: "auto" });
    expect(r.error).toBeTruthy();
    expect(r.text).toBe("苹果\n香蕉");
  });

  it("只有一行时也返回该行内容", () => {
    const r = joinText("只有一行", { delimiter: "comma" });
    expect(r.text).toBe("只有一行");
    expect(r.count).toBe(1);
  });
});
