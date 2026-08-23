<script setup lang="ts">
import { ref, watch } from "vue";
import { FolderOpen, Pencil, Plus, Trash2, Upload } from "@lucide/vue";
import Badge from "@/components/ui/badge.vue";
import ConfirmDialog from "@/components/shared/ConfirmDialog.vue";
import AppDialog from "@/components/ui/dialog.vue";
import Button from "@/components/ui/button.vue";
import Input from "@/components/ui/input.vue";
import Toggle from "@/components/ui/toggle.vue";
import { uid } from "@/lib/utils";
import { exportRules, parseRules } from "@/lib/backup";
import { useRulesStore } from "@/stores/rules";
import { useToastStore } from "@/stores/toast";
import type { ReplaceRule } from "@/types";

interface Props {
  open: boolean;
  /** 打开时若提供，将当前查找/替换内容带入表单，便于保存为新规则 */
  initialDraft?: { find: string; replace: string; isRegex: boolean; matchCase: boolean } | null;
  /** 打开时若提供，直接进入该规则的编辑状态 */
  editId?: string | null;
}

const props = withDefaults(defineProps<Props>(), {
  initialDraft: null,
  editId: null,
});
const emit = defineEmits<{ "update:open": [value: boolean] }>();

const rulesStore = useRulesStore();
const toast = useToastStore().push;

const name = ref("");
const find = ref("");
const replace = ref("");
const isRegex = ref(false);
const matchCase = ref(false);
const editingId = ref<string | null>(null);
const pendingDeleteId = ref<string | null>(null);
const fileRef = ref<HTMLInputElement | null>(null);
// 已应用的 editId（避免重复应用）
const appliedEditId = ref<string | null>(null);

// 打开时带入 initialDraft / editId（父组件也可用 key 控制重挂载，此处兼容两者）
watch(
  () => props.open,
  (open) => {
    if (!open) return;
    if (props.editId && props.editId !== appliedEditId.value) {
      appliedEditId.value = props.editId;
      const rule = rulesStore.rules.find((r) => r.id === props.editId);
      if (rule) {
        editingId.value = rule.id;
        name.value = rule.name;
        find.value = rule.find;
        replace.value = rule.replace;
        isRegex.value = rule.isRegex;
        matchCase.value = rule.matchCase;
      }
    } else if (props.initialDraft) {
      find.value = props.initialDraft.find;
      replace.value = props.initialDraft.replace;
      isRegex.value = props.initialDraft.isRegex;
      matchCase.value = props.initialDraft.matchCase;
    }
  },
  { immediate: true },
);

const resetForm = () => {
  name.value = "";
  find.value = "";
  replace.value = "";
  isRegex.value = false;
  matchCase.value = false;
  editingId.value = null;
};

const startEdit = (r: ReplaceRule) => {
  editingId.value = r.id;
  name.value = r.name;
  find.value = r.find;
  replace.value = r.replace;
  isRegex.value = r.isRegex;
  matchCase.value = r.matchCase;
};

const save = () => {
  if (!find.value) {
    toast("请输入查找内容");
    return;
  }
  const rule: ReplaceRule = {
    id: editingId.value ?? uid(),
    name:
      name.value.trim() || (find.value.length > 12 ? `${find.value.slice(0, 12)}…` : find.value),
    find: find.value,
    replace: replace.value,
    isRegex: isRegex.value,
    matchCase: matchCase.value,
  };
  if (editingId.value) rulesStore.updateRule(rule);
  else rulesStore.addRule(rule);
  resetForm();
  toast("规则已保存");
};

const onImportFile = (e: Event) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  void file.text().then((raw) => {
    const res = parseRules(raw);
    if (!res.ok) {
      toast(res.error);
      return;
    }
    rulesStore.replaceAll(res.rules);
    toast(`已导入 ${res.rules.length} 条替换规则`);
  });
};
</script>

<template>
  <AppDialog
    :open="props.open"
    title="替换规则"
    description="保存常用替换规则，在替换面板中一键调用；规则支持导入 / 导出。"
    content-class="max-w-2xl"
    @update:open="(v: boolean) => emit('update:open', v)"
  >
    <div class="space-y-2 rounded-md border border-border p-2.5">
      <div class="grid grid-cols-3 gap-2">
        <Input v-model="name" placeholder="规则名称（可选）" class="h-8 text-xs" />
        <Input v-model="find" placeholder="查找内容" class="h-8 font-mono text-xs" />
        <Input v-model="replace" placeholder="替换为" class="h-8 font-mono text-xs" />
      </div>
      <div class="flex items-center gap-2">
        <Toggle :active="isRegex" @click="isRegex = !isRegex">正则</Toggle>
        <Toggle :active="matchCase" @click="matchCase = !matchCase">区分大小写</Toggle>
        <div class="flex-1" />
        <Button size="sm" class="h-7 text-xs" @click="save">
          <Plus class="size-3.5" />
          {{ editingId ? "更新规则" : "保存规则" }}
        </Button>
        <Button v-if="editingId" size="sm" variant="ghost" class="h-7 text-xs" @click="resetForm">
          取消编辑
        </Button>
      </div>
    </div>

    <div class="max-h-56 min-h-24 space-y-1.5 overflow-y-auto">
      <p
        v-if="rulesStore.rules.length === 0"
        class="py-4 text-center text-xs text-muted-foreground"
      >
        还没有规则，在上方添加第一条吧
      </p>
      <div
        v-for="r in rulesStore.rules"
        :key="r.id"
        class="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5"
      >
        <span class="w-32 shrink-0 truncate text-xs font-medium" :title="r.name">{{ r.name }}</span>
        <span
          class="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground"
          :title="r.find"
        >
          {{ r.find }}
        </span>
        <span class="text-muted-foreground">→</span>
        <span
          class="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground"
          :title="r.replace"
        >
          {{ r.replace }}
        </span>
        <Badge v-if="r.isRegex" variant="secondary">正则</Badge>
        <Badge v-if="r.matchCase" variant="outline">Aa</Badge>
        <Button variant="ghost" size="icon-sm" title="编辑" @click="startEdit(r)">
          <Pencil class="size-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          title="删除"
          class="text-destructive hover:text-destructive"
          @click="pendingDeleteId = r.id"
        >
          <Trash2 class="size-3" />
        </Button>
      </div>
    </div>

    <template #footer>
      <Button variant="outline" size="sm" @click="fileRef?.click()">
        <Upload class="size-3.5" />
        导入规则
      </Button>
      <Button variant="outline" size="sm" @click="exportRules">
        <FolderOpen class="size-3.5" />
        导出规则
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
      title="删除规则"
      :description="
        pendingDeleteId
          ? `确定删除替换规则「${rulesStore.rules.find((r) => r.id === pendingDeleteId)?.name ?? ''}」吗？`
          : undefined
      "
      confirm-text="删除"
      destructive
      @confirm="
        () => {
          if (pendingDeleteId) rulesStore.removeRule(pendingDeleteId);
          pendingDeleteId = null;
        }
      "
      @cancel="pendingDeleteId = null"
    />
  </AppDialog>
</template>
