import { ref } from "vue";
import { defineStore } from "pinia";

export const useListStore = defineStore("list", () => {
  const source = ref("");
  const reference = ref("");
  const compare = ref("");

  function setSource(v: string) {
    source.value = v;
  }

  function setReference(v: string) {
    reference.value = v;
  }

  function setCompare(v: string) {
    compare.value = v;
  }

  function replaceAll(d: { source: string; reference: string; compare: string }) {
    source.value = d.source;
    reference.value = d.reference;
    compare.value = d.compare;
  }

  return { source, reference, compare, setSource, setReference, setCompare, replaceAll };
});
