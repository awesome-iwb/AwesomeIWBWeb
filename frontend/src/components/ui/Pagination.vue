<template>
  <div v-if="totalPages > 1" class="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
    <button
      @click="$emit('update:page', page - 1)"
      :disabled="page <= 1"
      class="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
    >
      <slot name="prev-icon">‹</slot>
      <span class="hidden sm:inline">上一页</span>
    </button>
    <span class="text-sm text-slate-500 dark:text-slate-400">{{ page }} / {{ totalPages }}</span>
    <button
      @click="$emit('update:page', page + 1)"
      :disabled="page >= totalPages"
      class="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
    >
      <span class="hidden sm:inline">下一页</span>
      <slot name="next-icon">›</slot>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{
  page: number;
  total: number;
  pageSize?: number;
}>(), {
  pageSize: 20,
});

defineEmits<{
  'update:page': [page: number];
}>();

const totalPages = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)));
</script>
