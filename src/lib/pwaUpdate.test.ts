import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PWA_UPDATE_CHECK_INTERVAL_MS,
  startPwaUpdate,
  type PwaUpdateController,
} from "@/lib/pwaUpdate";

type Listener = EventListenerOrEventListenerObject;

function invoke(listener: Listener | undefined, event: Event) {
  if (!listener) return;
  if (typeof listener === "function") listener(event);
  else listener.handleEvent(event);
}

function createWorker() {
  const listeners = new Map<string, Listener>();
  let state: ServiceWorkerState = "installing";
  const worker = {
    get state() {
      return state;
    },
    postMessage: vi.fn(),
    addEventListener: vi.fn((type: string, listener: Listener) => {
      listeners.set(type, listener);
    }),
    removeEventListener: vi.fn((type: string) => {
      listeners.delete(type);
    }),
  };
  return {
    worker: worker as unknown as ServiceWorker,
    setState(next: ServiceWorkerState) {
      state = next;
      invoke(listeners.get("statechange"), new Event("statechange"));
    },
  };
}

function createRegistration() {
  const updateFoundListeners = new Map<string, Listener>();
  let installing: ServiceWorker | null = null;
  let waiting: ServiceWorker | null = null;
  const registration = {
    get installing() {
      return installing;
    },
    get waiting() {
      return waiting;
    },
    update: vi.fn(async () => registration),
    addEventListener: vi.fn((type: string, listener: Listener) => {
      updateFoundListeners.set(type, listener);
    }),
    removeEventListener: vi.fn((type: string) => {
      updateFoundListeners.delete(type);
    }),
  };
  return {
    registration: registration as unknown as ServiceWorkerRegistration,
    setUpdating(worker: ServiceWorker | null) {
      installing = worker;
    },
    setWaiting(worker: ServiceWorker | null) {
      waiting = worker;
    },
    emitUpdateFound() {
      invoke(updateFoundListeners.get("updatefound"), new Event("updatefound"));
    },
  };
}

function createContainer(registration: ServiceWorkerRegistration) {
  const controllerChangeListeners = new Set<Listener>();
  const container = {
    controller: {} as ServiceWorker | null,
    register: vi.fn(async () => registration),
    addEventListener: vi.fn((type: string, listener: Listener) => {
      if (type === "controllerchange") controllerChangeListeners.add(listener);
    }),
    removeEventListener: vi.fn((type: string, listener: Listener) => {
      if (type === "controllerchange") controllerChangeListeners.delete(listener);
    }),
  };
  return {
    container,
    emitControllerChange() {
      for (const listener of controllerChangeListeners) {
        invoke(listener, new Event("controllerchange"));
      }
    },
    controllerChangeListenerCount: () => controllerChangeListeners.size,
  };
}

let runtime: PwaUpdateController | null = null;
let originalServiceWorker: PropertyDescriptor | undefined;
let originalVisibility: PropertyDescriptor | undefined;

beforeEach(() => {
  vi.useFakeTimers();
  originalServiceWorker = Object.getOwnPropertyDescriptor(navigator, "serviceWorker");
  originalVisibility = Object.getOwnPropertyDescriptor(document, "visibilityState");
});

afterEach(() => {
  runtime?.dispose();
  runtime = null;
  vi.useRealTimers();
  if (originalServiceWorker) {
    Object.defineProperty(navigator, "serviceWorker", originalServiceWorker);
  } else {
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: undefined,
    });
  }
  if (originalVisibility) {
    Object.defineProperty(document, "visibilityState", originalVisibility);
  } else {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
  }
});

function installServiceWorker(container: ReturnType<typeof createContainer>["container"]) {
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: container,
  });
}

