<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { AlertTriangle, Check, FileText, Refresh, WifiOff } from "@vicons/tabler";
import { formatTime } from "@/lib/utils";
import { otherTabCount } from "@/lib/multiTab";
import { workspaceFileBindings } from "@/lib/recentFiles";
import { persistenceState } from "@/stores/persist";
import { useWorkspaceStore } from "@/stores/workspace";
import { useStatusStore } from "@/stores/status";
import { useUiStore } from "@/stores/ui";

const wsStore = useWorkspaceStore();
const statusStore = useStatusStore();
const uiStore = useUiStore();

const ws = computed(() => wsStore.workspaces.find((w) => w.id === wsStore.activeId));
const left = computed(() => ws.value?.left ?? "");
const right = computed(() => ws.value?.right ?? "");
const boundFile = computed(() =>
  ws.value
    ? workspaceFileBindings.value.find((record) => record.workspaceId === ws.value!.id)
    : undefined,
);
const online = ref(navigator.onLine);
const syncOnline = () => {
  online.value = navigator.onLine;
};

onMounted(() => {
  window.addEventListener("online", syncOnline);
  window.addEventListener("offline", syncOnline);
});
onUnmounted(() => {
  window.removeEventListener("online", syncOnline);
  window.removeEventListener("offline", syncOnline);
});

const saveStatus = computed(() => {
  if (persistenceState.status === "error") {
    return {
      icon: AlertTriangle,
      text: "保存失败",
      className: "text-destructive",
      spin: false,
    };
  }
  if (persistenceState.status === "saving") {
    return {
      icon: Refresh,
      text: "保存中…",
      className: "",
      spin: true,
    };
  }
  return {
    icon: Check,
    text: persistenceState.savedAt
      ? `已自动保存 ${formatTime(persistenceState.savedAt)}`
      : "已自动保存",
    className: "",
    spin: false,
  };
});
</script>

<template>
  <footer
    class="flex h-6 shrink-0 items-center gap-3 border-t border-border bg-muted px-3 text-[11px] text-muted-foreground"
  >
    <template v-if="uiStore.settingsOpen">
      <span class="flex items-center gap-1.5">
        <span class="font-medium text-foreground/80">设置</span>
        <span>·</span>
        <span>弹窗</span>
      </span>
    </template>
    <template v-else>
      <span class="font-medium text-foreground/80">{{ ws?.name ?? "—" }}</span>
    </template>
    <span
      v-if="boundFile"
      class="hidden min-w-0 max-w-60 items-center gap-1 lg:flex"
      :title="`Ctrl/Cmd+S 将写回${boundFile.side === 'right' ? '右栏' : '左栏'}文件「${boundFile.name}」`"
    >
      <FileText class="size-3 shrink-0" aria-hidden="true" />
      <span class="truncate">{{ boundFile.name }}</span>
    </span>
    <span class="hidden md:inline">行 {{ statusStore.line }} · 列 {{ statusStore.col }}</span>
    <span class="hidden sm:inline">左 {{ left.length }} 字符 · 右 {{ right.length }} 字符</span>

    <div class="flex-1" />
    <span
      v-if="otherTabCount > 0"
      class="hidden items-center gap-1 sm:flex"
      :title="`检测到 ${otherTabCount} 个其他标签页；同时编辑时可能发生后写覆盖`"
      role="status"
      aria-live="polite"
    >
      <AlertTriangle class="size-3" aria-hidden="true" />
      {{ otherTabCount }} 个其他标签页
    </span>
    <span
      v-if="!online"
      class="flex items-center gap-1 text-destructive"
      role="status"
      aria-live="polite"
    >
      <WifiOff class="size-3" aria-hidden="true" />
      离线
    </span>
    <span
      class="flex items-center gap-1"
      :class="saveStatus.className"
      :title="persistenceState.error ?? undefined"
      role="status"
      aria-live="polite"
    >
      <component
        :is="saveStatus.icon"
        class="size-3"
        :class="{ 'animate-spin': saveStatus.spin }"
        aria-hidden="true"
      />
      {{ saveStatus.text }}
    </span>
  </footer>
</template>
