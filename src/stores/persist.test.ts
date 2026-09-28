import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { nextTick } from "vue";
import { PERSIST_DEBOUNCE_MS, enablePersist, flushPersist, persistPlugin } from "@/stores/persist";
import { clearAllStoredData } from "@/lib/backup";
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
  // clearAllStoredData 会停写（真实场景里随后就 reload），测试之间需要恢复
  enablePersist();
  const pinia = createPinia();
  pinia.use(persistPlugin);
  // 模拟 app.use(pinia)：install 后插件进入 _p 并激活
  pinia.install(mockApp as never);
  setActivePinia(pinia);
});

/** 等待防抖写盘完成（真实定时器，比防抖窗口多留一点余量） */
function waitForWrite() {
  return new Promise((r) => setTimeout(r, PERSIST_DEBOUNCE_MS + 50));
}

describe("持久化插件", () => {
  it("store 修改后自动写入 localStorage", async () => {
    useStagingStore().add("你好");
    await waitForWrite();

    const raw = localStorage.getItem("ww:staging");
    expect(raw).toBeTruthy();
    const data = JSON.parse(raw!);
    expect(data.items[0].text).toBe("你好");
  });

  it("写入内容为干净 JSON（可被读取恢复）", async () => {
    const ws = useWorkspaceStore();
    const id = ws.createWorkspace();
    ws.setLeft(id, "左侧内容");
    await waitForWrite();

    const raw = localStorage.getItem("ww:workspaces");
    const data = JSON.parse(raw!);
    expect(data.workspaces[0].left).toBe("左侧内容");
    expect(data.workspaces[0].id).toBe(id);
  });

  it("模拟刷新：重新创建 pinia 后从 localStorage 恢复", async () => {
    const ws = useWorkspaceStore();
    const id = ws.createWorkspace();
    ws.setLeft(id, "刷新前的内容");
    await waitForWrite();

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

  it("恢复旧版单栏工作区时把 content 迁移到左栏", () => {
    localStorage.setItem(
      "ww:workspaces",
      JSON.stringify({
        state: {
          workspaces: [{ id: "old-ws", name: "旧工作区", content: "旧版单栏内容" }],
          activeId: "old-ws",
        },
        version: 0,
      }),
    );
    const pinia = createPinia();
    pinia.use(persistPlugin);
    pinia.install(mockApp as never);
    setActivePinia(pinia);

    const ws = useWorkspaceStore();
    expect(ws.workspaces[0].left).toBe("旧版单栏内容");
    expect(ws.activeId).toBe("old-ws");
  });

  it("未登记的 store（ui）不写 localStorage", async () => {
    const { useUiStore } = await import("@/stores/ui");
    useUiStore().setStagingOpen(false);
    await waitForWrite();
    expect(localStorage.getItem("ww:ui")).toBeNull();
  });

  it("设置变化同样自动保存", async () => {
    useSettingsStore().setFontSize(20);
    await waitForWrite();
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
    await waitForWrite();
    expect(JSON.parse(localStorage.getItem("ww:rules")!).rules[0].name).toBe("规则");
  });

  it("连续修改合并为一次写入（防抖）", async () => {
    const setItem = vi.spyOn(localStorage, "setItem");
    const ws = useWorkspaceStore();
    const id = ws.createWorkspace();
    // 分三次「按键」修改：每次都等一个 tick，模拟真实输入节奏
    ws.setLeft(id, "第一次");
    await nextTick();
    ws.setLeft(id, "第二次");
    await nextTick();
    ws.setLeft(id, "第三次");
    await waitForWrite();

    const workspaceWrites = setItem.mock.calls.filter(([k]) => k === "ww:workspaces").length;
    expect(workspaceWrites).toBe(1);
    expect(JSON.parse(localStorage.getItem("ww:workspaces")!).workspaces[0].left).toBe("第三次");
    setItem.mockRestore();
  });

  it("flushPersist 立即写出待写状态（关页前落盘）", async () => {
    const ws = useWorkspaceStore();
    const id = ws.createWorkspace();
    ws.setLeft(id, "未落盘的内容");

    flushPersist();

    expect(JSON.parse(localStorage.getItem("ww:workspaces")!).workspaces[0].left).toBe(
      "未落盘的内容",
    );
  });

  it("清空数据后待写任务不会把旧数据写回", async () => {
    const ws = useWorkspaceStore();
    const id = ws.createWorkspace();
    ws.setLeft(id, "应当被清掉的内容");

    clearAllStoredData();
    flushPersist();

    expect(localStorage.getItem("ww:workspaces")).toBeNull();
  });

  it("写盘失败时提示用户而不是静默丢数据", async () => {
    const { useToastStore } = await import("@/stores/toast");
    const setItem = vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const ws = useWorkspaceStore();
    ws.setLeft(ws.createWorkspace(), "写不进的内容");
    await waitForWrite();

    expect(warn).toHaveBeenCalled();
    expect(useToastStore().toasts.some((t) => t.message.includes("写入失败"))).toBe(true);

    setItem.mockRestore();
    warn.mockRestore();
  });

  it("pinia 重建后旧 store 的迟到变更不会覆盖新 store 的数据", async () => {
    const oldStore = useWorkspaceStore();
    const oldId = oldStore.createWorkspace();
    oldStore.setLeft(oldId, "旧实例内容");
    await waitForWrite();

    // 模拟重建 pinia：旧 store 实例被丢弃，新实例接管同一个存储键
    const pinia2 = createPinia();
    pinia2.use(persistPlugin);
    pinia2.install(mockApp as never);
    setActivePinia(pinia2);
    const newStore = useWorkspaceStore();
    const newId = newStore.createWorkspace();
    newStore.setLeft(newId, "新实例内容");
    await waitForWrite();

    // 旧实例的迟到变更：不得覆盖新实例已落盘的数据
    oldStore.setLeft(oldId, "旧实例的迟到变更");
    await waitForWrite();

    const stored = JSON.parse(localStorage.getItem("ww:workspaces")!);
    expect(stored.workspaces.map((w: { left: string }) => w.left)).toEqual([
      "旧实例内容",
      "新实例内容",
    ]);
    expect(JSON.stringify(stored)).not.toContain("迟到");
  });
});
