<script setup lang="ts">
import { computed, useAttrs } from "vue";
import { NTooltip } from "naive-ui";
import { cn } from "@/lib/utils";

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    title: string;
    type?: "button" | "submit" | "reset";
  }>(),
  { type: "button" },
);

const attrs = useAttrs();
const className = computed(() => attrs.class as string | undefined);
const buttonAttrs = computed(() => {
  const { class: _class, title: _title, ...rest } = attrs as Record<string, unknown>;
  return rest;
});
</script>

<template>
  <NTooltip placement="top" :delay="250">
    <template #trigger>
      <button
        :type="props.type"
        :aria-label="props.title"
        :class="cn('inline-flex min-h-6 min-w-6 shrink-0 items-center justify-center', className)"
        v-bind="buttonAttrs"
      >
        <slot />
      </button>
    </template>
    {{ props.title }}
  </NTooltip>
</template>
