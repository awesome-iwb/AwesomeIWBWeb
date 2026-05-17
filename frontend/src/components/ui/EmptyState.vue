<template>
  <div class="text-center" :class="containerClass">
    <div class="w-10 h-10 mx-auto mb-3 text-slate-300 dark:text-slate-600">
      <slot name="icon">
        <component v-if="icon" :is="icon" class="w-10 h-10" />
      </slot>
    </div>
    <div class="text-sm font-bold text-slate-500 dark:text-slate-400">{{ title }}</div>
    <div v-if="description" class="text-xs text-slate-400 dark:text-slate-500 mt-1">{{ description }}</div>
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
  containerClass: 'py-10 px-4',
});
</script>
