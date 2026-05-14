<template>
  <nav class="fixed bottom-0 left-0 right-0 z-50 lg:hidden safe-area-pb">
    <div class="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700">
      <div class="grid grid-cols-5 h-14">
        <button
          v-for="item in visibleItems"
          :key="item.key"
          @click="navigate(item.to)"
          class="flex flex-col items-center justify-center gap-0.5 transition-colors active:scale-95"
          :class="isActive(item.key) ? 'text-blue-500' : 'text-slate-400'"
        >
          <component :is="item.icon" class="w-5 h-5" />
          <span class="text-[10px] font-medium">{{ item.label }}</span>
        </button>
      </div>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuth } from '../../composables/useAuth';
import {
  LayoutDashboard, Building2, Package, Bug, MessageSquare,
} from 'lucide-vue-next';

const route = useRoute();
const router = useRouter();
const { hasCapability } = useAuth();

const allItems = [
  { key: 'dashboard', label: '总览', to: '/dev/dashboard', icon: LayoutDashboard, cap: 'dev_panel_access' },
  { key: 'organizations', label: '组织', to: '/dev/organizations', icon: Building2, cap: 'dev_panel_access' },
  { key: 'projects', label: '项目', to: '/dev/projects', icon: Package, cap: 'dev_panel_access' },
  { key: 'bugs', label: 'Bug', to: '/dev/bugs', icon: Bug, cap: 'dev:bug_manage' },
  { key: 'comments', label: '评论', to: '/dev/comments', icon: MessageSquare, cap: 'dev:comment_manage' },
];

const visibleItems = computed(() => allItems.filter(item => hasCapability(item.cap)));

const isActive = (key: string) => {
  const path = route.path;
  if (key === 'dashboard') return path === '/dev' || path === '/dev/dashboard';
  return path.startsWith(`/dev/${key}`);
};

const navigate = (to: string) => {
  if (route.path !== to) router.push(to);
};
</script>
