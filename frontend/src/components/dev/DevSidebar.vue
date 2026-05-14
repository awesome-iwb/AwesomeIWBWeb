<template>
  <aside class="hidden lg:flex flex-col w-56 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 h-screen sticky top-0">
    <div class="p-4 border-b border-slate-100 dark:border-slate-700">
      <h1 class="text-lg font-extrabold">
        <span class="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-indigo-500">Dev</span>
        <span class="text-slate-900 dark:text-white"> 后台</span>
      </h1>
    </div>
    <nav class="flex-1 overflow-y-auto p-3 space-y-1">
      <router-link
        v-for="item in visibleItems"
        :key="item.key"
        :to="item.to"
        class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors"
        :class="isActive(item.key) ? 'bg-blue-500 text-white shadow-md shadow-blue-500/20' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'"
      >
        <component :is="item.icon" class="w-5 h-5" />
        {{ item.label }}
      </router-link>
    </nav>
    <div class="p-3 border-t border-slate-100 dark:border-slate-700">
      <button @click="$emit('logout')" class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors">
        <LogOut class="w-5 h-5" />
        退出
      </button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useAuth } from '../../composables/useAuth';
import {
  LayoutDashboard, Building2, Package, Bug, MessageSquare, LogOut,
} from 'lucide-vue-next';

defineEmits<{ logout: [] }>();

const route = useRoute();
const { hasCapability } = useAuth();

const allItems = [
  { key: 'dashboard', label: '总览', to: '/dev/dashboard', icon: LayoutDashboard, cap: 'dev_panel_access' },
  { key: 'organizations', label: '组织管理', to: '/dev/organizations', icon: Building2, cap: 'dev_panel_access' },
  { key: 'projects', label: '项目管理', to: '/dev/projects', icon: Package, cap: 'dev_panel_access' },
  { key: 'bugs', label: 'Bug 反馈', to: '/dev/bugs', icon: Bug, cap: 'dev:bug_manage' },
  { key: 'comments', label: '评论管理', to: '/dev/comments', icon: MessageSquare, cap: 'dev:comment_manage' },
];

const visibleItems = computed(() => allItems.filter(item => hasCapability(item.cap)));

const isActive = (key: string) => {
  const path = route.path;
  if (key === 'dashboard') return path === '/dev' || path === '/dev/dashboard';
  return path.startsWith(`/dev/${key}`);
};
</script>
