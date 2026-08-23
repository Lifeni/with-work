import { ref } from "vue";
import { defineStore } from "pinia";

export const useStatusStore = defineStore("status", () => {
  const line = ref(1);
  const col = ref(1);

  function setCursor(l: number, c: number) {
    line.value = l;
    col.value = c;
  }

  return { line, col, setCursor };
});
