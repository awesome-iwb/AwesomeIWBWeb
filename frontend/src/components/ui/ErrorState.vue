<template>
  <div class="flex flex-col items-center justify-center text-center" :class="containerClass">
    <div class="w-12 h-12 mb-4 text-[var(--color-danger)]">
      <AlertTriangle class="w-12 h-12" />
    </div>
    <div class="text-base font-bold text-foreground">{{ title }}</div>
    <div class="text-sm text-muted-foreground mt-1">{{ description }}</div>
    <button
      class="mt-5 inline-flex items-center justify-center gap-1.5 px-5 py-2.5 text-sm font-bold text-white transition-colors active:scale-95 bg-[var(--color-brand-500)] hover:bg-[var(--color-brand-600)] shadow-lg shadow-[var(--color-brand-shadow)]"
      :style="{ borderRadius: 'var(--radius-md-g2)' }"
      @click="$emit('retry')"
    >
      <RefreshCw class="w-4 h-4" />
      {{ retryLabel }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { AlertTriangle, RefreshCw } from 'lucide-vue-next';

withDefaults(defineProps<{
  title?: string;
  description?: string;
  retryLabel?: string;
  containerClass?: string;
}>(), {
  title: '加载失败',
  description: '请检查网络连接后重试',
  retryLabel: '重试',
  containerClass: 'py-10 px-4',
});

defineEmits<{
  retry: [];
}>();
</script>
