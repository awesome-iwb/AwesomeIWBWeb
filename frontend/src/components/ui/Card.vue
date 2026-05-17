<template>
  <div :class="cardClass">
    <div v-if="title || $slots.header" class="px-4 lg:px-6 py-4 border-b border-slate-100 dark:border-slate-700">
      <slot name="header">
        <h3 class="text-lg font-extrabold text-slate-900 dark:text-white">{{ title }}</h3>
      </slot>
    </div>
    <div class="p-4 lg:p-6">
      <slot />
    </div>
    <div v-if="$slots.footer" class="px-4 lg:px-6 py-4 border-t border-slate-100 dark:border-slate-700">
      <slot name="footer" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{
  variant?: 'default' | 'elevated' | 'interactive' | 'panel' | 'glass';
  title?: string;
}>(), {
  variant: 'default',
});

const variantClasses: Record<string, string> = {
  default: 'bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm',
  elevated: 'bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-lg shadow-slate-900/5 dark:shadow-black/20',
  interactive: 'bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md hover:border-[var(--color-brand-200)] dark:hover:border-[var(--color-brand-800)] cursor-pointer transition-all',
  panel: 'bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden',
  glass: 'bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-2xl border border-white/60 dark:border-slate-700/60 shadow-xl',
};

const cardClass = computed(() => variantClasses[props.variant] ?? variantClasses.default);
</script>
