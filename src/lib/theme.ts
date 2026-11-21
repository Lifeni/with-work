import { ref } from "vue";
import { useSettingsStore } from "@/stores/settings";
import type { ThemeMode } from "@/types";

const systemThemeQuery =
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : null;
const systemDark = ref(systemThemeQuery?.matches ?? false);

export function resolveTheme(mode: ThemeMode): "light" | "dark" {
  if (mode === "system") {
    return systemDark.value ? "dark" : "light";
  }
  return mode;
}

export function applyTheme(mode: ThemeMode) {
  const resolved = resolveTheme(mode);
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

export function initTheme(mode: ThemeMode) {
  systemDark.value = systemThemeQuery?.matches ?? false;
  applyTheme(mode);
  systemThemeQuery?.addEventListener("change", (event) => {
    systemDark.value = event.matches;
    if (useSettingsStore().theme === "system") applyTheme("system");
  });
}
