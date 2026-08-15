import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ReplaceRule } from "@/types";

interface RulesState {
  rules: ReplaceRule[];
  addRule: (rule: ReplaceRule) => void;
  updateRule: (rule: ReplaceRule) => void;
  removeRule: (id: string) => void;
  clearRules: () => void;
  replaceAll: (rules: ReplaceRule[]) => void;
}

export const useRulesStore = create<RulesState>()(
  persist(
    (set) => ({
      rules: [],

      addRule: (rule) => set((s) => ({ rules: [...s.rules, rule] })),

      updateRule: (rule) =>
        set((s) => ({ rules: s.rules.map((r) => (r.id === rule.id ? rule : r)) })),

      removeRule: (id) => set((s) => ({ rules: s.rules.filter((r) => r.id !== id) })),

      clearRules: () => set({ rules: [] }),

      replaceAll: (rules) => set({ rules }),
    }),
    { name: "ww:rules" },
  ),
);
