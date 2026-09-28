import { describe, expect, it } from "vitest";
import { DEFAULT_FONT_FAMILY, DEFAULT_FONT_SIZE, normalizeSettings } from "./settingsMigration";

describe("normalizeSettings", () => {
  it("保留合法取值", () => {
    const s = normalizeSettings({
      theme: "dark",
      fontSize: 18,
      wordWrap: false,
      editorFontFamily: "Fira Code",
      stagingWidth: 400,
      editorSplit: 0.4,
      stagingTemplateHeight: 300,
    });
    expect(s).toEqual({
      theme: "dark",
      fontSize: 18,
      wordWrap: false,
      editorFontFamily: "Fira Code",
      stagingWidth: 400,
      editorSplit: 0.4,
      stagingTemplateHeight: 300,
    });
  });

  it("非法或不存在的取值回落到默认值", () => {
    const s = normalizeSettings({});
    expect(s.theme).toBe("system");
    expect(s.fontSize).toBe(DEFAULT_FONT_SIZE);
    expect(s.wordWrap).toBe(true);
    expect(s.editorFontFamily).toBe(DEFAULT_FONT_FAMILY);
    expect(s.stagingWidth).toBeUndefined();
    expect(s.editorSplit).toBeUndefined();
    expect(s.stagingTemplateHeight).toBeUndefined();
  });

  it("类型不对的字段不写入（防止字符串字号导致渲染崩溃）", () => {
    const s = normalizeSettings({
      theme: "purple",
      fontSize: "big",
      wordWrap: 0,
      editorFontFamily: 123,
      stagingWidth: "宽",
      editorSplit: "0.5",
      stagingTemplateHeight: null,
    });
    expect(s.theme).toBe("system");
    expect(s.fontSize).toBe(DEFAULT_FONT_SIZE);
    expect(s.wordWrap).toBe(true);
    expect(s.editorFontFamily).toBe(DEFAULT_FONT_FAMILY);
    expect(s.stagingWidth).toBeUndefined();
    expect(s.editorSplit).toBeUndefined();
    expect(s.stagingTemplateHeight).toBeUndefined();
  });

  it("字号与分栏比例做范围收敛，避免越界值破坏布局", () => {
    expect(normalizeSettings({ fontSize: 999 }).fontSize).toBe(24);
    expect(normalizeSettings({ fontSize: 1 }).fontSize).toBe(10);
    expect(normalizeSettings({ editorSplit: 5 }).editorSplit).toBe(0.75);
    expect(normalizeSettings({ editorSplit: -1 }).editorSplit).toBe(0.25);
  });

  it("非对象输入返回默认设置", () => {
    expect(normalizeSettings(null).fontSize).toBe(DEFAULT_FONT_SIZE);
    expect(normalizeSettings("坏数据").theme).toBe("system");
  });
});
