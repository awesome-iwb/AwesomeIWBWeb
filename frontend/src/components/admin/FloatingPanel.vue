<template>
  <div class="relative w-full">
    <div class="w-full">
      <slot name="content" />
    </div>

    <div v-if="!expanded" class="fixed bottom-0 left-0 right-0 z-40 lg:left-56">
      <div class="mx-4 mb-4 lg:mx-6 lg:mb-6 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl shadow-slate-900/10 dark:shadow-black/30 flex items-center gap-3 px-4 py-3">
        <div class="flex-1 min-w-0">
          <div v-if="selectedLabel" class="font-semibold text-sm text-slate-900 dark:text-white truncate">{{ selectedLabel }}</div>
          <div v-else class="text-sm text-slate-400">{{ placeholder }}</div>
        </div>
        <div class="flex items-center gap-1.5 flex-shrink-0">
          <button v-if="prevEnabled" @click="$emit('prev')" class="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
            <ChevronLeft class="w-4 h-4" />
          </button>
          <button v-if="nextEnabled" @click="$emit('next')" class="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
            <ChevronRight class="w-4 h-4" />
          </button>
          <button @click="expanded = true" class="h-8 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold flex items-center gap-1.5 transition-colors">
            <List class="w-4 h-4" />
            <span class="hidden sm:inline">{{ listLabel }}</span>
            <span class="sm:hidden">{{ count }}</span>
          </button>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="translate-y-full"
        enter-to-class="translate-y-0"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="translate-y-0"
        leave-to-class="translate-y-full"
      >
        <div v-if="expanded" class="fixed inset-0 z-50 flex flex-col justify-end">
          <div class="absolute inset-0 bg-black/30" @click="expanded = false"></div>
          <div class="relative bg-white dark:bg-slate-800 rounded-t-2xl border-t border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col" style="max-height: 60vh;">
            <div class="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-700 flex-shrink-0">
              <h3 class="font-bold text-base text-slate-900 dark:text-white">{{ listLabel }}</h3>
              <button @click="expanded = false" class="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                <X class="w-4 h-4" />
              </button>
            </div>
            <div class="flex-1 overflow-y-auto p-4">
              <slot name="list" />
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { ChevronLeft, ChevronRight, List, X } from 'lucide-vue-next';

defineProps<{
  selectedLabel?: string;
  placeholder?: string;
  listLabel?: string;
  count?: number;
  prevEnabled?: boolean;
  nextEnabled?: boolean;
}>();

defineEmits<{
  prev: [];
  next: [];
}>();

const expanded = ref(false);

const close = () => { expanded.value = false; };

defineExpose({ close });
</script>
