<script setup lang="ts">
import { ref } from "vue";
import favicon from "@/assets/favicon.svg";
import { Bug, DeviceMobile, ExternalLink, History, InfoCircle, Refresh } from "@vicons/tabler";
import Button from "@/components/ui/button.vue";
import SectionCard from "@/components/ui/section-card.vue";
import { canInstall, isInstalled, promptInstall } from "@/lib/pwaInstall";
import { checkPwaUpdateNow } from "@/lib/pwaUpdateService";
import { useToastStore } from "@/stores/toast";

const BUILD_TIME = __BUILD_TIME__;
const APP_VERSION = __APP_VERSION__;
const ACTION_BUTTON_CLASS = "h-7 text-xs";
const toast = useToastStore().push;
const checkingUpdate = ref(false);

async function installApp() {
  const result = await promptInstall();
  if (result === "accepted") toast("已安装应用");
  else if (result === "dismissed") toast("已取消安装");
  else toast("当前浏览器暂不支持应用安装提示");
}

async function checkAppUpdate() {
  if (checkingUpdate.value) return;
  checkingUpdate.value = true;
  try {
    const result = await checkPwaUpdateNow();
    const message = {
      update: "发现新版本，请使用右下角提示更新",
      latest: "当前已是最新版本",
      error: "检查更新失败，请稍后重试",
      busy: "正在检查更新",
      unavailable: "当前环境未启用 PWA 更新检查",
    }[result];
    toast(message);
  } finally {
    checkingUpdate.value = false;
  }
}
</script>

<template>
  <SectionCard title="关于" :icon="InfoCircle">
    <template #actions>
      <Button
        size="sm"
        variant="ghost"
        :class="ACTION_BUTTON_CLASS"
        :disabled="checkingUpdate"
        @click="checkAppUpdate"
      >
        <Refresh class="size-3.5" :class="{ 'animate-spin': checkingUpdate }" />
        检查更新
      </Button>
    </template>
    <div class="flex items-center gap-3">
      <img :src="favicon" alt="一点微小的工作" class="h-12 w-12 rounded-full" />
      <div class="text-xs text-muted-foreground">
        <p class="text-sm font-semibold text-foreground">一点微小的工作</p>
        <p>版本 {{ APP_VERSION }} 🕯️</p>
        <p>
          构建时间
          {{
            new Date(BUILD_TIME).toLocaleString("zh-CN", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            })
          }}
        </p>
      </div>
    </div>
    <div class="mt-3 flex flex-wrap gap-2">
      <Button
        v-if="canInstall"
        size="sm"
        variant="secondary"
        :class="ACTION_BUTTON_CLASS"
        @click="installApp"
      >
        <DeviceMobile class="size-3.5" />
        安装应用
      </Button>
      <span
        v-else-if="isInstalled"
        class="inline-flex h-7 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs text-muted-foreground"
      >
        <DeviceMobile class="size-3.5" />
        已安装
      </span>
      <Button
        tag="a"
        href="https://github.com/Lifeni/with-work"
        target="_blank"
        rel="noreferrer"
        title="在 GitHub 上查看源码"
        size="sm"
        variant="outline"
        :class="ACTION_BUTTON_CLASS"
      >
        <ExternalLink class="size-3.5" />
        GitHub 仓库
      </Button>
      <Button
        tag="a"
        href="https://github.com/Lifeni/with-work/issues"
        target="_blank"
        rel="noreferrer"
        title="反馈问题"
        size="sm"
        variant="outline"
        :class="ACTION_BUTTON_CLASS"
      >
        <Bug class="size-3.5" />
        问题反馈
      </Button>
      <Button
        tag="a"
        href="https://github.com/Lifeni/with-work/releases"
        target="_blank"
        rel="noreferrer"
        title="查看版本历史"
        size="sm"
        variant="outline"
        :class="ACTION_BUTTON_CLASS"
      >
        <History class="size-3.5" />
        版本历史
      </Button>
    </div>
  </SectionCard>
</template>
