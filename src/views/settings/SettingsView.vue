<script setup lang="ts">
import AppearanceSettings from "@/views/settings/AppearanceSettings.vue";
import AboutSettings from "@/views/settings/AboutSettings.vue";
import DataManagementSettings from "@/views/settings/DataManagementSettings.vue";
import StorageInfoSettings from "@/views/settings/StorageInfoSettings.vue";
</script>

<template>
  <div class="ww-settings-actions p-3 sm:p-4">
    <div class="mx-auto grid max-w-3xl gap-4 md:grid-cols-2">
      <div class="space-y-4">
        <AppearanceSettings />
        <AboutSettings />
      </div>
      <div class="space-y-4">
        <DataManagementSettings />
        <StorageInfoSettings />
      </div>
    </div>
  </div>
</template>
