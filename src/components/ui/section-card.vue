<script setup lang="ts">
import type { Component } from "vue";

defineProps<{
  title: string;
  icon: Component;
}>();
</script>

<template>
  <section class="rounded-lg border border-border bg-card p-4">
    <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h2 class="flex min-w-0 items-center gap-1.5 text-sm font-semibold">
        <component :is="icon" class="size-4 text-muted-foreground" />
        {{ title }}
      </h2>
      <slot name="actions" />
    </div>
    <slot />
  </section>
</template>
