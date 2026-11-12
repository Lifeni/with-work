<script setup lang="ts">
import { computed, markRaw, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { NButton, NCheckbox, NCheckboxGroup, NIcon, NPopover } from "naive-ui";
import { AdjustmentsHorizontal } from "@vicons/tabler";
import Button from "@/components/ui/button.vue";
import { toolbarItemIds, type ToolbarVisibilityGroup } from "@/tools/toolbarVisibility";

const MENU_THEME_OVERRIDES = {
  color: "var(--popover)",
  textColor: "var(--popover-foreground)",
  dividerColor: "var(--border)",
  padding: "0",
  fontSize: "12px",
} as const;

const props = withDefaults(
  defineProps<{
    groups: ToolbarVisibilityGroup[];
    hiddenIds: string[];
    defaultHiddenIds?: string[];
    title?: string;
    triggerVariant?: "ghost" | "outline";
  }>(),
  {
    defaultHiddenIds: () => [],
    title: "自定义工具栏",
    triggerVariant: "ghost",
  },
);

const emit = defineEmits<{ "update:hiddenIds": [ids: string[]] }>();

const open = ref(false);
const menuX = ref<number | undefined>();
const menuY = ref<number | undefined>();
const triggerRef = ref<HTMLElement | null>(null);
const menuRef = ref<HTMLElement | null>(null);
const allIds = computed(() => toolbarItemIds(props.groups));
const visibleIds = computed(() => allIds.value.filter((id) => !props.hiddenIds.includes(id)));

function resolveIcon(item: ToolbarVisibilityGroup["items"][number]) {
  return item.icon ? markRaw(item.icon) : undefined;
}

function emitHidden(visible: string | number | Array<string | number> | null) {
  const values = visible == null ? [] : Array.isArray(visible) ? visible : [visible];
  const visibleSet = new Set(values.map(String));
  emit(
    "update:hiddenIds",
    allIds.value.filter((id) => !visibleSet.has(id)),
  );
}

function showAll() {
  emit("update:hiddenIds", []);
}

function restoreDefault() {
  emit("update:hiddenIds", [...props.defaultHiddenIds]);
}

function handleShowChange(show: boolean) {
  open.value = show;
  if (!show) return;
  // NPopover 是非模态浮层；打开后把焦点送入首项，Tab 可在复选框和底部动作间移动。
  void nextTick(() => {
    menuRef.value?.querySelector<HTMLElement>('[role="checkbox"]')?.focus();
  });
}

function handleMenuKeydown(event: KeyboardEvent) {
  if (event.key !== "Escape") return;
  event.preventDefault();
  handleShowChange(false);
  void nextTick(() => triggerRef.value?.querySelector<HTMLButtonElement>("button")?.focus());
}

function toggleMenu() {
  if (open.value) {
    handleShowChange(false);
    return;
  }
  const rect = triggerRef.value?.getBoundingClientRect();
  if (rect) {
    menuX.value = rect.right;
    menuY.value = rect.bottom + 6;
  }
  handleShowChange(true);
}

function handleDocumentPointerDown(event: PointerEvent) {
  if (!open.value) return;
  const target = event.target as Node | null;
  if (!target || triggerRef.value?.contains(target) || menuRef.value?.contains(target)) return;
  handleShowChange(false);
}

onMounted(() => document.addEventListener("pointerdown", handleDocumentPointerDown, true));
onBeforeUnmount(() => document.removeEventListener("pointerdown", handleDocumentPointerDown, true));
</script>

<template>
  <span ref="triggerRef" class="inline-flex">
    <Button
      :variant="props.triggerVariant"
      size="icon-sm"
      :title="props.title"
      aria-haspopup="dialog"
      :aria-expanded="open"
      class="shrink-0"
      @click="toggleMenu"
    >
      <AdjustmentsHorizontal class="size-4" />
    </Button>
  </span>

  <NPopover
    trigger="manual"
    placement="bottom-end"
    :show="open"
    :x="menuX"
    :y="menuY"
    :show-arrow="false"
    :width="260"
    content-class="ww-toolbar-visibility-menu ww-menu-text"
    :theme-overrides="MENU_THEME_OVERRIDES"
    @update:show="handleShowChange"
  >
    <template #trigger>
      <span aria-hidden="true" class="hidden" />
    </template>

    <div
      ref="menuRef"
      role="dialog"
      aria-label="工具栏显示项"
      class="min-w-0 text-xs"
      @keydown="handleMenuKeydown"
    >
      <NCheckboxGroup :value="visibleIds" @update:value="emitHidden">
        <div
          v-for="group in props.groups"
          :key="group.key"
          role="group"
          :aria-labelledby="`ww-toolbar-group-${group.key}`"
          class="py-1"
        >
          <p
            :id="`ww-toolbar-group-${group.key}`"
            class="m-0 px-3 py-1 text-xs font-medium leading-4 text-muted-foreground"
          >
            {{ group.label }}
          </p>
          <NCheckbox
            v-for="item in group.items"
            :key="item.id"
            :value="item.id"
            :data-ww-menu-option="item.id"
            size="small"
            class="ww-toolbar-visibility-checkbox"
          >
            <span class="flex min-w-0 items-center gap-2">
              <NIcon
                v-if="resolveIcon(item)"
                :component="resolveIcon(item)"
                :size="14"
                class="shrink-0 text-muted-foreground"
              />
              <span class="truncate">{{ item.label }}</span>
            </span>
          </NCheckbox>
        </div>
      </NCheckboxGroup>

      <div
        data-ww-menu-actions
        class="mt-1 flex w-full items-center justify-between gap-2 border-t border-border p-2"
      >
        <NButton text size="tiny" class="ww-menu-neutral-action" @click="showAll">全部显示</NButton>
        <NButton text size="tiny" class="ww-menu-neutral-action" @click="restoreDefault">
          恢复默认
        </NButton>
      </div>
    </div>
  </NPopover>
</template>
