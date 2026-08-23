<script setup lang="ts">
import AppDialog from "@/components/ui/dialog.vue";
import SettingsView from "@/views/settings/SettingsView.vue";

defineProps<{ open: boolean }>();
const emit = defineEmits<{ "update:open": [value: boolean] }>();
</script>

<template>
  <AppDialog
    :open="open"
    title="设置"
    content-class="max-w-3xl"
    @update:open="(v: boolean) => emit('update:open', v)"
  >
    <SettingsView />
  </AppDialog>
</template>
