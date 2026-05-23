<template>
  <div class="bg-white/72 dark:bg-slate-900/62 backdrop-blur-lg rounded-2xl sm:rounded-3xl border border-white/70 dark:border-slate-700/70 p-3 sm:p-5 shadow-xl shadow-slate-900/8 dark:shadow-black/30" :class="compact ? 'sm:p-3' : ''">
    <div class="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
      <div class="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center" :class="iconBgClass">
        <component :is="icon" class="w-4 h-4 sm:w-5 sm:h-5" :class="iconTextClass" />
      </div>
      <span class="text-xs sm:text-sm font-medium text-muted-foreground">{{ label }}</span>
    </div>
    <div class="text-xl sm:text-2xl font-extrabold text-foreground">{{ mainValue }}</div>
    <div v-if="subValue" class="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">{{ subValue }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  label: string;
  mainValue: string | number;
  subValue?: string;
  icon: any;
  color?: 'emerald' | 'amber' | 'blue' | 'rose' | 'purple' | 'teal' | 'indigo';
  compact?: boolean;
}>();

const colorMap: Record<string, { bg: string; text: string }> = {
  emerald: { bg: 'bg-emerald-100 dark:bg-emerald-500/20', text: 'text-emerald-600 dark:text-emerald-400' },
  amber: { bg: 'bg-amber-100 dark:bg-amber-500/20', text: 'text-amber-600 dark:text-amber-400' },
  blue: { bg: 'bg-blue-100 dark:bg-blue-500/20', text: 'text-blue-600 dark:text-blue-400' },
  rose: { bg: 'bg-rose-100 dark:bg-rose-500/20', text: 'text-rose-600 dark:text-rose-400' },
  purple: { bg: 'bg-purple-100 dark:bg-purple-500/20', text: 'text-purple-600 dark:text-purple-400' },
  teal: { bg: 'bg-teal-100 dark:bg-teal-500/20', text: 'text-teal-600 dark:text-teal-400' },
  indigo: { bg: 'bg-indigo-100 dark:bg-indigo-500/20', text: 'text-indigo-600 dark:text-indigo-400' },
};

const c = colorMap[props.color ?? 'emerald'];
const iconBgClass = computed(() => c.bg);
const iconTextClass = computed(() => c.text);
</script>
