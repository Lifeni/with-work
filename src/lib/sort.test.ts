import { describe, expect, it } from "vitest";
import { sortAlphabetical, sortByReference } from "./sort";

describe("sortByReference", () => {
  it("按参考列表顺序排列", () => {
    const r = sortByReference(["c", "a", "b"], ["a", "b", "c"]);
    expect(r.sorted).toEqual(["a", "b", "c"]);
    expect(r.unmatched).toEqual([]);
  });

  it("未匹配项单独收集且保持原相对顺序", () => {
    const r = sortByReference(["x", "b", "y", "a", "x"], ["a", "b"]);
    expect(r.sorted).toEqual(["a", "b"]);
    expect(r.unmatched).toEqual(["x", "y", "x"]);
  });

  it("条目首尾空格不影响匹配（匹配键去空白）", () => {
    const r = sortByReference([" b ", "a"], ["a", "b"]);
    expect(r.sorted).toEqual(["a", " b "]);
    expect(r.unmatched).toEqual([]);
  });

  it("参考列表中的空白项被忽略", () => {
    const r = sortByReference(["a"], ["", "a"]);
    expect(r.sorted).toEqual(["a"]);
    expect(r.unmatched).toEqual([]);
  });

  it("参考列表重复项只取首个索引，相同顺序保持输入相对顺序", () => {
    const r = sortByReference(["b", "a", "b"], ["a", "b", "b"]);
    expect(r.sorted).toEqual(["a", "b", "b"]);
  });

  it("空参考列表时全部视为未匹配", () => {
    const r = sortByReference(["a", "b"], []);
    expect(r.sorted).toEqual([]);
    expect(r.unmatched).toEqual(["a", "b"]);
  });

  it("空输入返回空结果", () => {
    const r = sortByReference([], ["a"]);
    expect(r.sorted).toEqual([]);
    expect(r.unmatched).toEqual([]);
  });
});

describe("sortAlphabetical", () => {
  it("升序排列", () => {
    expect(sortAlphabetical(["b", "a", "c"], "asc")).toEqual(["a", "b", "c"]);
  });

  it("降序排列", () => {
    expect(sortAlphabetical(["b", "a", "c"], "desc")).toEqual(["c", "b", "a"]);
  });

  it("中文按拼音排序", () => {
    expect(sortAlphabetical(["中文", "苹果", "香蕉"], "asc")).toEqual(["苹果", "香蕉", "中文"]);
  });

  it("不修改原数组", () => {
    const items = ["b", "a"];
    sortAlphabetical(items, "asc");
    expect(items).toEqual(["b", "a"]);
  });
});
