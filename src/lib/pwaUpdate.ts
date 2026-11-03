/** PWA Service Worker 检查节奏：运行期间每小时检查一次 */
export const PWA_UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

export interface PwaUpdateOptions {
  /** 检测到新版本并等待激活时调用；同一个 worker 只提示一次 */
  onNeedRefresh: () => void;
  /** 注册或检查更新失败时调用（不打断正在使用的页面） */
  onRegisterError?: (error: unknown) => void;
  /** 激活新版本前执行，例如冲刷尚未写盘的编辑内容 */
  beforeUpdate?: () => void | Promise<void>;
  /** 每次更新检查的间隔，测试可覆盖 */
  checkIntervalMs?: number;
  /** 新版本接管后的刷新动作，测试可覆盖 */
  reloadPage?: () => void;
}

export interface PwaUpdateController {
  /** Service Worker 注册与首次检查完成 */
  ready: Promise<void>;
  /** 用户确认后激活等待中的 worker，并刷新页面 */
  updateServiceWorker: () => Promise<void>;
  /** 释放定时器与页面事件监听 */
  dispose: () => void;
}

/**
 * 手动注册部署版 Service Worker，并把「有新版本」交给 UI 决定何时刷新。
 * 不使用自动 reload：编辑器里可能有尚未落盘的本地数据，必须先提示并 flushPersist。
 */
export function startPwaUpdate(options: PwaUpdateOptions): PwaUpdateController {
  const checkIntervalMs = options.checkIntervalMs ?? PWA_UPDATE_CHECK_INTERVAL_MS;
  let disposed = false;
  let checking = false;
  let registration: ServiceWorkerRegistration | null = null;
  let waitingWorker: ServiceWorker | null = null;
  let promptedWorker: ServiceWorker | null = null;
  let checkTimer: ReturnType<typeof setInterval> | null = null;
  let reloadTimer: ReturnType<typeof setTimeout> | null = null;
  let controllerChangeHandler: (() => void) | null = null;

  function reportError(error: unknown) {
    options.onRegisterError?.(error);
  }

  function notifyIfWaiting(worker: ServiceWorker | null | undefined) {
    if (disposed || !worker || promptedWorker === worker || !navigator.serviceWorker.controller) {
      return;
    }
    promptedWorker = worker;
    waitingWorker = worker;
    options.onNeedRefresh();
  }

  function watchInstallingWorker(worker: ServiceWorker | null | undefined) {
    if (!worker) return;
    const handleStateChange = () => {
      if (worker.state === "redundant") {
        worker.removeEventListener("statechange", handleStateChange);
        return;
      }
      if (worker.state !== "installed") return;
      worker.removeEventListener("statechange", handleStateChange);
      notifyIfWaiting(registration?.waiting ?? worker);
    };
    worker.addEventListener("statechange", handleStateChange);
    if (worker.state === "installed") handleStateChange();
  }

  const handleUpdateFound = () => {
    if (disposed || !registration) return;
    watchInstallingWorker(registration.installing);
    notifyIfWaiting(registration.waiting);
  };

  async function checkForUpdate() {
    if (disposed || !registration || checking) return;
    checking = true;
    try {
      const latest = await registration.update();
      if (disposed) return;
      watchInstallingWorker(latest.installing);
      notifyIfWaiting(latest.waiting);
    } catch (error) {
      reportError(error);
    } finally {
      checking = false;
    }
  }

  const handleVisibilityChange = () => {
    if (document.visibilityState === "visible") void checkForUpdate();
  };
  const handleOnline = () => {
    void checkForUpdate();
  };

  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("online", handleOnline);

  const ready = (async () => {
    if (!("serviceWorker" in navigator)) return;
    try {
      registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      if (disposed) return;
      registration.addEventListener("updatefound", handleUpdateFound);
      handleUpdateFound();
      await checkForUpdate();
      if (!disposed) {
        checkTimer = setInterval(() => void checkForUpdate(), checkIntervalMs);
      }
    } catch (error) {
      reportError(error);
    }
  })();

  function reloadPage() {
    if (options.reloadPage) options.reloadPage();
    else window.location.reload();
  }

  async function updateServiceWorker() {
    await options.beforeUpdate?.();
    if (disposed) return;

    // 连续发布时 registration 上的 waiting 才是最新引用
    const worker = registration?.waiting ?? waitingWorker;
    if (!worker) {
      reloadPage();
      return;
    }

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        if (reloadTimer) clearTimeout(reloadTimer);
        reloadTimer = null;
        if (controllerChangeHandler) {
          navigator.serviceWorker.removeEventListener("controllerchange", controllerChangeHandler);
          controllerChangeHandler = null;
        }
        reloadPage();
        resolve();
      };

      controllerChangeHandler = finish;
      navigator.serviceWorker.addEventListener("controllerchange", controllerChangeHandler, {
        once: true,
      });
      // worker 若未按约定激活，也不能让页面永远停在“正在更新”
      reloadTimer = setTimeout(finish, 3000);

      try {
        worker.postMessage({ type: "SKIP_WAITING" });
      } catch (error) {
        if (reloadTimer) clearTimeout(reloadTimer);
        reloadTimer = null;
        if (controllerChangeHandler) {
          navigator.serviceWorker.removeEventListener("controllerchange", controllerChangeHandler);
          controllerChangeHandler = null;
        }
        reject(error);
      }
    });
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    if (checkTimer) clearInterval(checkTimer);
    checkTimer = null;
    if (reloadTimer) clearTimeout(reloadTimer);
    reloadTimer = null;
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    window.removeEventListener("online", handleOnline);
    registration?.removeEventListener("updatefound", handleUpdateFound);
    if (controllerChangeHandler) {
      navigator.serviceWorker.removeEventListener("controllerchange", controllerChangeHandler);
      controllerChangeHandler = null;
    }
  }

  return { ready, updateServiceWorker, dispose };
}
