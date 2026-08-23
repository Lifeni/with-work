import { ref } from "vue";
import { defineStore } from "pinia";
import type { SortTemplate } from "@/types";

export const useTemplatesStore = defineStore("templates", () => {
  const templates = ref<SortTemplate[]>([]);

  function addTemplate(t: SortTemplate) {
    templates.value = [...templates.value, t];
  }

  function updateTemplate(t: SortTemplate) {
    templates.value = templates.value.map((x) => (x.id === t.id ? t : x));
  }

  function removeTemplate(id: string) {
    templates.value = templates.value.filter((x) => x.id !== id);
  }

  function replaceAll(next: SortTemplate[]) {
    templates.value = next;
  }

  return { templates, addTemplate, updateTemplate, removeTemplate, replaceAll };
});
