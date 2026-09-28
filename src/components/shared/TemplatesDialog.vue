<script setup lang="ts">
import { ref, watch } from "vue";
import { ArrowBigUpLine, Folder, ListNumbers, Pencil, Plus, Trash, Upload } from "@vicons/tabler";
import ConfirmDialog from "@/components/shared/ConfirmDialog.vue";
import AppDialog from "@/components/ui/dialog.vue";
import Button from "@/components/ui/button.vue";
import Input from "@/components/ui/input.vue";
import Textarea from "@/components/ui/textarea.vue";
import Toggle from "@/components/ui/toggle.vue";
import { uid } from "@/lib/utils";
import { exportTemplates, parseTemplates } from "@/lib/backup";
import { useTemplatesStore } from "@/stores/templates";
import { useToastStore } from "@/stores/toast";
import type { SortTemplate } from "@/types";

interface Props {
  open: boolean;
  /** 打开时若提供，直接进入该模板的编辑状态 */
  editId?: string | null;
}

const props = withDefaults(defineProps<Props>(), { editId: null });
const emit = defineEmits<{ "update:open": [value: boolean] }>();

const templatesStore = useTemplatesStore();
const toast = useToastStore().push;

const name = ref("");
const content = ref("");
const group = ref("");
const prefixMatch = ref(false);
const editingId = ref<string | null>(null);
const pendingDeleteId = ref<string | null>(null);
const fileRef = ref<HTMLInputElement | null>(null);
const appliedEditId = ref<string | null>(null);

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    if (props.editId && props.editId !== appliedEditId.value) {
      appliedEditId.value = props.editId;
      const t = templatesStore.templates.find((x) => x.id === props.editId);
      if (t) {
        editingId.value = t.id;
        name.value = t.name;
        content.value = t.items.join("\n");
        group.value = t.group ?? "";
        prefixMatch.value = t.prefixMatch ?? false;
      }
    }
  },
  { immediate: true },
);

const resetForm = () => {
  name.value = "";
  content.value = "";
  group.value = "";
  prefixMatch.value = false;
  editingId.value = null;
};

const startEdit = (t: SortTemplate) => {
  editingId.value = t.id;
  name.value = t.name;
  content.value = t.items.join("\n");
  group.value = t.group ?? "";
  prefixMatch.value = t.prefixMatch ?? false;
};

const save = () => {
  const items = content.value
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (items.length === 0) {
    toast("请输入模板内容（每行一条）");
    return;
  }
  const t: SortTemplate = {
    id: editingId.value ?? uid(),
    name: name.value.trim() || (items[0].length > 12 ? `${items[0].slice(0, 12)}…` : items[0]),
    items,
    group: group.value.trim() || undefined,
    prefixMatch: prefixMatch.value,
  };
  if (editingId.value) templatesStore.updateTemplate(t);
  else templatesStore.addTemplate(t);
  resetForm();
  toast("模板已保存");
};

const onImportFile = (e: Event) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  void file.text().then((raw) => {
    const res = parseTemplates(raw);
    if (!res.ok) {
      toast(res.error);
      return;
    }
    templatesStore.replaceAll(res.templates);
    toast(`已导入 ${res.templates.length} 个模板`);
  });
};
</script>

<template>
  <AppDialog
    :open="props.open"
    title="自定义排序模板"
    description="提供一个顺序列表（每行一条），用于把文本按模板顺序排列；模板支持导入 / 导出。"
    content-class="max-w-2xl"
    @update:open="(v: boolean) => emit('update:open', v)"
  >
    <div class="space-y-2 rounded-md border border-border p-2.5">
      <div class="grid grid-cols-[1fr_180px] gap-2">
        <Input v-model="name" placeholder="模板名称（可选）" class="" />
        <Input v-model="group" placeholder="分组（可选）" class="" />
      </div>
      <Textarea
        v-model="content"
        :rows="4"
        placeholder="模板条目，每行一条（按从上到下顺序排列）"
        class="font-mono"
      />
      <div class="flex items-center gap-2">
        <Toggle
          :active="prefixMatch"
          @click="prefixMatch = !prefixMatch"
          title="开头匹配：文本以列表项开头即算匹配"
          class="h-7 text-xs"
        >
          <ArrowBigUpLine class="size-3.5" />
          开头匹配
        </Toggle>
        <div class="flex-1" />
        <Button size="sm" class="h-7 text-xs" @click="save">
          <Plus class="size-3.5" />
          {{ editingId ? "更新模板" : "保存模板" }}
        </Button>
        <Button v-if="editingId" size="sm" variant="ghost" class="h-7 text-xs" @click="resetForm">
          取消编辑
        </Button>
      </div>
    </div>

    <div class="max-h-56 min-h-20 space-y-1.5 overflow-y-auto">
      <p
        v-if="templatesStore.templates.length === 0"
        class="py-4 text-center text-xs text-muted-foreground"
      >
        还没有模板，在上方添加第一个吧
      </p>
      <div
        v-for="t in templatesStore.templates"
        :key="t.id"
        class="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5"
      >
        <ListNumbers class="size-3.5 shrink-0 text-muted-foreground" />
        <span class="w-32 shrink-0 truncate text-xs font-medium" :title="t.name">{{ t.name }}</span>
        <span v-if="t.group" class="shrink-0 text-xs font-medium text-muted-foreground">
          {{ t.group }}
        </span>
        <span class="shrink-0 text-xs font-medium text-muted-foreground">
          {{ t.items.length }} 条
        </span>
        <span
          v-if="t.prefixMatch"
          class="flex shrink-0 items-center gap-0.5 text-xs font-medium text-muted-foreground"
        >
          <ArrowBigUpLine class="size-3" />
          开头匹配
        </span>
        <span
          class="min-w-0 flex-1 truncate text-xs text-muted-foreground"
          :title="t.items.join('、')"
        >
          {{ t.items.slice(0, 4).join("、") }}{{ t.items.length > 4 ? "…" : "" }}
        </span>
        <Button variant="ghost" size="icon-sm" title="编辑" @click="startEdit(t)">
          <Pencil class="size-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          title="删除"
          class="text-destructive hover:text-destructive"
          @click="pendingDeleteId = t.id"
        >
          <Trash class="size-3" />
        </Button>
      </div>
    </div>

    <template #footer>
      <Button variant="outline" size="sm" @click="fileRef?.click()">
        <Upload class="size-3.5" />
        导入模板
      </Button>
      <Button variant="outline" size="sm" @click="exportTemplates">
        <Folder class="size-3.5" />
        导出模板
      </Button>
    </template>

    <input
      ref="fileRef"
      type="file"
      accept=".json,application/json"
      class="hidden"
      @change="onImportFile"
    />

    <ConfirmDialog
      :open="pendingDeleteId !== null"
      title="删除模板"
      :description="
        pendingDeleteId
          ? `确定删除排序模板「${templatesStore.templates.find((t) => t.id === pendingDeleteId)?.name ?? ''}」吗？`
          : undefined
      "
      confirm-text="删除"
      destructive
      @confirm="
        () => {
          if (pendingDeleteId) templatesStore.removeTemplate(pendingDeleteId);
          pendingDeleteId = null;
        }
      "
      @cancel="pendingDeleteId = null"
    />
  </AppDialog>
</template>
