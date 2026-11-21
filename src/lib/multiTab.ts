import { ref } from "vue";
import { uid } from "./utils";

/** 当前检测到的其他活动标签页数量 */
export const otherTabCount = ref(0);

const CHANNEL_NAME = "with-work-tabs";
const HEARTBEAT_MS = 5_000;
const STALE_MS = 15_000;

type TabMessage = {
  type: "hello" | "here" | "heartbeat" | "leave";
  id: string;
  at: number;
};

const peers = new Map<string, number>();
let channel: BroadcastChannel | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let currentId = "";

function refreshCount() {
  const now = Date.now();
  for (const [id, lastSeen] of peers) {
    if (now - lastSeen > STALE_MS) peers.delete(id);
  }
  otherTabCount.value = peers.size;
}

function send(type: TabMessage["type"]) {
  channel?.postMessage({ type, id: currentId, at: Date.now() } satisfies TabMessage);
}

function onMessage(event: MessageEvent<TabMessage>) {
  const message = event.data;
  if (!message || message.id === currentId) return;
  if (message.type === "leave") peers.delete(message.id);
  else peers.set(message.id, message.at);
  refreshCount();
  if (message.type === "hello") send("here");
}

function stop() {
  if (!channel) return;
  send("leave");
  channel.removeEventListener("message", onMessage);
  channel.close();
  channel = null;
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = null;
  peers.clear();
  otherTabCount.value = 0;
  window.removeEventListener("pagehide", sendLeave);
}

function sendLeave() {
  send("leave");
}

/**
 * 通过 BroadcastChannel 检测多个活动标签页。
 * 不做自动状态合并；只提示用户避免多标签页同时编辑造成后写覆盖。
 */
export function startMultiTabGuard(): () => void {
  if (channel || typeof BroadcastChannel === "undefined") return () => {};
  currentId = uid();
  channel = new BroadcastChannel(CHANNEL_NAME);
  channel.addEventListener("message", onMessage);
  send("hello");
  heartbeatTimer = setInterval(() => {
    send("heartbeat");
    refreshCount();
  }, HEARTBEAT_MS);
  window.addEventListener("pagehide", sendLeave);
  return stop;
}
