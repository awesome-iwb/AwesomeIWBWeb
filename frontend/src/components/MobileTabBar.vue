<template>
  <nav class="fixed bottom-0 left-0 right-0 z-50 md:hidden safe-area-pb">
    <div class="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-t border-border/50">
      <div class="grid grid-cols-4 h-14">
        <button
          v-for="item in tabs"
          :key="item.key"
          @click="navigate(item.to)"
          class="flex flex-col items-center justify-center gap-0.5 transition-colors active:scale-95"
          :class="isActive(item) ? 'text-emerald-500' : 'text-muted-foreground'"
        >
          <component :is="item.icon" class="w-5 h-5" />
          <span class="text-[10px] font-medium">{{ item.label }}</span>
        </button>
      </div>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router';
import { Sparkles, Store, Grid3X3, Info } from 'lucide-vue-next';

const route = useRoute();
const router = useRouter();

const tabs = [
  { key: 'today', label: 'Today', to: '/today', icon: Sparkles },
  { key: 'store', label: '应用商城', to: '/', icon: Store },
  { key: 'categories', label: '分类', to: '/categories', icon: Grid3X3 },
  { key: 'about', label: '关于', to: '/about', icon: Info },
];

const isActive = (item: { key: string; to: string }) => {
  if (item.key === 'store') return route.path === '/';
  return route.path.startsWith(item.to);
};

const navigate = (to: string) => {
  if (route.path !== to) router.push(to);
};
</script>
