/** 单个文本文件导入上限，避免误拖超大文件造成界面冻结 */
export const MAX_TEXT_FILE_SIZE = 20 * 1024 * 1024;

export const TEXT_FILE_EXTENSIONS = [
  ".txt",
  ".md",
  ".markdown",
  ".csv",
  ".tsv",
  ".json",
  ".jsonc",
  ".log",
  ".xml",
  ".html",
  ".htm",
  ".css",
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".yaml",
  ".yml",
  ".ini",
  ".toml",
  ".sql",
  ".sh",
  ".py",
  ".java",
  ".go",
  ".rs",
  ".c",
  ".cpp",
  ".h",
];

export const TEXT_FILE_ACCEPT = TEXT_FILE_EXTENSIONS.join(",");

/** 文件主名作为工作区名；去掉最后一个扩展名，保留隐藏文件名（如 .env） */
export function workspaceNameFromFile(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, "").trim();
  return base || fileName.trim() || "未命名文件";
}

export async function readTextFile(
  file: File,
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  if (file.size > MAX_TEXT_FILE_SIZE) {
    return { ok: false, error: `文件过大（上限 ${MAX_TEXT_FILE_SIZE / 1024 / 1024}MB）` };
  }
  try {
    return { ok: true, text: await file.text() };
  } catch {
    return { ok: false, error: "无法读取文件内容" };
  }
}
