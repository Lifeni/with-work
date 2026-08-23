import { ref } from "vue";
import { defineStore } from "pinia";
import type { StagingItem } from "@/types";
import { uid } from "@/lib/utils";

export const useStagingStore = defineStore("staging", () => {
  const items = ref<StagingItem[]>([]);

  function add(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    items.value = [{ id: uid(), text: trimmed, createdAt: Date.now() }, ...items.value];
  }

  function remove(id: string) {
    items.value = items.value.filter((i) => i.id !== id);
  }

  function updateItem(id: string, text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    items.value = items.value.map((i) => (i.id === id ? { ...i, text: trimmed } : i));
  }

  function clear() {
    items.value = [];
  }

  function replaceAll(next: StagingItem[]) {
    items.value = next;
  }

  return { items, add, remove, updateItem, clear, replaceAll };
});
