import { ref, watch, type Ref } from "vue";

/** 防抖：值变化后延迟 delay 毫秒才更新返回值 */
export function useDebounce<T>(value: Ref<T>, delay = 200): Ref<T> {
  const debounced = ref(value.value) as Ref<T>;
  let timer: ReturnType<typeof setTimeout> | null = null;
  watch(
    value,
    () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        debounced.value = value.value;
      }, delay);
    },
    { immediate: false },
  );
  return debounced;
}
