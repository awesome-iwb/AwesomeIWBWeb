<template>
  <div class="text-center" :class="containerClass">
    <div class="w-12 h-12 mx-auto mb-3 text-brand dark:text-brand">
      <slot name="icon">
        <component v-if="icon" :is="icon" class="w-12 h-12" />
      </slot>
    </div>
    <div class="text-base font-bold text-foreground">{{ title }}</div>
    <div v-if="description" class="text-sm text-muted-foreground mt-1">{{ description }}</div>
    <div v-if="$slots.action" class="mt-4">
      <slot name="action" />
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  icon?: any;
  title: string;
  description?: string;
  containerClass?: string;
}>(), {
  containerClass: 'py-10 px-4 rounded-[var(--radius-md-g2)]',
});
</script>
