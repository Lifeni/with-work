<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { Refresh } from "@vicons/tabler";
import Button from "@/components/ui/button.vue";
import { flushPersist } from "@/stores/persist";
import { startPwaUpdate, type PwaUpdateController } from "@/lib/pwaUpdate";

const props = defineProps<{
  /** 部署版生产构建默认启用；测试与单文件版可显式关闭 */
  enabled?: boolean;
}>();

const enabled = computed(
  () => props.enabled ?? (__BUILD_MODE__ === "deploy" && import.meta.env.PROD),
);
const visible = ref(false);
const updating = ref(false);
let controller: PwaUpdateController | null = null;

onMounted(() => {
  if (!enabled.value) return;
  controller = startPwaUpdate({
    onNeedRefresh: () => {
      updating.value = false;
      visible.value = true;
    },
    beforeUpdate: flushPersist,
    onRegisterError: (error) => {
      // 更新检查失败不影响离线使用；仅保留诊断信息
      console.warn("[PWA] Service Worker 更新检查失败", error);
    },
  });
  void controller.ready.catch((error) => {
    console.warn("[PWA] Service Worker 初始化失败", error);
  });
});

onBeforeUnmount(() => {
  controller?.dispose();
  controller = null;
});

function dismiss() {
  if (!updating.value) visible.value = false;
}

async function update() {
  if (updating.value || !controller) return;
  updating.value = true;
  try {
    await controller.updateServiceWorker();
    visible.value = false;
  } catch (error) {
    updating.value = false;
    console.warn("[PWA] 激活新版本失败", error);
  }
}
</script>

<template>
  <Transition
    enter-active-class="transition duration-200 ease-out"
    enter-from-class="translate-y-2 opacity-0"
    enter-to-class="translate-y-0 opacity-100"
    leave-active-class="transition duration-150 ease-in"
    leave-from-class="translate-y-0 opacity-100"
    leave-to-class="translate-y-2 opacity-0"
  >
    <aside
      v-if="visible"
      role="status"
      aria-live="polite"
      class="fixed right-3 bottom-10 z-[190] w-[min(360px,calc(100vw-24px))] rounded-lg border border-border bg-card p-3 text-card-foreground shadow-xl"
    >
      <div class="flex gap-2.5">
        <span
          class="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"
        >
          <Refresh class="size-4" />
        </span>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium">发现新版本</p>
          <p class="mt-0.5 text-xs leading-5 text-muted-foreground">
            新版本已准备好，更新后页面会自动刷新。
          </p>
          <div class="mt-2.5 flex justify-end gap-1.5">
            <Button
              size="sm"
              variant="ghost"
              class="h-7 px-2.5 text-[11px]"
              :disabled="updating"
              @click="dismiss"
            >
              稍后
            </Button>
            <Button size="sm" class="h-7 px-2.5 text-[11px]" :disabled="updating" @click="update">
              <Refresh class="size-3" />
              {{ updating ? "正在更新" : "立即更新" }}
            </Button>
          </div>
        </div>
      </div>
    </aside>
  </Transition>
</template>
