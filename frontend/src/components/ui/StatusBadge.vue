<template>
  <span class="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full font-bold" :class="badgeClass">
    {{ label || statusLabel }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{
  status: string;
  label?: string;
  dark?: boolean;
}>(), {
  dark: false,
});

const statusMap: Record<string, { class: string; label: string }> = {
  pending: { class: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400', label: '待审核' },
  approved: { class: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400', label: '已通过' },
  rejected: { class: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400', label: '已拒绝' },
  active: { class: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400', label: '活跃' },
  inactive: { class: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400', label: '未激活' },
  open: { class: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400', label: '待处理' },
  resolved: { class: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400', label: '已解决' },
  closed: { class: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400', label: '已关闭' },
  draft: { class: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400', label: '草稿' },
  published: { class: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400', label: '已发布' },
};

const badgeClass = computed(() => {
  if (props.dark) return 'bg-white/20 text-white';
  const mapping = statusMap[props.status];
  return mapping?.class ?? 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400';
});

const statusLabel = computed(() => {
  const mapping = statusMap[props.status];
  return mapping?.label ?? props.status;
});
</script>
