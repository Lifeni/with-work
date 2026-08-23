<script setup lang="ts">
import { computed, ref, watch } from "vue";
import AppDialog from "@/components/ui/dialog.vue";
import Button from "@/components/ui/button.vue";
import Input from "@/components/ui/input.vue";
import Toggle from "@/components/ui/toggle.vue";
import { applyTool, getToolInput } from "@/lib/applyTool";
import { cn } from "@/lib/utils";
import { useRulesStore } from "@/stores/rules";
import { useToastStore } from "@/stores/toast";
import type { SplitDelimiter } from "@/lib/split";
import type { GlobalTool, ToolConfig } from "@/tools/registry";

interface Props {
  tool: GlobalTool | null;
}
const props = defineProps<Props>();
const emit = defineEmits<{ close: [] }>();

const toast = useToastStore().push;
const rulesStore = useRulesStore();

const DEFAULT_CONFIG: ToolConfig = { delimiter: "newline", dedupe: false, ignoreEmpty: true };

const input = ref("");
const config = ref<ToolConfig>({ ...DEFAULT_CONFIG });

// 打开新工具时重新读取输入并重置配置（父组件通常也会用 key 控制重挂载，此处兼容）
watch(
  () => props.tool,
  (tool) => {
    if (tool) {
      input.value = getToolInput();
      config.value = { ...DEFAULT_CONFIG };
    }
  },
  { immediate: true },
);

const output = computed(() => (props.tool ? props.tool.run(input.value, config.value) : ""));

function execute() {
  const tool = props.tool;
  if (!tool) return;
  const res = applyTool(tool, (i) => tool.run(i, config.value));
  if (res) toast(res.message);
  emit("close");
}
</script>

<template>
  <AppDialog
    :open="props.tool !== null"
    :title="props.tool?.name"
    :description="props.tool?.description"
    content-class="max-w-lg"
    @update:open="(v: boolean) => !v && emit('close')"
  >
    <div class="space-y-3">
      <div v-if="props.tool?.id === 'apply-rule'">
        <p class="mb-1.5 text-[10px] text-muted-foreground">选择要应用的替换规则：</p>
        <div class="max-h-44 space-y-1 overflow-y-auto">
          <p
            v-if="rulesStore.rules.length === 0"
            class="rounded-md border border-dashed border-border p-3 text-center text-xs text-muted-foreground"
          >
            暂无规则，请先在查找替换面板中创建规则
          </p>
          <button
            v-for="r in rulesStore.rules"
            :key="r.id"
            type="button"
            @click="config = { ...config, ruleId: r.id }"
            :class="
              cn(
                'flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left text-xs transition-colors',
                config.ruleId === r.id
                  ? 'border-primary bg-accent'
                  : 'border-border hover:bg-accent/60',
              )
            "
          >
            <span class="w-28 shrink-0 truncate font-medium">{{ r.name }}</span>
            <span class="min-w-0 flex-1 truncate font-mono text-muted-foreground">
              {{ r.find }} → {{ r.replace }}
            </span>
            <span v-if="r.isRegex" class="shrink-0 text-[10px] text-muted-foreground">正则</span>
          </button>
        </div>
      </div>
      <template v-else>
        <div class="flex items-center gap-2">
          <span class="shrink-0 text-xs text-muted-foreground">分隔符</span>
          <select
            :value="config.delimiter"
            @change="
              config = {
                ...config,
                delimiter: ($event.target as HTMLSelectElement).value as SplitDelimiter,
              }
            "
            class="h-7 rounded-md border border-border bg-transparent px-2 text-xs outline-none hover:bg-accent"
          >
            <option value="auto">自动检测（出现最多的符号）</option>
            <option value="newline">换行</option>
            <option value="comma">英文逗号</option>
            <option value="cn-comma">中文逗号</option>
            <option value="semicolon">英文分号</option>
            <option value="cn-semicolon">中文分号</option>
            <option value="cn-dunhao">顿号</option>
            <option value="space">空格 / Tab</option>
            <option value="custom">自定义正则</option>
          </select>
          <Input
            v-if="config.delimiter === 'custom'"
            :value="config.customRegex ?? ''"
            @input="config = { ...config, customRegex: ($event.target as HTMLInputElement).value }"
            placeholder="如 [，,、;；]"
            class="h-7 min-w-0 flex-1 font-mono text-xs"
          />
        </div>
        <div class="flex gap-1.5">
          <Toggle
            :active="config.ignoreEmpty ?? true"
            @click="config = { ...config, ignoreEmpty: !(config.ignoreEmpty ?? true) }"
          >
            忽略空项
          </Toggle>
          <Toggle
            :active="config.dedupe ?? false"
            @click="config = { ...config, dedupe: !(config.dedupe ?? false) }"
          >
            去重
          </Toggle>
        </div>
      </template>
      <div>
        <p class="mb-1 text-[10px] text-muted-foreground">预览（仅显示前 300 字符）</p>
        <pre
          class="max-h-40 overflow-y-auto whitespace-pre-wrap break-all rounded-md border border-border bg-muted/40 p-2 text-xs"
          >{{ output.slice(0, 300) || "（无结果）" }}</pre>
      </div>
    </div>

    <template #footer>
      <Button variant="outline" size="sm" @click="emit('close')">取消</Button>
      <Button size="sm" @click="execute">执行并替换</Button>
    </template>
  </AppDialog>
</template>
