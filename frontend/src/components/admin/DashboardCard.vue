<template>
  <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm">
    <div class="flex items-center gap-3 mb-3">
      <div class="w-10 h-10 rounded-xl flex items-center justify-center" :class="iconBgClass">
        <component :is="icon" class="w-5 h-5" :class="iconTextClass" />
      </div>
      <span class="text-sm font-medium text-slate-500 dark:text-slate-400">{{ label }}</span>
    </div>
    <div class="text-2xl font-extrabold text-slate-900 dark:text-white">{{ mainValue }}</div>
    <div v-if="subValue" class="text-xs text-slate-400 mt-1">{{ subValue }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  label: string;
  mainValue: string | number;
  subValue?: string;
  icon: any;
  color?: 'emerald' | 'amber' | 'blue' | 'rose' | 'purple' | 'teal';
}>();

const colorMap: Record<string, { bg: string; text: string }> = {
  emerald: { bg: 'bg-emerald-100 dark:bg-emerald-500/20', text: 'text-emerald-600 dark:text-emerald-400' },
  amber: { bg: 'bg-amber-100 dark:bg-amber-500/20', text: 'text-amber-600 dark:text-amber-400' },
  blue: { bg: 'bg-blue-100 dark:bg-blue-500/20', text: 'text-blue-600 dark:text-blue-400' },
  rose: { bg: 'bg-rose-100 dark:bg-rose-500/20', text: 'text-rose-600 dark:text-rose-400' },
  purple: { bg: 'bg-purple-100 dark:bg-purple-500/20', text: 'text-purple-600 dark:text-purple-400' },
  teal: { bg: 'bg-teal-100 dark:bg-teal-500/20', text: 'text-teal-600 dark:text-teal-400' },
};

const c = colorMap[props.color ?? 'emerald'];
const iconBgClass = computed(() => c.bg);
const iconTextClass = computed(() => c.text);
</script>
