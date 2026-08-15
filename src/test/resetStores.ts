import { useListStore } from "@/stores/list";
import { useRulesStore } from "@/stores/rules";
import { useStagingStore } from "@/stores/staging";
import { useTemplatesStore } from "@/stores/templates";
import { useTextTemplatesStore } from "@/stores/textTemplates";
import { useUiStore } from "@/stores/ui";
import { useWorkspaceStore } from "@/stores/workspace";

/** 组件测试前重置全局状态（localStorage + 各 store），避免用例间串扰 */
export function resetStores() {
  localStorage.clear();
  useWorkspaceStore.getState().replaceAll([]);
  useStagingStore.getState().replaceAll([]);
  useRulesStore.getState().replaceAll([]);
  useTemplatesStore.getState().replaceAll([]);
  useTextTemplatesStore.getState().replaceAll([]);
  useListStore.getState().replaceAll({ source: "", reference: "", compare: "" });
  useUiStore.setState({ stagingOpen: true, settingsOpen: false });
}
