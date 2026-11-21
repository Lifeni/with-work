<script setup lang="ts">
import { ref } from "vue";
import { Folder, Upload } from "@vicons/tabler";
import ConfirmDialog from "@/components/shared/ConfirmDialog.vue";
import AppDialog from "@/components/ui/dialog.vue";
import Button from "@/components/ui/button.vue";

interface Props {
  open: boolean;
  title: string;
  description: string;
  importLabel: string;
  exportLabel: string;
  pendingDeleteName?: string | null;
  deleteTitle?: string;
  deleteDescription?: string;
  contentClass?: string;
  accept?: string;
}

const props = withDefaults(defineProps<Props>(), {
  pendingDeleteName: null,
  deleteTitle: "删除确认",
  deleteDescription: undefined,
  contentClass: "max-w-2xl",
  accept: ".json,application/json",
});
const emit = defineEmits<{
  "update:open": [value: boolean];
  "import-file": [file: File];
  export: [];
  "confirm-delete": [];
  "cancel-delete": [];
}>();

const fileRef = ref<HTMLInputElement | null>(null);

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (file) emit("import-file", file);
}
</script>

<template>
  <AppDialog
    :open="props.open"
    :title="props.title"
    :description="props.description"
    :content-class="props.contentClass"
    @update:open="(value: boolean) => emit('update:open', value)"
  >
    <slot />

    <template #footer>
      <Button variant="outline" size="sm" @click="fileRef?.click()">
        <Upload class="size-3.5" />
        {{ props.importLabel }}
      </Button>
      <Button variant="outline" size="sm" @click="emit('export')">
        <Folder class="size-3.5" />
        {{ props.exportLabel }}
      </Button>
    </template>

    <input ref="fileRef" type="file" :accept="props.accept" class="hidden" @change="onFileChange" />

    <ConfirmDialog
      :open="props.pendingDeleteName !== null"
      :title="props.deleteTitle"
      :description="props.deleteDescription"
      confirm-text="删除"
      destructive
      @confirm="emit('confirm-delete')"
      @cancel="emit('cancel-delete')"
    />
  </AppDialog>
</template>
