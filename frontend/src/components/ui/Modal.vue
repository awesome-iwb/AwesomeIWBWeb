<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="open" class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" @click.self="closable && $emit('update:open', false)">
        <Transition
          enter-active-class="transition duration-300 ease-out"
          enter-from-class="opacity-0 scale-95"
          enter-to-class="opacity-100 scale-100"
          leave-active-class="transition duration-200 ease-in"
          leave-from-class="opacity-100 scale-100"
          leave-to-class="opacity-0 scale-95"
        >
          <div v-if="open" class="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl shadow-slate-900/10 dark:shadow-black/30 w-full overflow-hidden" :class="sizeClass">
            <div v-if="title" class="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <h3 class="text-lg font-extrabold text-slate-900 dark:text-white">{{ title }}</h3>
              <button v-if="closable" @click="$emit('update:open', false)" class="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div class="px-6 py-4 max-h-[70vh] overflow-y-auto">
              <slot />
            </div>
            <div v-if="$slots.footer" class="px-6 py-4 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-2">
              <slot name="footer" />
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue';

withDefaults(defineProps<{
  open: boolean;
  title?: string;
  closable?: boolean;
  size?: 'sm' | 'md' | 'lg';
}>(), {
  closable: true,
  size: 'md',
});

defineEmits<{
  'update:open': [value: boolean];
}>();

const sizeClass = computed(() => {
  switch (undefined) {
    default: return 'max-w-lg';
  }
});
</script>
