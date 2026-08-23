import "@testing-library/jest-dom/vitest";
import { createPinia, setActivePinia } from "pinia";
import { afterEach, vi } from "vitest";

// lib/theme 依赖 monaco（浏览器专用），组件测试统一拦截，避免加载 monaco 与 worker 模块
vi.mock("@/lib/theme", () => ({
  applyTheme: () => {},
  initTheme: () => {},
  resolveTheme: () => "light",
}));

// 每个测试文件使用独立的 pinia 实例（store 状态隔离）
setActivePinia(createPinia());

// jsdom 缺失的浏览器 API
if (typeof window !== "undefined" && typeof window.ResizeObserver === "undefined") {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
}

// Teleport 等渲染到 body 的内容在用例间清理
afterEach(() => {
  document.body.innerHTML = "";
});

/**
 * 测试环境基础能力：
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
  value: { writeText: async () => {}, readText: async () => "mock-clipboard" },
});
