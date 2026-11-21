import { computed, ref } from "vue";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const installEvent = ref<BeforeInstallPromptEvent | null>(null);
const standalone = ref(
  typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(display-mode: standalone)").matches,
);
let initialized = false;

export const canInstall = computed(() => installEvent.value !== null && !standalone.value);
export const isInstalled = computed(() => standalone.value);

export function initPwaInstall() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installEvent.value = event as BeforeInstallPromptEvent;
  });
  window.addEventListener("appinstalled", () => {
    installEvent.value = null;
    standalone.value = true;
  });
}

export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  const event = installEvent.value;
  if (!event) return "unavailable";
  try {
    await event.prompt();
    const choice = await event.userChoice;
    installEvent.value = null;
    if (choice.outcome === "accepted") standalone.value = true;
    return choice.outcome;
  } catch {
    installEvent.value = null;
    return "unavailable";
  }
}
