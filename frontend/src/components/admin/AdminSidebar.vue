<template>
  <aside class="hidden lg:flex flex-col w-56 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 h-screen sticky top-0">
    <div class="p-4 border-b border-slate-100 dark:border-slate-700">
      <h1 class="text-lg font-extrabold">
        <span class="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-500">Awesome</span>
        <span class="text-slate-900 dark:text-white"> 后台</span>
      </h1>
    </div>
    <nav class="flex-1 overflow-y-auto p-3 space-y-1">
      <router-link
        v-for="item in visibleItems"
        :key="item.key"
        :to="item.to"
        class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors"
        :class="isActive(item.key) ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'"
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
  LayoutDashboard, FileText, Package, ClipboardCheck,
  Shield, MessageSquare, Users, Image, ScrollText, LogOut,
} from 'lucide-vue-next';

defineEmits<{ logout: [] }>();

const route = useRoute();
const { hasCapability } = useAuth();

const allItems = [
  { key: 'dashboard', label: '总览', to: '/admin/dashboard', icon: LayoutDashboard, cap: 'admin_panel_access' },
  { key: 'stories', label: '文章管理', to: '/admin/stories', icon: FileText, cap: 'story:manage' },
  { key: 'projects', label: '项目管理', to: '/admin/projects', icon: Package, cap: 'project:read' },
  { key: 'submissions', label: '项目审核', to: '/admin/submissions', icon: ClipboardCheck, cap: 'submission:read' },
  { key: 'moderation', label: '内容审核', to: '/admin/moderation', icon: Shield, cap: 'moderation:read' },
  { key: 'feedback', label: '评论反馈', to: '/admin/feedback', icon: MessageSquare, cap: 'feedback:manage' },
  { key: 'users', label: '用户权限', to: '/admin/users', icon: Users, cap: 'user:read' },
  { key: 'media', label: '图床管理', to: '/admin/media', icon: Image, cap: 'media:read' },
  { key: 'audit', label: '审计日志', to: '/admin/audit', icon: ScrollText, cap: 'audit:read' },
];

const visibleItems = computed(() => allItems.filter(item => hasCapability(item.cap)));

const isActive = (key: string) => {
  const path = route.path;
  if (key === 'dashboard') return path === '/admin' || path === '/admin/dashboard';
  return path.startsWith(`/admin/${key}`);
};
</script>
