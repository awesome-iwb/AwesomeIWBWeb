<template>
  <div class="flex items-center justify-center" :class="containerClass">
    <div class="inline-flex items-center justify-center rounded-full border p-2.5" :class="shellClass">
      <img
        src="/images/aiwb-icon.webp"
        alt="loading"
        class="rounded-full object-contain animate-[spin_1.4s_linear_infinite] motion-reduce:animate-none"
        :class="iconClass"
      />
    </div>
    <span v-if="text" class="text-sm text-slate-500 dark:text-slate-400 mt-3">{{ text }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{
  size?: 'sm' | 'md' | 'lg';
  brand?: 'admin' | 'dev' | 'default';
  text?: string;
  containerClass?: string;
}>(), {
  size: 'md',
  brand: 'default',
  containerClass: 'py-20 flex-col',
});

const iconClass = computed(() => {
  switch (props.size) {
    case 'sm': return 'w-5 h-5';
    case 'lg': return 'w-12 h-12';
    default: return 'w-8 h-8';
  }
});

const shellClass = computed(() => {
  if (props.brand === 'dev') return 'bg-blue-50/75 dark:bg-blue-500/10 border-blue-200/80 dark:border-blue-400/20 backdrop-blur-md shadow-sm shadow-blue-500/10';
  if (props.brand === 'admin') return 'bg-emerald-50/75 dark:bg-emerald-500/10 border-emerald-200/80 dark:border-emerald-400/20 backdrop-blur-md shadow-sm shadow-emerald-500/10';
  return 'bg-white/75 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-700/70 backdrop-blur-md shadow-sm';
});
</script>
