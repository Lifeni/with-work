import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// lib/theme 依赖 monaco（浏览器专用），组件测试统一拦截，避免加载 monaco 与 worker 模块
vi.mock("@/lib/theme", () => ({
  applyTheme: () => {},
  initTheme: () => {},
}));

// vitest 未开启 globals，@testing-library/react 不会自动清理，手动在每个用例后卸载组件
afterEach(() => {
  cleanup();
});

/** 测试环境基础能力：
 *  - localStorage：Node 22 实验性实现未配置时不可用，jsdom 注入可能被其遮挡，显式覆盖
 *  - matchMedia / URL.createObjectURL / navigator.clipboard：jsdom 缺失的浏览器 API */

class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length() {
    return this.store.size;
  }

  clear() {
    this.store.clear();
  }

  getItem(key: string) {
    return this.store.get(key) ?? null;
  }

  key(index: number) {
    return [...this.store.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.store.delete(key);
  }

  setItem(key: string, value: string) {
    this.store.set(key, String(value));
  }
}

const storage = new MemoryStorage();

function defineLocalStorage(target: object) {
  Object.defineProperty(target, "localStorage", {
    value: storage,
    writable: true,
    configurable: true,
  });
}

defineLocalStorage(globalThis);
if (typeof window !== "undefined") defineLocalStorage(window);

if (typeof window.matchMedia !== "function") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

if (typeof URL.createObjectURL === "undefined") {
  URL.createObjectURL = () => "blob:mock-url";
  URL.revokeObjectURL = () => {};
}

Object.defineProperty(navigator, "clipboard", {
  configurable: true,
  value: { writeText: async () => {} },
});
