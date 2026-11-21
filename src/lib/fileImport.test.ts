import { describe, expect, it } from "vitest";
import { MAX_TEXT_FILE_SIZE, readTextFile, workspaceNameFromFile } from "./fileImport";

describe("文本文件导入", () => {
  it("用文件主名作为工作区名并保留隐藏文件名", () => {
    expect(workspaceNameFromFile("会议记录.md")).toBe("会议记录");
    expect(workspaceNameFromFile("a.b.txt")).toBe("a.b");
    expect(workspaceNameFromFile(".env")).toBe(".env");
  });

  it("读取文本文件内容", async () => {
    const file = {
      name: "笔记.txt",
      size: 5,
      text: async () => "你好",
    } as unknown as File;
    await expect(readTextFile(file)).resolves.toEqual({ ok: true, text: "你好" });
  });

  it("拒绝超过大小上限的文件", async () => {
    const file = {
      name: "large.log",
      size: MAX_TEXT_FILE_SIZE + 1,
      text: async () => "不应被读取",
    } as unknown as File;
    const result = await readTextFile(file);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("文件过大");
  });

  it("读取失败时返回可展示的错误", async () => {
    const file = {
      name: "bad.txt",
      size: 1,
      text: async () => Promise.reject(new Error("read failed")),
    } as unknown as File;
    const result = await readTextFile(file);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("无法读取");
  });
});
