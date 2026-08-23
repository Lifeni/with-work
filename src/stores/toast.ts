import { ref } from "vue";
import { defineStore } from "pinia";
import { uid } from "@/lib/utils";

export interface ToastItem {
  id: string;
  message: string;
}

export const useToastStore = defineStore("toast", () => {
  const toasts = ref<ToastItem[]>([]);

  function push(message: string) {
    const id = uid();
    toasts.value = [...toasts.value, { id, message }];
    setTimeout(() => {
      toasts.value = toasts.value.filter((t) => t.id !== id);
    }, 2400);
  }

  function remove(id: string) {
    toasts.value = toasts.value.filter((t) => t.id !== id);
  }

  return { toasts, push, remove };
});
