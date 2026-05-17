<template>
  <button
    :disabled="disabled"
    class="inline-flex items-center justify-center gap-1.5 font-bold transition-colors active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
    :class="[variantClass, sizeClass]"
    @click="$emit('click', $event)"
  >
    <slot />
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{
  variant?: 'primary' | 'secondary' | 'danger' | 'warning' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
}>(), {
  variant: 'primary',
  size: 'md',
});

defineEmits<{
  click: [event: MouseEvent];
}>();

const variantClass = computed(() => {
  switch (props.variant) {
    case 'primary':
      return 'bg-[var(--color-brand-500)] hover:bg-[var(--color-brand-600)] text-white shadow-lg shadow-[var(--color-brand-shadow)]';
    case 'secondary':
      return 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600';
    case 'danger':
      return 'bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-500/20';
    case 'warning':
      return 'bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/20';
    case 'ghost':
      return 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700';
    case 'outline':
      return 'border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800';
    default:
      return '';
  }
});

const sizeClass = computed(() => {
  switch (props.size) {
    case 'sm':
      return 'px-3 py-1.5 text-xs rounded-xl';
    case 'lg':
      return 'px-6 py-3 text-base rounded-xl';
    default:
      return 'px-4 py-2.5 text-sm rounded-xl';
  }
});
</script>
