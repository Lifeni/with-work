import type { GlobalThemeOverrides } from "naive-ui";

/** 产品界面字体栈：英文 Inter，中文优先常见系统中文字体。 */
export const NAIVE_FONT_FAMILY = [
  "Inter",
  "MiSans",
  "HarmonyOS Sans SC",
  "Source Han Sans SC",
  "Noto Sans SC",
  "system-ui",
  "-apple-system",
  "Segoe UI",
  "sans-serif",
].join(",");

/** 表单、按钮、菜单统一使用的控件字号。 */
export const NAIVE_CONTROL_FONT_SIZE = "12px";

/** 下拉菜单与选择器统一使用的紧凑行高。 */
export const NAIVE_MENU_OPTION_HEIGHT = "28px";

const LIGHT_PRIMARY = {
  color: "#6d28d9",
  hover: "#7c3aed",
  pressed: "#5b21b6",
};

const DARK_PRIMARY = {
  color: "#a78bfa",
  hover: "#c4b5fd",
  pressed: "#a78bfa",
};

/**
 * Naive UI 主题覆盖的唯一维护入口。
 * 组件级差异应优先放在 `components/ui` 薄封装中，避免在业务组件里散落 `--n-*` 覆盖。
 */
export function createNaiveThemeOverrides(dark: boolean): GlobalThemeOverrides {
  const primary = dark ? DARK_PRIMARY : LIGHT_PRIMARY;
  return {
    common: {
      fontFamily: NAIVE_FONT_FAMILY,
      primaryColor: primary.color,
      primaryColorHover: primary.hover,
      primaryColorPressed: primary.pressed,
      primaryColorSuppl: primary.color,
      borderRadius: "6px",
    },
    Tooltip: {
      padding: "5px 8px",
      peers: {
        Popover: {
          fontSize: NAIVE_CONTROL_FONT_SIZE,
        },
      },
    },
    Input: {
      fontSizeSmall: NAIVE_CONTROL_FONT_SIZE,
    },
    Dropdown: {
      fontSizeSmall: NAIVE_CONTROL_FONT_SIZE,
      optionHeightSmall: NAIVE_MENU_OPTION_HEIGHT,
      color: "var(--popover)",
      optionTextColor: "var(--popover-foreground)",
      optionTextColorHover: "var(--popover-foreground)",
      optionTextColorActive: "var(--primary)",
      suffixColor: "var(--muted-foreground)",
      prefixColor: "var(--muted-foreground)",
      groupHeaderTextColor: "var(--muted-foreground)",
      dividerColor: "var(--border)",
    },
    Select: {
      peers: {
        InternalSelection: {
          fontSizeSmall: NAIVE_CONTROL_FONT_SIZE,
          fontWeight: "400",
        },
        InternalSelectMenu: {
          optionFontSizeSmall: NAIVE_CONTROL_FONT_SIZE,
          optionHeightSmall: NAIVE_MENU_OPTION_HEIGHT,
          color: "var(--popover)",
          optionTextColor: "var(--popover-foreground)",
          optionTextColorPressed: "var(--primary)",
          optionTextColorActive: "var(--primary)",
          groupHeaderTextColor: "var(--muted-foreground)",
          actionTextColor: "var(--muted-foreground)",
        },
      },
    },
    Radio: {
      fontSizeSmall: NAIVE_CONTROL_FONT_SIZE,
    },
  };
}
