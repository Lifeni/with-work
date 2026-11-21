<script setup lang="ts">
import { onMounted, ref } from "vue";
import { Refresh, Server, ShieldCheck } from "@vicons/tabler";
import Button from "@/components/ui/button.vue";
import SectionCard from "@/components/ui/section-card.vue";
import {
  formatStorageBytes,
  readStorageInfo,
  requestPersistentStorage,
  type StorageInfo,
} from "@/lib/storageInfo";
import { useToastStore } from "@/stores/toast";

const ACTION_BUTTON_CLASS = "h-7 text-xs";
const toast = useToastStore().push;
const storageInfo = ref<StorageInfo>({ usage: null, quota: null, persisted: null });
const storageLoading = ref(false);
const requestingPersist = ref(false);

async function refreshStorageInfo() {
  if (storageLoading.value) return;
  storageLoading.value = true;
  try {
    storageInfo.value = await readStorageInfo();
  } finally {
    storageLoading.value = false;
  }
}

async function requestStoragePersistence() {
  if (requestingPersist.value) return;
  requestingPersist.value = true;
  try {
    const persisted = await requestPersistentStorage();
    toast(persisted ? "已启用持久化保护" : "浏览器未授予持久化保护");
    await refreshStorageInfo();
  } finally {
    requestingPersist.value = false;
  }
}

onMounted(() => void refreshStorageInfo());
</script>

<template>
  <SectionCard title="本地存储" :icon="Server">
    <template #actions>
      <div class="flex flex-wrap items-center justify-end gap-1">
        <Button
          v-if="storageInfo.persisted === false"
          size="sm"
          variant="ghost"
          :class="ACTION_BUTTON_CLASS"
          :disabled="requestingPersist"
          @click="requestStoragePersistence"
        >
          <ShieldCheck class="size-3.5" />
          {{ requestingPersist ? "申请中" : "申请保护" }}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          :class="ACTION_BUTTON_CLASS"
          :disabled="storageLoading"
          @click="refreshStorageInfo"
        >
          <Refresh class="size-3.5" :class="{ 'animate-spin': storageLoading }" />
          刷新
        </Button>
      </div>
    </template>
    <dl class="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
      <dt class="text-muted-foreground">主存储</dt>
      <dd class="text-right">IndexedDB</dd>
      <dt class="text-muted-foreground">同步镜像</dt>
      <dd class="text-right">localStorage</dd>
      <dt class="text-muted-foreground">已用空间</dt>
      <dd class="text-right font-mono">{{ formatStorageBytes(storageInfo.usage) }}</dd>
      <dt class="text-muted-foreground">浏览器配额</dt>
      <dd class="text-right font-mono">{{ formatStorageBytes(storageInfo.quota) }}</dd>
      <dt class="text-muted-foreground">持久化保护</dt>
      <dd class="text-right" :class="storageInfo.persisted ? 'text-primary' : ''">
        {{ storageInfo.persisted === null ? "未知" : storageInfo.persisted ? "已保护" : "未授予" }}
      </dd>
    </dl>
    <p v-if="storageInfo.persisted === false" class="mt-3 text-[11px] text-muted-foreground">
      浏览器可能在空间不足时清理数据，建议申请持久化保护并定期导出备份。
    </p>
  </SectionCard>
</template>
