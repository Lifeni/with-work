import { ref } from "vue";
import { defineStore } from "pinia";
import type { TextTemplate } from "@/types";

/** 文本模板（自定义模板）：一段可复用文本，可拖拽/插入到编辑器 */
export const useTextTemplatesStore = defineStore("textTemplates", () => {
  const templates = ref<TextTemplate[]>([]);

  function addTemplate(t: TextTemplate) {
    templates.value = [...templates.value, t];
  }

  function updateTemplate(t: TextTemplate) {
    templates.value = templates.value.map((x) => (x.id === t.id ? t : x));
  }

  function removeTemplate(id: string) {
    templates.value = templates.value.filter((x) => x.id !== id);
  }

  function replaceAll(next: TextTemplate[]) {
    templates.value = next;
  }

  return { templates, addTemplate, updateTemplate, removeTemplate, replaceAll };
});
