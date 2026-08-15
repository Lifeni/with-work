import { describe, expect, it } from "vitest";
import { detectDelimiter, splitLines, splitText } from "./split";

describe("detectDelimiter", () => {
  it("没有候选符号时返回换行", () => {
    expect(detectDelimiter("一二三")).toBe("newline");
    expect(detectDelimiter("")).toBe("newline");
  });

  it("返回出现次数最多的符号", () => {
    expect(detectDelimiter("a,b;c;d")).toBe("semicolon");
    expect(detectDelimiter("a，b，c,d")).toBe("cn-comma");
    expect(detectDelimiter("一、二、三、四")).toBe("cn-dunhao");
    expect(detectDelimiter("a b\tc d")).toBe("space");
  });

  it("出现次数相同时取候选顺序靠前的符号", () => {
    expect(detectDelimiter("a,b;c")).toBe("comma");
  });
});

describe("splitText", () => {
  it("空文本返回空数组", () => {
    expect(splitText("", { delimiter: "newline" })).toEqual({ items: [] });
  });

  it("auto 按出现最多的符号分割", () => {
    expect(splitText("a，b，c", { delimiter: "auto" }).items).toEqual(["a", "b", "c"]);
  });

  it("auto 无符号时按换行分割", () => {
    expect(splitText("a\nb\nc", { delimiter: "auto" }).items).toEqual(["a", "b", "c"]);
  });

  it("auto 空格分割会合并连续空白", () => {
    expect(splitText("a b  c", { delimiter: "auto" }).items).toEqual(["a", "b", "c"]);
  });

  it("换行分割兼容 CRLF", () => {
    expect(splitText("a\r\nb\nc", { delimiter: "newline" }).items).toEqual(["a", "b", "c"]);
  });

  it.each([
    ["comma", "a,b,c"],
    ["cn-comma", "a，b，c"],
    ["semicolon", "a;b;c"],
    ["cn-semicolon", "a；b；c"],
  ] as const)("%s 分割", (delimiter, text) => {
    expect(splitText(text, { delimiter }).items).toEqual(["a", "b", "c"]);
  });

  it("顿号分割", () => {
    expect(splitText("一、二、三", { delimiter: "cn-dunhao" }).items).toEqual(["一", "二", "三"]);
  });

  it("空格 / Tab 分割", () => {
    expect(splitText("a b\tc", { delimiter: "space" }).items).toEqual(["a", "b", "c"]);
  });

  it("自定义正则分割", () => {
    expect(splitText("a1b2c", { delimiter: "custom", customRegex: "\\d" }).items).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("自定义正则为空时报错", () => {
    const r = splitText("abc", { delimiter: "custom", customRegex: "" });
    expect(r.error).toBeTruthy();
  });

  it("自定义正则无效时报错", () => {
    const r = splitText("abc", { delimiter: "custom", customRegex: "(" });
    expect(r.error).toBeTruthy();
  });

  it("默认 trim 并忽略空项", () => {
    expect(splitText(" a , b, ,c ", { delimiter: "comma" }).items).toEqual(["a", "b", "c"]);
  });

  it("trim 关闭时保留空白（仍忽略空项）", () => {
    expect(splitText(" a , b", { delimiter: "comma", trim: false }).items).toEqual([" a ", " b"]);
  });

  it("dedupe 去重并保持首次出现顺序", () => {
    expect(splitText("a,b,a,c", { delimiter: "comma", dedupe: true }).items).toEqual([
      "a",
      "b",
      "c",
    ]);
  });
});

describe("splitLines", () => {
  it("按行拆分并去除首尾空白与空行", () => {
    expect(splitLines("a\n b \n\n  \nc")).toEqual(["a", "b", "c"]);
  });

  it("兼容 CRLF", () => {
    expect(splitLines("a\r\nb")).toEqual(["a", "b"]);
  });

  it("空文本返回空数组", () => {
    expect(splitLines("")).toEqual([]);
  });
});
