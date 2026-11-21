import { readTextFile, TEXT_FILE_EXTENSIONS } from "@/lib/fileImport";

/** 通过系统文件选择器打开的文本文件（附带可写回的句柄） */
export interface OpenedTextFile {
  name: string;
  text: string;
  handle?: FileSystemFileHandle;
}

export type OpenTextFileResult =
  { ok: true; file: OpenedTextFile } | { ok: false; cancelled?: boolean; error?: string };

export type SaveTextFileResult =
  | { ok: true; handle: FileSystemFileHandle; name: string }
  | { ok: false; cancelled?: boolean; permissionDenied?: boolean; error?: string };

interface FilePickerAcceptType {
  description?: string;
  accept: Record<string, string | string[]>;
}

interface FilePickerOptions {
  multiple?: boolean;
  excludeAcceptAllOption?: boolean;
  suggestedName?: string;
  types?: FilePickerAcceptType[];
}

interface PermissionCapableHandle extends FileSystemFileHandle {
  queryPermission?: (descriptor?: { mode: "read" | "readwrite" }) => Promise<PermissionState>;
  requestPermission?: (descriptor?: { mode: "read" | "readwrite" }) => Promise<PermissionState>;
}

interface FilePickerWindow extends Window {
  showOpenFilePicker?: (options?: FilePickerOptions) => Promise<FileSystemFileHandle[]>;
  showSaveFilePicker?: (options?: FilePickerOptions) => Promise<FileSystemFileHandle>;
}

const MARKDOWN_EXTENSIONS = [".md", ".markdown"];
const JSON_EXTENSIONS = [".json", ".jsonc"];
const PLAIN_TEXT_EXTENSIONS = TEXT_FILE_EXTENSIONS.filter(
  (extension) => !MARKDOWN_EXTENSIONS.includes(extension) && !JSON_EXTENSIONS.includes(extension),
);

const TEXT_PICKER_TYPES: FilePickerAcceptType[] = [
  {
    description: "文本文件",
    accept: {
      "text/plain": PLAIN_TEXT_EXTENSIONS,
      "text/markdown": MARKDOWN_EXTENSIONS,
      "application/json": JSON_EXTENSIONS,
    },
  },
];

function pickerWindow(): FilePickerWindow | null {
  return typeof window === "undefined" ? null : (window as FilePickerWindow);
}

/** Chromium 系浏览器支持直接读写用户选择的文件 */
export function supportsFileSystemAccess(): boolean {
  return typeof pickerWindow()?.showOpenFilePicker === "function";
}

export function supportsSaveFilePicker(): boolean {
  return typeof pickerWindow()?.showSaveFilePicker === "function";
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof DOMException && error.name === "SecurityError") {
    return "浏览器拒绝了文件访问，请从页面按钮重新操作";
  }
  return fallback;
}

export async function openTextFileWithPicker(): Promise<OpenTextFileResult> {
  const picker = pickerWindow();
  if (!picker?.showOpenFilePicker) {
    return { ok: false, error: "当前浏览器不支持系统文件选择器" };
  }

  try {
    const [handle] = await picker.showOpenFilePicker({
      multiple: false,
      excludeAcceptAllOption: false,
      types: TEXT_PICKER_TYPES,
    });
    if (!handle) return { ok: false, cancelled: true };
    const file = await handle.getFile();
    const result = await readTextFile(file);
    if (!result.ok) return result;
    return {
      ok: true,
      file: { name: file.name || handle.name, text: result.text, handle },
    };
  } catch (error) {
    if (isAbortError(error)) return { ok: false, cancelled: true };
    return { ok: false, error: errorMessage(error, "无法打开文件") };
  }
}

/** 确认句柄仍具备权限；需要用户手势时请求一次 */
export async function ensureFileHandlePermission(
  handle: FileSystemFileHandle,
  mode: "read" | "readwrite",
): Promise<boolean> {
  const permissionHandle = handle as PermissionCapableHandle;
  if (permissionHandle.queryPermission) {
    try {
      const current = await permissionHandle.queryPermission({ mode });
      if (current === "granted") return true;
      if (current === "denied") return false;
    } catch {
      // 查询失败时仍给 requestPermission 一次机会
    }
  }
  if (permissionHandle.requestPermission) {
    try {
      return (await permissionHandle.requestPermission({ mode })) === "granted";
    } catch {
      return false;
    }
  }
  // 老实现没有 Permissions API 时，句柄通常来自本次用户选择，直接尝试使用
  return true;
}

export async function writeTextToHandle(
  handle: FileSystemFileHandle,
  text: string,
): Promise<SaveTextFileResult> {
  const granted = await ensureFileHandlePermission(handle, "readwrite");
  if (!granted) {
    return { ok: false, permissionDenied: true, error: "没有写入该文件的权限" };
  }
  let writable: FileSystemWritableFileStream | null = null;
  try {
    writable = await handle.createWritable();
    await writable.write(text);
    await writable.close();
    return { ok: true, handle, name: handle.name };
  } catch (error) {
    try {
      await writable?.abort();
    } catch {
      // 写入失败后的清理失败不应覆盖原始错误
    }
    return { ok: false, error: errorMessage(error, "写入文件失败") };
  }
}

/** 打开系统“另存为”对话框，成功后返回新句柄以便后续 Ctrl+S 直接写回 */
export async function saveTextFileAs(
  suggestedName: string,
  text: string,
): Promise<SaveTextFileResult> {
  const picker = pickerWindow();
  if (!picker?.showSaveFilePicker) {
    return { ok: false, error: "当前浏览器不支持系统保存对话框" };
  }

  try {
    const handle = await picker.showSaveFilePicker({
      suggestedName,
      excludeAcceptAllOption: false,
      types: TEXT_PICKER_TYPES,
    });
    return await writeTextToHandle(handle, text);
  } catch (error) {
    if (isAbortError(error)) return { ok: false, cancelled: true };
    return { ok: false, error: errorMessage(error, "无法保存文件") };
  }
}
