import { describe, expect, it } from "vitest";
import { createMockEditor } from "./mockEditor";

describe("createMockEditor", () => {
  it("换绑 Model 后读写跟随当前 Model（与真实 Monaco 一致）", () => {
    const first = createMockEditor("A 的内容");
    const second = createMockEditor("B 的内容");
    expect(first.getValue()).toBe("A 的内容");

    first.swapModel(second.model);

    expect(first.currentModel()).toBe(second.model);
    expect(first.getValue()).toBe("B 的内容");

    first.setValue("B 的新内容");
    expect(second.getValue()).toBe("B 的新内容");
  });
});
