<template>
  <header class="shrink-0 z-40 h-12 lg:h-[52px] px-4 lg:px-6 flex items-center justify-between
    bg-white/72 dark:bg-slate-900/62 backdrop-blur-xl
    border-b border-white/70 dark:border-slate-700/70">
    <div class="flex items-center gap-2 flex-1 lg:flex-none">
      <button
        v-if="showBack"
        class="lg:hidden w-11 h-11 -ml-1.5 rounded-xl flex items-center justify-center hover:bg-accent transition-colors"
        @click="$emit('back')"
      >
        <ChevronLeft class="w-5 h-5 text-muted-foreground" />
      </button>
      <h1 class="text-base lg:text-lg font-bold text-foreground flex-1 text-center lg:text-left">{{ title }}</h1>
    </div>

    <div class="hidden lg:flex items-center gap-3">
      <span v-if="userName" class="text-sm text-muted-foreground">{{ userName }}</span>
      <button
        class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold bg-secondary text-foreground hover:bg-accent transition-colors"
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

    <div class="flex lg:hidden items-center gap-1">
      <button
        class="w-11 h-11 rounded-xl flex items-center justify-center hover:bg-accent transition-colors"
        @click="$emit('goHome')"
      >
        <Home class="w-5 h-5 text-muted-foreground" />
      </button>
      <button
        class="w-11 h-11 rounded-xl flex items-center justify-center hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors"
        @click="$emit('logout')"
      >
        <LogOut class="w-5 h-5 text-rose-600 dark:text-rose-400" />
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