describe("PWA 更新检测", () => {
  it("注册后立即检查，并定时、回到页面或恢复网络时补查", async () => {
    const registration = createRegistration();
    const container = createContainer(registration.registration);
    installServiceWorker(container.container);
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    runtime = startPwaUpdate({ onNeedRefresh: () => {} });
    await runtime.ready;

    expect(container.container.register).toHaveBeenCalledWith("/sw.js", { scope: "/" });
    expect(registration.registration.update).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(PWA_UPDATE_CHECK_INTERVAL_MS);
    expect(registration.registration.update).toHaveBeenCalledTimes(2);

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));
    await Promise.resolve();
    expect(registration.registration.update).toHaveBeenCalledTimes(3);

    window.dispatchEvent(new Event("online"));
    await Promise.resolve();
    expect(registration.registration.update).toHaveBeenCalledTimes(4);
  });

  it("新 Service Worker 安装完成后只提示一次", async () => {
    const registration = createRegistration();
    const container = createContainer(registration.registration);
    installServiceWorker(container.container);
    const worker = createWorker();
    const onNeedRefresh = vi.fn();
    runtime = startPwaUpdate({ onNeedRefresh });
    await runtime.ready;

    registration.setUpdating(worker.worker);
    registration.emitUpdateFound();
    registration.setWaiting(worker.worker);
    worker.setState("installed");
    worker.setState("installed");

    expect(onNeedRefresh).toHaveBeenCalledTimes(1);
  });

  it("首次安装生成的 worker 不提示更新", async () => {
    const registration = createRegistration();
    const container = createContainer(registration.registration);
    container.container.controller = null;
    installServiceWorker(container.container);
    const worker = createWorker();
    const onNeedRefresh = vi.fn();
    runtime = startPwaUpdate({ onNeedRefresh });
    await runtime.ready;

    registration.setUpdating(worker.worker);
    registration.emitUpdateFound();
    registration.setWaiting(worker.worker);
    worker.setState("installed");

    expect(onNeedRefresh).not.toHaveBeenCalled();
  });

  it("用户确认更新时先落盘，再激活新 worker 并刷新", async () => {
    const registration = createRegistration();
    const container = createContainer(registration.registration);
    installServiceWorker(container.container);
    const calls: string[] = [];
    const worker = createWorker();
    worker.worker.postMessage = vi.fn(() => calls.push("postMessage"));
    const onNeedRefresh = vi.fn();
    const reloadPage = vi.fn(() => calls.push("reload"));
    runtime = startPwaUpdate({
      onNeedRefresh,
      beforeUpdate: () => {
        calls.push("flush");
      },
      reloadPage,
    });
    await runtime.ready;

    registration.setUpdating(worker.worker);
    registration.emitUpdateFound();
    registration.setWaiting(worker.worker);
    worker.setState("installed");
    onNeedRefresh.mockClear();

    const pending = runtime.updateServiceWorker();
    await Promise.resolve();
    expect(worker.worker.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });

    container.emitControllerChange();
    await pending;
    expect(calls).toEqual(["flush", "postMessage", "reload"]);
    expect(reloadPage).toHaveBeenCalledTimes(1);
    expect(container.controllerChangeListenerCount()).toBe(0);
  });

  it("连续发布时优先激活注册对象上最新的等待 worker", async () => {
    const registration = createRegistration();
    const container = createContainer(registration.registration);
    installServiceWorker(container.container);
    const oldWorker = createWorker();
    const newestWorker = createWorker();
    const onNeedRefresh = vi.fn();
    runtime = startPwaUpdate({ onNeedRefresh, reloadPage: () => {} });
    await runtime.ready;

    registration.setUpdating(oldWorker.worker);
    registration.emitUpdateFound();
    registration.setWaiting(oldWorker.worker);
    oldWorker.setState("installed");
    registration.setWaiting(newestWorker.worker);

    const pending = runtime.updateServiceWorker();
    await Promise.resolve();

    expect(oldWorker.worker.postMessage).not.toHaveBeenCalled();
    expect(newestWorker.worker.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
    container.emitControllerChange();
    await pending;
  });
});
