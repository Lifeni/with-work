import { describe, expect, it } from "vitest";
import { applyReplacements, computeReplacement, escapeRegExp } from "./replace";

describe("escapeRegExp", () => {
  it("转义正则特殊字符", () => {
    expect(escapeRegExp("a.b*c")).toBe("a\\.b\\*c");
    expect(escapeRegExp("(x)")).toBe("\\(x\\)");
    expect(escapeRegExp("a+b?[c]")).toBe("a\\+b\\?\\[c\\]");
  });
});

describe("computeReplacement", () => {
  it("非正则模式原样返回替换文本", () => {
    expect(computeReplacement("$1", false, "m", ["g"])).toBe("$1");
  });

  it("正则模式支持 $1 组引用", () => {
    expect(computeReplacement("$1-$2", true, "m", ["a", "b"])).toBe("a-b");
  });

  it("正则模式支持 $&（整个匹配）与 $$（字面 $）", () => {
    expect(computeReplacement("$&", true, "match", [])).toBe("match");
    expect(computeReplacement("$$", true, "m", [])).toBe("$");
  });

  it("越界组号返回空字符串", () => {
    expect(computeReplacement("$5", true, "m", ["a"])).toBe("");
  });
});

describe("applyReplacements", () => {
  it("空查找词返回原文", () => {
    expect(applyReplacements("abc", "", "x", false, false)).toBe("abc");
  });

  it("纯文本替换默认不区分大小写", () => {
    expect(applyReplacements("aAa", "a", "b", false, false)).toBe("bbb");
  });

  it("区分大小写时只替换相同大小写", () => {
    expect(applyReplacements("aAa", "a", "b", false, true)).toBe("bAb");
  });

  it("纯文本模式把查找词按字面转义（. 不匹配任意字符）", () => {
    expect(applyReplacements("a.b", "a.b", "x", false, false)).toBe("x");
    expect(applyReplacements("aXb", "a.b", "x", false, false)).toBe("aXb");
  });

  it("正则替换支持组引用", () => {
    expect(applyReplacements("2026-08-15", "(\\d+)-(\\d+)-(\\d+)", "$3/$2/$1", true, false)).toBe(
      "15/08/2026",
    );
  });

  it("正则模式默认不区分大小写，matchCase 时区分", () => {
    expect(applyReplacements("aA", "a", "x", true, false)).toBe("xx");
    expect(applyReplacements("aA", "a", "x", true, true)).toBe("xA");
  });

  it("无效正则返回原文", () => {
    expect(applyReplacements("abc", "(", "x", true, false)).toBe("abc");
  });
});
