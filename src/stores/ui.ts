import { ref } from "vue";
import { defineStore } from "pinia";

export const useUiStore = defineStore("ui", () => {
  const stagingOpen = ref(true);
  const settingsOpen = ref(false);
  const commandPaletteOpen = ref(false);

  function toggleStaging() {
    stagingOpen.value = !stagingOpen.value;
  }

  function setStagingOpen(v: boolean) {
    stagingOpen.value = v;
  }

  function setSettingsOpen(v: boolean) {
    settingsOpen.value = v;
  }

  function setCommandPaletteOpen(v: boolean) {
    commandPaletteOpen.value = v;
  }

  return {
    stagingOpen,
    settingsOpen,
    commandPaletteOpen,
    toggleStaging,
    setStagingOpen,
    setSettingsOpen,
    setCommandPaletteOpen,
  };
});
