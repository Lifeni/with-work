import { afterEach, describe, expect, it, vi } from "vitest";
import {
  openTextFileWithPicker,
  saveTextFileAs,
  supportsFileSystemAccess,
  writeTextToHandle,
} from "./fileAccess";

type PickerWindow = Window & {
  showOpenFilePicker?: (options?: unknown) => Promise<FileSystemFileHandle[]>;
  showSaveFilePicker?: (options?: unknown) => Promise<FileSystemFileHandle>;
};

interface MockHandleOptions {
  name?: string;
  content?: string;
  permission?: PermissionState;
  requestResult?: PermissionState;
  queryThrows?: boolean;
}

function createHandle(options: MockHandleOptions = {}) {
  const name = options.name ?? "notes.txt";
  const state = {
    written: "",
    createWritable: vi.fn(),
  };
  const handle = {
    name,
    kind: "file",
    getFile: async () => new File([options.content ?? "磁盘内容"], name, { type: "text/plain" }),
    createWritable: async () => {
      state.createWritable();
      return {
        write: async (value: string) => {
          state.written = value;
        },
        close: async () => {},
      };
    },
    queryPermission: async () => {
      if (options.queryThrows) throw new Error("query failed");
      return options.permission ?? "granted";
    },
    requestPermission: async () => options.requestResult ?? options.permission ?? "granted",
    isSameEntry: async (other: FileSystemFileHandle) => other.name === name,
  } as unknown as FileSystemFileHandle;
  return { handle, state };
}

afterEach(() => {
  delete (window as PickerWindow).showOpenFilePicker;
  delete (window as PickerWindow).showSaveFilePicker;
  vi.restoreAllMocks();
});

describe("File System Access", () => {
  it("系统文件选择器返回文本与可写回句柄", async () => {
    const { handle } = createHandle({ name: "会议.md", content: "# 会议" });
    const picker = vi.fn(async (options?: unknown) => {
      void options;
      return [handle];
    });
    (window as PickerWindow).showOpenFilePicker = picker;

    expect(supportsFileSystemAccess()).toBe(true);
    const result = await openTextFileWithPicker();

    expect(result).toMatchObject({
      ok: true,
      file: { name: "会议.md", text: "# 会议" },
    });
    if (result.ok) expect(result.file.handle).toBe(handle);

    // 同一扩展名不能同时出现在多个 MIME 类型中，否则 Chromium 会拒绝 picker 配置
    const options = picker.mock.calls[0]?.[0] as {
      types?: Array<{ accept: Record<string, string | string[]> }>;
    };
    const extensions = (options.types ?? []).flatMap((type) =>
      Object.values(type.accept).flatMap((value) => (Array.isArray(value) ? value : [value])),
    );
    expect(new Set(extensions).size).toBe(extensions.length);
  });

  it("取消文件选择时不当作错误提示", async () => {
    (window as PickerWindow).showOpenFilePicker = vi.fn(async () => {
      throw new DOMException("用户取消", "AbortError");
    });

    await expect(openTextFileWithPicker()).resolves.toEqual({ ok: false, cancelled: true });
  });

  it("具有读写权限时写回原文件", async () => {
    const { handle, state } = createHandle();

    const result = await writeTextToHandle(handle, "新的内容");

    expect(result.ok).toBe(true);
    expect(state.written).toBe("新的内容");
  });

  it("权限被拒绝时不尝试创建写入流", async () => {
    const { handle, state } = createHandle({ permission: "denied" });

    const result = await writeTextToHandle(handle, "写不进去");

    expect(result).toMatchObject({ ok: false, permissionDenied: true });
    expect(state.createWritable).not.toHaveBeenCalled();
  });

  it("查询权限失败时仍尝试请求权限", async () => {
    const { handle } = createHandle({
      queryThrows: true,
      requestResult: "granted",
    });

    const result = await writeTextToHandle(handle, "重试成功");

    expect(result.ok).toBe(true);
  });

  it("另存为成功后返回新句柄并写入内容", async () => {
    const { handle, state } = createHandle({ name: "另存.txt" });
    (window as PickerWindow).showSaveFilePicker = vi.fn(async () => handle);

    const result = await saveTextFileAs("另存.txt", "导出内容");

    expect(result).toMatchObject({ ok: true, name: "另存.txt", handle });
    expect(state.written).toBe("导出内容");
  });
});
