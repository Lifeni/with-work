<script setup lang="ts">
import { useToastStore } from "@/stores/toast";

const toastStore = useToastStore();
</script>

<template>
  <div
    class="pointer-events-none fixed bottom-10 left-1/2 z-[200] flex -translate-x-1/2 flex-col items-center gap-2"
  >
    <div
      v-for="t in toastStore.toasts"
      :key="t.id"
      class="ww-toast pointer-events-auto rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground shadow-lg"
    >
      {{ t.message }}
    </div>
  </div>
</template>
