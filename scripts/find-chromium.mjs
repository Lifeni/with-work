import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** 优先使用显式路径，其次使用 Playwright 本机已安装的最新 Chromium。 */
export function findChromiumExecutable() {
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  }
  const cacheRoot =
    process.env.PLAYWRIGHT_BROWSERS_PATH ||
    (process.platform === "win32"
      ? join(process.env.LOCALAPPDATA ?? "", "ms-playwright")
      : join(process.env.HOME ?? "", ".cache", "ms-playwright"));
  if (!cacheRoot || !existsSync(cacheRoot)) return undefined;

  const revisions = readdirSync(cacheRoot)
    .filter((name) => /^chromium-\d+$/.test(name))
    .sort((a, b) => Number(b.split("-")[1]) - Number(a.split("-")[1]));
  for (const revision of revisions) {
    const candidates =
      process.platform === "win32"
        ? [join(cacheRoot, revision, "chrome-win64", "chrome.exe")]
        : process.platform === "darwin"
          ? [
              join(
                cacheRoot,
                revision,
                "chrome-mac",
                "Chromium.app",
                "Contents",
                "MacOS",
                "Chromium",
              ),
            ]
          : [join(cacheRoot, revision, "chrome-linux", "chrome")];
    const executable = candidates.find((candidate) => existsSync(candidate));
    if (executable) return executable;
  }
  return undefined;
}
