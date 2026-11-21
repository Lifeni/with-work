import type { PwaUpdateCheckResult, PwaUpdateController } from "./pwaUpdate";

let activeController: PwaUpdateController | null = null;

export function registerPwaUpdateController(controller: PwaUpdateController) {
  activeController = controller;
}

export function unregisterPwaUpdateController(controller: PwaUpdateController) {
  if (activeController === controller) activeController = null;
}

export async function checkPwaUpdateNow(): Promise<PwaUpdateCheckResult | "unavailable"> {
  if (!activeController) return "unavailable";
  // 启动初期用户可能立刻点“检查更新”；等待首次注册完成，避免误报环境不支持。
  await activeController.ready;
  const result = await activeController.checkForUpdate();
  if (result === "update") activeController.showUpdatePrompt();
  return result;
}
