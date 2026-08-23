<script setup lang="ts">
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        outline: "text-foreground",
        destructive: "border-transparent bg-destructive text-destructive-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

type BadgeVariants = VariantProps<typeof badgeVariants>;

const props = withDefaults(defineProps<{ variant?: BadgeVariants["variant"] }>(), {
  variant: "default",
});
</script>

<template>
  <div
    :class="cn(badgeVariants({ variant: props.variant }), $attrs.class as string)"
    v-bind="{ ...$attrs, class: undefined }"
  >
    <slot />
  </div>
</template>
