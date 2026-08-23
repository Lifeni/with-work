import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { nextTick } from "vue";
import { persistPlugin } from "@/stores/persist";
import { useStagingStore } from "@/stores/staging";
import { useWorkspaceStore } from "@/stores/workspace";
import { useSettingsStore } from "@/stores/settings";
import { useRulesStore } from "@/stores/rules";

/** 最小 app mock：让 pinia.install 正常执行（Pinia 4 中插件在 install 时才真正注册） */
const mockApp = {
  provide: () => {},
  config: { globalProperties: {} },
} as unknown as {
  provide: (key: unknown, value: unknown) => void;
  config: { globalProperties: Record<string, unknown> };
};

beforeEach(() => {
  localStorage.clear();
  const pinia = createPinia();
  pinia.use(persistPlugin);
  // 模拟 app.use(pinia)：install 后插件进入 _p 并激活
  pinia.install(mockApp as never);
  setActivePinia(pinia);
});

describe("持久化插件", () => {
  it("store 修改后自动写入 localStorage", async () => {
    useStagingStore().add("你好");
    await nextTick();

    const raw = localStorage.getItem("ww:staging");
    expect(raw).toBeTruthy();
    const data = JSON.parse(raw!);
    expect(data.items[0].text).toBe("你好");
  });

  it("写入内容为干净 JSON（可被读取恢复）", async () => {
    const ws = useWorkspaceStore();
    const id = ws.createWorkspace();
    ws.setLeft(id, "左侧内容");
    await nextTick();

    const raw = localStorage.getItem("ww:workspaces");
    const data = JSON.parse(raw!);
    expect(data.workspaces[0].left).toBe("左侧内容");
    expect(data.workspaces[0].id).toBe(id);
  });

  it("模拟刷新：重新创建 pinia 后从 localStorage 恢复", async () => {
    const ws = useWorkspaceStore();
    const id = ws.createWorkspace();
    ws.setLeft(id, "刷新前的内容");
    await nextTick();

    // 模拟页面刷新：清空内存中的 pinia，重新加载插件
    const pinia2 = createPinia();
    pinia2.use(persistPlugin);
    pinia2.install(mockApp as never);
    setActivePinia(pinia2);
    await nextTick();

    const restored = useWorkspaceStore().workspaces.find((w) => w.id === id);
    expect(restored?.left).toBe("刷新前的内容");
  });

  it("兼容旧 Zustand 包装格式（{ state, version }）", () => {
    localStorage.setItem(
      "ww:staging",
      JSON.stringify({
        state: { items: [{ id: "old-1", text: "旧数据", createdAt: 1 }] },
        version: 0,
      }),
    );
    const pinia = createPinia();
    pinia.use(persistPlugin);
    pinia.install(mockApp as never);
    setActivePinia(pinia);

    expect(useStagingStore().items[0].text).toBe("旧数据");
  });

  it("未登记的 store（ui）不写 localStorage", async () => {
    const { useUiStore } = await import("@/stores/ui");
    useUiStore().setStagingOpen(false);
    await nextTick();
    expect(localStorage.getItem("ww:ui")).toBeNull();
  });

  it("设置变化同样自动保存", async () => {
    useSettingsStore().setFontSize(20);
    await nextTick();
    const raw = localStorage.getItem("ww:settings");
    expect(JSON.parse(raw!).fontSize).toBe(20);
  });

  it("install 顺序保证：先 use 后 install，创建 store 即带插件", async () => {
    // 模拟 main.ts 现在的顺序：use → install → 创建 store
    const pinia = createPinia();
    pinia.use(persistPlugin);
    pinia.install(mockApp as never);
    setActivePinia(pinia);
    useRulesStore().addRule({
      id: "r1",
      name: "规则",
      find: "a",
      replace: "b",
      isRegex: false,
      matchCase: false,
    });
    await nextTick();
    expect(JSON.parse(localStorage.getItem("ww:rules")!).rules[0].name).toBe("规则");
  });
});
