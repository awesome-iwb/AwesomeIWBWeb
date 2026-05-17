<template>
  <div :class="containerClass" @click="$emit('click')">
    <div v-if="icon" class="flex-shrink-0" :class="active ? 'text-white' : 'text-slate-400 dark:text-slate-500'">
      <component :is="icon" class="w-5 h-5" />
    </div>
    <div class="flex-1 min-w-0">
      <div class="text-sm font-bold truncate" :class="active ? 'text-white' : 'text-slate-900 dark:text-white'">
        {{ title }}
      </div>
      <div v-if="subtitle" class="text-xs truncate" :class="active ? 'text-white/70' : 'text-slate-500 dark:text-slate-400'">
        {{ subtitle }}
      </div>
    </div>
    <div v-if="badge || badgeStatus" class="flex-shrink-0">
      <StatusBadge v-if="badgeStatus" :status="badgeStatus" :label="badge" :dark="active" />
      <span v-else class="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full font-bold" :class="active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'">
        {{ badge }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { StatusBadge } from './index';

const props = withDefaults(defineProps<{
  title: string;
  subtitle?: string;
  icon?: any;
  active?: boolean;
  badge?: string;
  badgeStatus?: string;
}>(), {
  active: false,
});

defineEmits<{
  click: [];
}>();

const containerClass = computed(() => {
  return props.active
    ? 'bg-[var(--color-brand-500)] text-white shadow-md shadow-[var(--color-brand-shadow)] rounded-2xl p-3 cursor-pointer transition-all flex items-center gap-3'
    : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-all flex items-center gap-3';
});
</script>
