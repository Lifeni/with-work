import { describe, expect, it } from "vitest";
import {
  NAIVE_CONTROL_FONT_SIZE,
  NAIVE_MENU_OPTION_HEIGHT,
  createNaiveThemeOverrides,
} from "./naiveTheme";

describe("Naive UI 主题配置", () => {
  it("明暗主题共用字体、控件字号与紧凑菜单尺寸", () => {
    const light = createNaiveThemeOverrides(false);
    const dark = createNaiveThemeOverrides(true);

    for (const overrides of [light, dark]) {
      expect(overrides.common?.fontFamily).toContain("Inter");
      expect(overrides.Input?.fontSizeSmall).toBe(NAIVE_CONTROL_FONT_SIZE);
      expect(overrides.Dropdown?.optionHeightSmall).toBe(NAIVE_MENU_OPTION_HEIGHT);
      expect(overrides.Select?.peers?.InternalSelectMenu?.optionHeightSmall).toBe(
        NAIVE_MENU_OPTION_HEIGHT,
      );
    }
  });

  it("明暗主题分别使用对应的品牌主色", () => {
    expect(createNaiveThemeOverrides(false).common?.primaryColor).toBe("#6d28d9");
    expect(createNaiveThemeOverrides(true).common?.primaryColor).toBe("#a78bfa");
  });
});
