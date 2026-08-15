import { create } from "zustand";
import { uid } from "@/lib/utils";

interface ToastItem {
  id: string;
  message: string;
}

interface ToastState {
  toasts: ToastItem[];
  push: (message: string) => void;
  remove: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  push: (message) => {
    const id = uid();
    set((s) => ({ toasts: [...s.toasts, { id, message }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 2400);
  },

  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
