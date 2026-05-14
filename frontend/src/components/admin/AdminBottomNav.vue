<template>
  <div class="fixed bottom-0 left-0 right-0 z-50 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-t border-slate-200 dark:border-slate-700 safe-area-pb lg:hidden">
    <div class="flex overflow-x-auto px-2 py-1 gap-1 scrollbar-hide">
      <button
        v-for="item in visibleItems"
        :key="item.key"
        @click="$router.push(item.to)"
        class="flex flex-col items-center justify-center min-w-[3.5rem] px-2 py-1.5 rounded-lg transition-colors flex-shrink-0"
        :class="isActive(item.key) ? 'text-emerald-500' : 'text-slate-400'"
      >
        <component :is="item.icon" class="w-5 h-5" />
        <span class="text-[10px] mt-0.5 whitespace-nowrap">{{ item.label }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useAuth } from '../../composables/useAuth';
import {
  LayoutDashboard, FileText, Package, ClipboardCheck,
  Shield, MessageSquare, Users, Image, ScrollText,
} from 'lucide-vue-next';

const route = useRoute();
const { hasCapability } = useAuth();

const allItems = [
  { key: 'dashboard', label: '总览', to: '/admin/dashboard', icon: LayoutDashboard, cap: 'admin_panel_access' },
  { key: 'stories', label: '文章', to: '/admin/stories', icon: FileText, cap: 'story:manage' },
  { key: 'projects', label: '项目', to: '/admin/projects', icon: Package, cap: 'project:read' },
  { key: 'submissions', label: '审核', to: '/admin/submissions', icon: ClipboardCheck, cap: 'submission:read' },
  { key: 'moderation', label: '内容', to: '/admin/moderation', icon: Shield, cap: 'moderation:read' },
  { key: 'feedback', label: '反馈', to: '/admin/feedback', icon: MessageSquare, cap: 'feedback:manage' },
  { key: 'users', label: '用户', to: '/admin/users', icon: Users, cap: 'user:read' },
  { key: 'media', label: '图床', to: '/admin/media', icon: Image, cap: 'media:read' },
  { key: 'audit', label: '日志', to: '/admin/audit', icon: ScrollText, cap: 'audit:read' },
];

const visibleItems = computed(() => allItems.filter(item => hasCapability(item.cap)));

const isActive = (key: string) => {
  const path = route.path;
  if (key === 'dashboard') return path === '/admin' || path === '/admin/dashboard';
  return path.startsWith(`/admin/${key}`);
};
</script>
