<template>
  <div class="shrink-0 overflow-hidden" :class="[sizeClass, roundedClass]">
    <img v-if="src" :src="src" :alt="name" class="w-full h-full object-cover" />
    <div v-else class="w-full h-full flex items-center justify-center bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400" :class="[textSizeClass, roundedClass]">
      {{ initial }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{
  src?: string;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  rounded?: 'full' | 'default';
}>(), {
  size: 'sm',
  rounded: 'full',
});

const sizeMap = {
  xs: 'w-6 h-6',
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-16 h-16',
  xl: 'w-20 h-20',
};

const textSizeMap = {
  xs: 'text-xs',
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-xl',
  xl: 'text-2xl',
};

const sizeClass = computed(() => sizeMap[props.size]);
const textSizeClass = computed(() => textSizeMap[props.size]);
const roundedClass = computed(() => props.rounded === 'full' ? 'rounded-full' : 'rounded-xl');

const initial = computed(() => {
  if (!props.name) return '?';
  return props.name.charAt(0).toUpperCase();
});
</script>
