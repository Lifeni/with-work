import { ref } from "vue";
import { defineStore } from "pinia";

export const useUiStore = defineStore("ui", () => {
  const stagingOpen = ref(true);
  const settingsOpen = ref(false);

  function toggleStaging() {
    stagingOpen.value = !stagingOpen.value;
  }

  function setStagingOpen(v: boolean) {
    stagingOpen.value = v;
  }

  function setSettingsOpen(v: boolean) {
    settingsOpen.value = v;
  }

  return { stagingOpen, settingsOpen, toggleStaging, setStagingOpen, setSettingsOpen };
});
