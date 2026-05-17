<template>
  <div class="border-b border-slate-200 dark:border-slate-800">
    <div class="flex">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        @click="$emit('update:modelValue', tab.key)"
        class="flex-1 px-4 py-4 text-sm font-bold transition-colors relative"
        :class="modelValue === tab.key ? 'text-[var(--color-brand-500)]' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'"
      >
        <span class="inline-flex items-center gap-1.5">
          <component v-if="tab.icon" :is="tab.icon" class="w-4 h-4" />
          {{ tab.label }}
        </span>
        <div v-if="modelValue === tab.key" class="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-0.5 bg-[var(--color-brand-500)] rounded-full"></div>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  tabs: Array<{ key: string; label: string; icon?: any }>;
  modelValue: string;
}>();

defineEmits<{
  'update:modelValue': [key: string];
}>();
</script>
