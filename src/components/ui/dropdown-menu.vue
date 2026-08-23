<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { Check } from "@vicons/tabler";
import { cn } from "@/lib/utils";
import type { Component } from "vue";

export interface DropdownItem {
  key: string;
  label?: string;
  icon?: Component;
  /** 危险项（红色） */
  danger?: boolean;
  /** 选中态（显示对勾） */
  checked?: boolean;
  /** 分隔线 */
  divider?: boolean;
}

/**
 * DropdownMenu：自绘下拉菜单（仿 Naive popover 样式）。
 * 定位基于触发器实时计算（fixed 定位），避免组件库弹层定位在复杂布局中的偏差；
 * 点击菜单外自动关闭。
 */
const props = withDefaults(
  defineProps<{
    options: DropdownItem[];
    align?: "start" | "end";
  }>(),
  { options: () => [], align: "end" },
);

const emit = defineEmits<{ select: [key: string] }>();

const open = ref(false);
const triggerRef = ref<HTMLElement | null>(null);
const menuRef = ref<HTMLElement | null>(null);
const pos = ref({ top: 0, left: 0 });

function openMenu() {
  open.value = true;
  void nextTick(() => {
    const t = triggerRef.value?.getBoundingClientRect();
    const m = menuRef.value?.getBoundingClientRect();
    if (!t || !m) return;
    // 钳制在视口内（8px 边距），避免菜单出现在窗口外无法点击
    const top = Math.max(8, Math.min(t.bottom + 4, window.innerHeight - m.height - 8));
    const rawLeft =
      props.align === "end" ? t.right - m.width : t.left;
    const left = Math.max(8, Math.min(rawLeft, window.innerWidth - m.width - 8));
    pos.value = { top, left };
  });
}

function close() {
  open.value = false;
}

function onItemClick(key: string) {
  emit("select", key);
  close();
}

// 点击菜单外关闭
function onDocPointer(e: PointerEvent) {
  if (!open.value) return;
  const target = e.target as Node;
  if (triggerRef.value?.contains(target) || menuRef.value?.contains(target)) return;
  close();
}

onMounted(() => document.addEventListener("pointerdown", onDocPointer));
onBeforeUnmount(() => document.removeEventListener("pointerdown", onDocPointer));
</script>

<template>
  <span ref="triggerRef" class="inline-flex" @click="open ? close() : openMenu()">
    <slot />
  </span>
  <!-- 自绘菜单：fixed 定位 + 仿 Naive popover 样式 -->
  <div
    v-if="open"
    ref="menuRef"
    :style="{ top: `${pos.top}px`, left: `${pos.left}px` }"
    class="fixed z-[100] min-w-44 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-lg"
  >
    <template v-for="opt in props.options" :key="opt.key">
      <div v-if="opt.divider" class="-mx-1 my-1 h-px bg-border" />
      <button
        v-else
        type="button"
        data-dropdown-item
        @click="onItemClick(opt.key)"
        :class="
          cn(
            'relative flex w-full cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground',
            opt.danger && 'text-destructive hover:text-destructive',
            $attrs.class as string,
          )
        "
      >
        <component :is="opt.icon" v-if="opt.icon" class="size-3.5 shrink-0" />
        <span class="flex-1">{{ opt.label }}</span>
        <Check v-if="opt.checked" class="size-3.5 shrink-0" />
      </button>
    </template>
  </div>
</template>
