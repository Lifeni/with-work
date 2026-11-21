import { describe, expect, it } from "vitest";
import { hasDragType } from "@/lib/drag";

describe("拖拽类型判断", () => {
  it("支持数组与 DOMStringList 两类 types", () => {
    expect(hasDragType(["Files", "text/plain"], "Files")).toBe(true);
    const types = {
      contains: (type: string) => type === "text/plain",
    } as unknown as DOMStringList;
    expect(hasDragType(types, "text/plain")).toBe(true);
    expect(hasDragType(undefined, "Files")).toBe(false);
  });
});
