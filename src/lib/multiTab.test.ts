import { afterEach, describe, expect, it, vi } from "vitest";
import { otherTabCount, startMultiTabGuard } from "./multiTab";

class FakeBroadcastChannel {
  static current: FakeBroadcastChannel | null = null;
  private listeners = new Set<(event: MessageEvent) => void>();
  closed = false;

  constructor(public name: string) {
    FakeBroadcastChannel.current = this;
  }

  addEventListener(type: string, listener: (event: MessageEvent) => void) {
    if (type === "message") this.listeners.add(listener);
  }

  removeEventListener(type: string, listener: (event: MessageEvent) => void) {
    if (type === "message") this.listeners.delete(listener);
  }

  postMessage() {}

  close() {
    this.closed = true;
  }

  emit(data: unknown) {
    const event = { data } as MessageEvent;
    for (const listener of this.listeners) listener(event);
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  otherTabCount.value = 0;
});

describe("多标签页检测", () => {
  it("统计其他活动标签页并在离开时移除", () => {
    vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel);
    const stop = startMultiTabGuard();
    const channel = FakeBroadcastChannel.current!;

    channel.emit({ type: "heartbeat", id: "other", at: Date.now() });
    expect(otherTabCount.value).toBe(1);

    channel.emit({ type: "leave", id: "other", at: Date.now() });
    expect(otherTabCount.value).toBe(0);

    stop();
    expect(channel.closed).toBe(true);
  });

  it("环境不支持 BroadcastChannel 时不报错", () => {
    vi.stubGlobal("BroadcastChannel", undefined);
    expect(() => startMultiTabGuard()()).not.toThrow();
  });
});
