import { applyMonacoTheme } from "./monaco";
import { useSettingsStore } from "@/stores/settings";
import type { ThemeMode } from "@/types";

export function resolveTheme(mode: ThemeMode): "light" | "dark" {
  if (mode === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return mode;
}

export function applyTheme(mode: ThemeMode) {
  const resolved = resolveTheme(mode);
  document.documentElement.classList.toggle("dark", resolved === "dark");
  applyMonacoTheme(resolved);
}

export function initTheme(mode: ThemeMode) {
  applyTheme(mode);
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (useSettingsStore.getState().theme === "system") applyTheme("system");
  });
}
