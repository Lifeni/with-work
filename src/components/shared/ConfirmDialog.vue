<script setup lang="ts">
import AppDialog from "@/components/ui/dialog.vue";
import Button from "@/components/ui/button.vue";

const props = withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    description?: string;
    confirmText?: string;
    destructive?: boolean;
  }>(),
  { description: undefined, confirmText: "确定", destructive: false },
);

const emit = defineEmits<{
  confirm: [];
  cancel: [];
  "update:open": [value: boolean];
}>();

function onOpenChange(v: boolean) {
  emit("update:open", v);
  if (!v) emit("cancel");
}
</script>

<template>
  <AppDialog
    :open="props.open"
    :title="props.title"
    :description="props.description"
    content-class="max-w-sm"
    @update:open="onOpenChange"
  >
    <template #footer>
      <Button variant="outline" size="sm" @click="emit('cancel')">取消</Button>
      <Button
        :variant="props.destructive ? 'destructive' : 'default'"
        size="sm"
        @click="emit('confirm')"
      >
        {{ props.confirmText }}
      </Button>
    </template>
  </AppDialog>
</template>
