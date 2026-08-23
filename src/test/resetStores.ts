import { createPinia, setActivePinia } from "pinia";

/** 组件测试前重置全局状态（localStorage + 全新 pinia），避免用例间串扰 */
export function resetStores() {
  localStorage.clear();
  // 全新 pinia 实例：所有 store 回到初始状态
  setActivePinia(createPinia());
}
