import { ref } from "vue";
import { defineStore } from "pinia";
import type { ReplaceRule } from "@/types";

export const useRulesStore = defineStore("rules", () => {
  const rules = ref<ReplaceRule[]>([]);

  function addRule(rule: ReplaceRule) {
    rules.value = [...rules.value, rule];
  }

  function updateRule(rule: ReplaceRule) {
    rules.value = rules.value.map((r) => (r.id === rule.id ? rule : r));
  }

  function removeRule(id: string) {
    rules.value = rules.value.filter((r) => r.id !== id);
  }

  function clearRules() {
    rules.value = [];
  }

  function replaceAll(next: ReplaceRule[]) {
    rules.value = next;
  }

  return { rules, addRule, updateRule, removeRule, clearRules, replaceAll };
});
