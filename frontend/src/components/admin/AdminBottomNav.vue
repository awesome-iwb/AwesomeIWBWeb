<template>
  <nav class="fixed bottom-0 left-0 right-0 z-50 lg:hidden safe-area-pb">
    <div class="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700">
      <div class="grid grid-cols-5 h-14">
        <button
          v-for="item in primaryItems"
          :key="item.key"
          @click="navigate(item.to)"
          class="flex flex-col items-center justify-center gap-0.5 transition-colors active:scale-95"
          :class="isActive(item.key) ? 'text-emerald-500' : 'text-slate-400'"
        >
          <component :is="item.icon" class="w-5 h-5" />
          <span class="text-[10px] font-medium">{{ item.label }}</span>
        </button>

        <button
          @click="showMore = !showMore"
          class="flex flex-col items-center justify-center gap-0.5 transition-colors active:scale-95"
          :class="showMore ? 'text-emerald-500' : 'text-slate-400'"
        >
          <component :is="showMore ? X : Menu" class="w-5 h-5" />
          <span class="text-[10px] font-medium">{{ showMore ? '收起' : '更多' }}</span>
        </button>
      </div>
    </div>

    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="translate-y-full opacity-0"
      enter-to-class="translate-y-0 opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="translate-y-0 opacity-100"
      leave-to-class="translate-y-full opacity-0"
    >
      <div v-if="showMore" class="absolute bottom-14 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 shadow-lg">
        <div class="grid grid-cols-4 gap-1 p-3">
          <button
            v-for="item in secondaryItems"
            :key="item.key"
            @click="navigate(item.to); showMore = false"
            class="flex flex-col items-center justify-center gap-1 py-3 rounded-xl transition-colors active:scale-95"
            :class="isActive(item.key) ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'"
          >
            <component :is="item.icon" class="w-5 h-5" />
            <span class="text-[10px] font-medium">{{ item.label }}</span>
          </button>
        </div>
      </div>
    </Transition>

    <div v-if="showMore" class="fixed inset-0 -top-14 z-[-1]" @click="showMore = false"></div>
  </nav>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuth } from '../../composables/useAuth';
import {
  LayoutDashboard, FileText, Package, ClipboardCheck,
  Shield, MessageSquare, Users, Image, ScrollText,
  Menu, X,
} from 'lucide-vue-next';

const route = useRoute();
const router = useRouter();
const { hasCapability } = useAuth();
const showMore = ref(false);

const allItems = [
  { key: 'dashboard', label: '总览', to: '/admin/dashboard', icon: LayoutDashboard, cap: 'admin_panel_access', primary: true },
  { key: 'projects', label: '项目', to: '/admin/projects', icon: Package, cap: 'project:read', primary: true },
  { key: 'submissions', label: '审核', to: '/admin/submissions', icon: ClipboardCheck, cap: 'submission:read', primary: true },
  { key: 'media', label: '图床', to: '/admin/media', icon: Image, cap: 'media:read', primary: true },
  { key: 'stories', label: '文章', to: '/admin/stories', icon: FileText, cap: 'story:manage', primary: false },
  { key: 'moderation', label: '内容', to: '/admin/moderation', icon: Shield, cap: 'moderation:read', primary: false },
  { key: 'feedback', label: '反馈', to: '/admin/feedback', icon: MessageSquare, cap: 'feedback:manage', primary: false },
  { key: 'users', label: '用户', to: '/admin/users', icon: Users, cap: 'user:read', primary: false },
  { key: 'audit', label: '日志', to: '/admin/audit', icon: ScrollText, cap: 'audit:read', primary: false },
];

const visibleItems = computed(() => allItems.filter(item => hasCapability(item.cap)));
const primaryItems = computed(() => visibleItems.value.filter(item => item.primary).slice(0, 4));
const secondaryItems = computed(() => {
  const primaryKeys = new Set(primaryItems.value.map(i => i.key));
  return visibleItems.value.filter(item => !primaryKeys.has(item.key));
});

const isActive = (key: string) => {
  const path = route.path;
  if (key === 'dashboard') return path === '/admin' || path === '/admin/dashboard';
  return path.startsWith(`/admin/${key}`);
};

const navigate = (to: string) => {
  if (route.path !== to) router.push(to);
};
</script>
