<template>
  <div class="flex items-center justify-center" :class="containerClass">
    <div
      class="inline-block rounded-full border-2 border-brand/20 border-t-brand animate-[spin_1s_linear_infinite] motion-reduce:animate-none"
      :class="spinnerClass"
    />
    <span v-if="text" class="text-sm text-muted-foreground mt-3">{{ text }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  containerClass?: string;
}>(), {
  size: 'md',
  containerClass: 'py-20 flex-col',
});

const spinnerClass = computed(() => {
  switch (props.size) {
    case 'sm': return 'w-4 h-4';
    case 'lg': return 'w-8 h-8';
    default: return 'w-6 h-6';
  }
});
</script>
