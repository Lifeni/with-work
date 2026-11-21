import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { nextTick } from "vue";
import {
  PERSIST_DEBOUNCE_MS,
  enablePersist,
  flushPersist,
  hydratePersistence,
  persistPlugin,
  persistenceState,
  resetPersistenceForTests,
} from "@/stores/persist";
import { clearAllStoredData } from "@/lib/backup";
import {
  clearPersistedValues,
  readPersistedValues,
  resetPersistenceDbConnection,
  writePersistedValue,
} from "@/lib/persistenceDb";
import { PERSIST_META_KEY } from "@/lib/storageKeys";
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

beforeEach(async () => {
  localStorage.clear();
  resetPersistenceForTests();
  resetPersistenceDbConnection();
  await clearPersistedValues();
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

async function settleWrites() {
  await waitForWrite();
  await flushPersist();
}

describe("持久化插件", () => {
  it("store 修改后自动写入 localStorage", async () => {
    useStagingStore().add("你好");
    expect(persistenceState.status).toBe("saving");
    await settleWrites();

    expect(persistenceState.status).toBe("saved");
    expect(persistenceState.savedAt).toBeTypeOf("number");
    const raw = localStorage.getItem("ww:staging");
    expect(raw).toBeTruthy();
    const data = JSON.parse(raw!);
    expect(data.items[0].text).toBe("你好");
  });

  it("写入内容为干净 JSON（可被读取恢复）", async () => {
    const ws = useWorkspaceStore();
    const id = ws.createWorkspace();
    ws.setLeft(id, "左侧内容");
    await settleWrites();

    const raw = localStorage.getItem("ww:workspaces");
    const data = JSON.parse(raw!);
    expect(data.workspaces[0].left).toBe("左侧内容");
    expect(data.workspaces[0].id).toBe(id);
  });

  it("模拟刷新：重新创建 pinia 后从 localStorage 恢复", async () => {
    const ws = useWorkspaceStore();
    const id = ws.createWorkspace();
    ws.setLeft(id, "刷新前的内容");
    await settleWrites();

    // 模拟页面刷新：清空内存中的 pinia，重新加载插件
    const pinia2 = createPinia();
    pinia2.use(persistPlugin);
    pinia2.install(mockApp as never);
    setActivePinia(pinia2);
    await nextTick();

    const restored = useWorkspaceStore().workspaces.find((w) => w.id === id);
    expect(restored?.left).toBe("刷新前的内容");
  });

  it("大工作区自动压缩写入并可在刷新后恢复", async () => {
    const content = "重复内容\n".repeat(120_000);
    const ws = useWorkspaceStore();
    const id = ws.createWorkspace();
    ws.setLeft(id, content);
    await settleWrites();

    const raw = localStorage.getItem("ww:workspaces");
    expect(raw?.startsWith("lz:")).toBe(true);
    expect(raw!.length).toBeLessThan(content.length);

    const pinia2 = createPinia();
    pinia2.use(persistPlugin);
    pinia2.install(mockApp as never);
    setActivePinia(pinia2);

    const restored = useWorkspaceStore().workspaces.find((w) => w.id === id);
    expect(restored?.left).toBe(content);
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
    await settleWrites();
    expect(localStorage.getItem("ww:ui")).toBeNull();
  });

  it("设置变化同样自动保存", async () => {
    useSettingsStore().setFontSize(20);
    await settleWrites();
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
    await settleWrites();
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
    await settleWrites();

    const workspaceWrites = setItem.mock.calls.filter(([k]) => k === "ww:workspaces").length;
    expect(workspaceWrites).toBe(1);
    expect(JSON.parse(localStorage.getItem("ww:workspaces")!).workspaces[0].left).toBe("第三次");
    setItem.mockRestore();
  });

  it("flushPersist 立即写出待写状态（关页前落盘）", async () => {
    const ws = useWorkspaceStore();
    const id = ws.createWorkspace();
    ws.setLeft(id, "未落盘的内容");

    await flushPersist();

    expect(JSON.parse(localStorage.getItem("ww:workspaces")!).workspaces[0].left).toBe(
      "未落盘的内容",
    );
  });

  it("清空数据后待写任务不会把旧数据写回", async () => {
    const ws = useWorkspaceStore();
    const id = ws.createWorkspace();
    ws.setLeft(id, "应当被清掉的内容");

    await clearAllStoredData();
    await flushPersist();

    expect(localStorage.getItem("ww:workspaces")).toBeNull();
  });

  it("localStorage 写失败但 IndexedDB 成功时不误报失败", async () => {
    const { useToastStore } = await import("@/stores/toast");
    const setItem = vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });

    const ws = useWorkspaceStore();
    ws.setLeft(ws.createWorkspace(), "IndexedDB 仍应保存的内容");
    await settleWrites();

    expect(useToastStore().toasts.some((t) => t.message.includes("写入失败"))).toBe(false);
    expect(persistenceState.status).toBe("saved");
    const stored = await readPersistedValues();
    expect(JSON.parse(stored.get("ww:workspaces")!.value).workspaces[0].left).toBe(
      "IndexedDB 仍应保存的内容",
    );

    setItem.mockRestore();
  });

  it("pinia 重建后旧 store 的迟到变更不会覆盖新 store 的数据", async () => {
    const oldStore = useWorkspaceStore();
    const oldId = oldStore.createWorkspace();
    oldStore.setLeft(oldId, "旧实例内容");
    await settleWrites();

    // 模拟重建 pinia：旧 store 实例被丢弃，新实例接管同一个存储键
    const pinia2 = createPinia();
    pinia2.use(persistPlugin);
    pinia2.install(mockApp as never);
    setActivePinia(pinia2);
    const newStore = useWorkspaceStore();
    const newId = newStore.createWorkspace();
    newStore.setLeft(newId, "新实例内容");
    await settleWrites();

    // 旧实例的迟到变更：不得覆盖新实例已落盘的数据
    oldStore.setLeft(oldId, "旧实例的迟到变更");
    await settleWrites();

    const stored = JSON.parse(localStorage.getItem("ww:workspaces")!);
    expect(stored.workspaces.map((w: { left: string }) => w.left)).toEqual([
      "旧实例内容",
      "新实例内容",
    ]);
    expect(JSON.stringify(stored)).not.toContain("迟到");
  });

  it("其他 key 写成功不会让持续失败的 key 重复提示", async () => {
    const { useToastStore } = await import("@/stores/toast");
    resetPersistenceDbConnection();
    vi.stubGlobal("indexedDB", undefined);
    const setItem = vi.spyOn(localStorage, "setItem").mockImplementation((key: string) => {
      if (key === "ww:workspaces") throw new Error("QuotaExceededError");
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const ws = useWorkspaceStore();
    const id = ws.createWorkspace();
    ws.setLeft(id, "第一次写失败");
    await settleWrites();

    // 另一个 key 写成功：不应因此让 workspace 的失败重新提示
    useSettingsStore().setFontSize(18);
    await settleWrites();

    ws.setLeft(id, "第二次写失败");
    await settleWrites();

    const failures = useToastStore().toasts.filter((t) => t.message.includes("写入失败"));
    expect(failures).toHaveLength(1);

    setItem.mockRestore();
    warn.mockRestore();
    vi.unstubAllGlobals();
    resetPersistenceDbConnection();
  });

  it("恢复设置时校验字段类型，非法字号不会进入 store", () => {
    localStorage.setItem(
      "ww:settings",
      JSON.stringify({
        state: { theme: "dark", fontSize: "big", wordWrap: 0 },
        version: 0,
      }),
    );
    const pinia = createPinia();
    pinia.use(persistPlugin);
    pinia.install(mockApp as never);
    setActivePinia(pinia);

    const settings = useSettingsStore();
    expect(settings.theme).toBe("dark");
    expect(settings.fontSize).toBe(14);
    expect(settings.wordWrap).toBe(true);
  });

  it("首次启动把旧 localStorage 数据迁移到 IndexedDB", async () => {
    localStorage.setItem(
      "ww:staging",
      JSON.stringify({ items: [{ id: "legacy", text: "旧数据", createdAt: 1 }] }),
    );

    await hydratePersistence();

    const stored = await readPersistedValues();
    const migrated = stored.get("ww:staging");
    expect(migrated).toBeTruthy();
    expect(JSON.parse(migrated!.value).items[0].text).toBe("旧数据");
  });

  it("IndexedDB 比镜像新时用 IndexedDB 回填 localStorage", async () => {
    localStorage.setItem(
      "ww:staging",
      JSON.stringify({ items: [{ id: "old", text: "镜像旧值", createdAt: 1 }] }),
    );
    localStorage.setItem(PERSIST_META_KEY, JSON.stringify({ "ww:staging": 10 }));
    await writePersistedValue({
      key: "ww:staging",
      value: JSON.stringify({ items: [{ id: "new", text: "主存储新值", createdAt: 2 }] }),
      updatedAt: 20,
    });

    await hydratePersistence();

    const mirrored = JSON.parse(localStorage.getItem("ww:staging")!);
    expect(mirrored.items[0].text).toBe("主存储新值");
    expect(JSON.parse(localStorage.getItem(PERSIST_META_KEY)!)["ww:staging"]).toBe(20);
  });

  it("清空数据同时清除 IndexedDB 与镜像时间戳", async () => {
    await writePersistedValue({
      key: "ww:staging",
      value: JSON.stringify({ items: [] }),
      updatedAt: Date.now(),
    });
    localStorage.setItem(PERSIST_META_KEY, JSON.stringify({ "ww:staging": 1 }));

    await clearAllStoredData();

    expect((await readPersistedValues()).size).toBe(0);
    expect(localStorage.getItem(PERSIST_META_KEY)).toBeNull();
  });

  it("本地镜像与 IndexedDB 都失败时才提示错误", async () => {
    const { useToastStore } = await import("@/stores/toast");
    resetPersistenceDbConnection();
    vi.stubGlobal("indexedDB", undefined);
    const setItem = vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const ws = useWorkspaceStore();
    ws.setLeft(ws.createWorkspace(), "两层都写不进");
    await settleWrites();

    expect(warn).toHaveBeenCalled();
    expect(useToastStore().toasts.some((t) => t.message.includes("写入失败"))).toBe(true);
    expect(persistenceState.status).toBe("error");
    expect(persistenceState.error).toContain("写入失败");

    setItem.mockRestore();
    warn.mockRestore();
    vi.unstubAllGlobals();
    resetPersistenceDbConnection();
  });

  it("镜像时间戳写失败且 IndexedDB 不可用时报告保存失败", async () => {
    const { useToastStore } = await import("@/stores/toast");
    resetPersistenceDbConnection();
    vi.stubGlobal("indexedDB", undefined);
    const setItem = vi.spyOn(localStorage, "setItem").mockImplementation((key: string) => {
      if (key === PERSIST_META_KEY) throw new Error("QuotaExceededError");
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const ws = useWorkspaceStore();
    ws.setLeft(ws.createWorkspace(), "值写入成功但时间戳失败");
    await settleWrites();

    expect(persistenceState.status).toBe("error");
    expect(useToastStore().toasts.some((item) => item.message.includes("写入失败"))).toBe(true);

    setItem.mockRestore();
    warn.mockRestore();
    vi.unstubAllGlobals();
    resetPersistenceDbConnection();
  });
});
