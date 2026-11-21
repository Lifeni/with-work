<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { FileText, Folder, Trash } from "@vicons/tabler";
import DropdownMenu from "@/components/ui/dropdown-menu.vue";
import RecentFilesDialog from "@/components/shared/RecentFilesDialog.vue";
import TooltipIconButton from "@/components/ui/tooltip-icon-button.vue";
import type { DropdownItem } from "@/components/ui/dropdown";
import { openTextFileWithPicker, supportsFileSystemAccess } from "@/lib/fileAccess";
import { readTextFile, TEXT_FILE_ACCEPT } from "@/lib/fileImport";
import { openTextInNewWorkspace, openRecentInNewWorkspace } from "@/lib/fileWorkspace";
import {
  clearRecentFileHistory,
  loadRecentFiles,
  pruneWorkspaceFileBindings,
  recentFiles,
} from "@/lib/recentFiles";
import { useToastStore } from "@/stores/toast";
import { useWorkspaceStore } from "@/stores/workspace";

const toast = useToastStore().push;
const workspaceStore = useWorkspaceStore();
const textFileRef = ref<HTMLInputElement | null>(null);
const manageRecentOpen = ref(false);

async function requestOpenTextFile() {
  if (supportsFileSystemAccess()) {
    const result = await openTextFileWithPicker();
    if (!result.ok) {
      if (!result.cancelled && result.error) toast(result.error);
      return;
    }
    await openTextInNewWorkspace(result.file);
    toast(`已打开「${result.file.name}」`);
    return;
  }
  // 不支持 File System Access 时回退到隐藏 input；必须同步触发以保留用户手势
  textFileRef.value?.click();
}

const handleOpenTextFileRequest = () => void requestOpenTextFile();

async function syncWorkspaceBindings() {
  await loadRecentFiles();
  await pruneWorkspaceFileBindings(workspaceStore.workspaces.map((workspace) => workspace.id));
}

onMounted(() => {
  void syncWorkspaceBindings();
  window.addEventListener("ww-open-text-file", handleOpenTextFileRequest);
});
onUnmounted(() => window.removeEventListener("ww-open-text-file", handleOpenTextFileRequest));

watch(
  () => workspaceStore.workspaces.map((workspace) => workspace.id).join("\u0000"),
  () => void syncWorkspaceBindings(),
);

async function onTextFile(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  const result = await readTextFile(file);
  if (!result.ok) {
    toast(result.error);
    return;
  }
  await openTextInNewWorkspace({ name: file.name, text: result.text });
  toast(`已打开「${file.name}」`);
}

const fileMenuOptions = computed<DropdownItem[]>(() => {
  const options: DropdownItem[] = [{ key: "open-file", label: "打开文本文件…", icon: Folder }];
  if (recentFiles.value.length > 0) {
    options.push({ key: "recent-divider", divider: true });
    for (const file of recentFiles.value) {
      options.push({
        key: `recent-${file.id}`,
        label: file.name,
        icon: FileText,
      });
    }
    options.push(
      { key: "recent-actions-divider", divider: true },
      { key: "manage-recent", label: "管理最近文件…", icon: FileText },
      { key: "clear-recent", label: "清除最近文件", icon: Trash },
    );
  }
  return options;
});

async function onFileMenuSelect(key: string) {
  if (key === "open-file") {
    await requestOpenTextFile();
    return;
  }
  if (key === "clear-recent") {
    await clearRecentFileHistory();
    toast("已清除最近文件");
    return;
  }
  if (key === "manage-recent") {
    manageRecentOpen.value = true;
    return;
  }
  if (!key.startsWith("recent-")) return;
  const record = recentFiles.value.find((file) => file.id === key.slice("recent-".length));
  if (!record) return;
  const result = await openRecentInNewWorkspace(record);
  if (!result.ok) {
    toast(result.error ?? "无法打开最近文件");
    return;
  }
  toast(`已打开「${result.name}」`);
}
</script>

<template>
  <DropdownMenu
    v-slot="{ open }"
    aria-label="打开文件与最近文件"
    :options="fileMenuOptions"
    @select="onFileMenuSelect"
  >
    <TooltipIconButton
      title="打开文件与最近文件"
      aria-label="打开文件与最近文件"
      aria-haspopup="menu"
      :aria-expanded="open"
      class="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
    >
      <Folder class="size-[18px]" />
    </TooltipIconButton>
  </DropdownMenu>

  <input
    ref="textFileRef"
    type="file"
    :accept="TEXT_FILE_ACCEPT"
    class="hidden"
    @change="onTextFile"
  />
  <RecentFilesDialog :open="manageRecentOpen" @update:open="manageRecentOpen = $event" />
</template>
