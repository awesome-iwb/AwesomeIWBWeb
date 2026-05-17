<template>
  <header class="shrink-0 z-40 px-4 lg:px-6 py-2.5 lg:py-3 flex items-center justify-between
    bg-white/72 dark:bg-slate-900/62 backdrop-blur-xl
    border-b border-white/70 dark:border-slate-700/70">
    <div class="flex items-center gap-2">
      <button
        v-if="showBack"
        class="lg:hidden w-8 h-8 rounded-xl flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        @click="$emit('back')"
      >
        <ChevronLeft class="w-5 h-5 text-slate-600 dark:text-slate-400" />
      </button>
      <h1 class="text-base lg:text-lg font-bold text-slate-900 dark:text-white">{{ title }}</h1>
    </div>

    <div class="hidden lg:flex items-center gap-3">
      <span v-if="userName" class="text-sm text-slate-500">{{ userName }}</span>
      <button
        class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
        @click="$emit('goHome')"
      >
        <Home class="w-4 h-4" />
        返回首页
      </button>
      <button
        class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors"
        @click="$emit('logout')"
      >
        <LogOut class="w-4 h-4" />
        退出
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ChevronLeft, Home, LogOut } from 'lucide-vue-next';

withDefaults(defineProps<{
  title: string;
  userName?: string;
  showBack?: boolean;
}>(), {
  showBack: true,
});

defineEmits<{
  back: [];
  goHome: [];
  logout: [];
}>();
</script>
