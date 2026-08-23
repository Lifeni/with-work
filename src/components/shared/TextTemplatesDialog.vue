<script setup lang="ts">
import { ref, watch } from "vue";
import { FileText, Folder, Pencil, Plus, Trash, Upload } from "@vicons/tabler";
import Badge from "@/components/ui/badge.vue";
import ConfirmDialog from "@/components/shared/ConfirmDialog.vue";
import AppDialog from "@/components/ui/dialog.vue";
import Button from "@/components/ui/button.vue";
import Input from "@/components/ui/input.vue";
import Textarea from "@/components/ui/textarea.vue";
import { uid } from "@/lib/utils";
import { exportTextTemplates, parseTextTemplates } from "@/lib/backup";
import { useTextTemplatesStore } from "@/stores/textTemplates";
import { useToastStore } from "@/stores/toast";
import type { TextTemplate } from "@/types";

interface Props {
  open: boolean;
  /** 打开时若提供，直接进入该模板的编辑状态 */
  editId?: string | null;
}

const props = withDefaults(defineProps<Props>(), { editId: null });
const emit = defineEmits<{ "update:open": [value: boolean] }>();

const templatesStore = useTextTemplatesStore();
const toast = useToastStore().push;

const name = ref("");
const content = ref("");
const group = ref("");
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
        content.value = t.text;
        group.value = t.group ?? "";
      }
    }
  },
  { immediate: true },
);

const resetForm = () => {
  name.value = "";
  content.value = "";
  group.value = "";
  editingId.value = null;
};

const startEdit = (t: TextTemplate) => {
  editingId.value = t.id;
  name.value = t.name;
  content.value = t.text;
  group.value = t.group ?? "";
};

const save = () => {
  if (!content.value.trim()) {
    toast("请输入模板文本");
    return;
  }
  const t: TextTemplate = {
    id: editingId.value ?? uid(),
    name:
      name.value.trim() ||
      (content.value.length > 12 ? `${content.value.slice(0, 12)}…` : content.value),
    text: content.value,
    group: group.value.trim() || undefined,
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
    const res = parseTextTemplates(raw);
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
    title="自定义文本模板"
    description="一段可复用的文本，可拖拽或点击插入到编辑器；模板支持导入 / 导出。"
    content-class="max-w-2xl"
    @update:open="(v: boolean) => emit('update:open', v)"
  >
    <div class="space-y-2 rounded-md border border-border p-2.5">
      <div class="grid grid-cols-[1fr_180px] gap-2">
        <Input v-model="name" placeholder="模板名称（可选）" class="h-8 text-xs" />
        <Input v-model="group" placeholder="分组（可选）" class="h-8 text-xs" />
      </div>
      <Textarea
        v-model="content"
        rows="4"
        placeholder="模板文本内容"
        class="min-h-20 font-mono text-xs"
      />
      <div class="flex items-center gap-2">
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
        <FileText class="size-3.5 shrink-0 text-muted-foreground" />
        <span class="w-32 shrink-0 truncate text-xs font-medium" :title="t.name">{{ t.name }}</span>
        <Badge v-if="t.group" variant="secondary" class="shrink-0 text-[9px]">{{ t.group }}</Badge>
        <span class="min-w-0 flex-1 truncate text-xs text-muted-foreground" :title="t.text">
          {{ t.text.replace(/\n/g, " ↵ ") }}
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
      <Button variant="outline" size="sm" @click="exportTextTemplates">
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
          ? `确定删除文本模板「${templatesStore.templates.find((t) => t.id === pendingDeleteId)?.name ?? ''}」吗？`
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
