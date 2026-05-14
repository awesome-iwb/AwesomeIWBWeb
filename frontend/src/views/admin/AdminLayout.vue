<template>
  <div class="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white flex">
    <AdminSidebar @logout="handleLogout" />

    <div class="flex-1 flex flex-col min-h-screen lg:min-w-0">
      <header class="sticky top-0 z-40 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 lg:px-6 py-2.5 lg:py-3 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <h2 class="text-base lg:text-lg font-bold text-slate-900 dark:text-white">{{ currentTitle }}</h2>
        </div>
        <div class="flex items-center gap-2">
          <span v-if="authUser" class="text-sm text-slate-500 dark:text-slate-400 hidden sm:inline">{{ authUser.name }}</span>
          <button @click="router.push('/')" class="px-3 py-1.5 rounded-lg text-sm font-medium border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
            返回首页
          </button>
          <button @click="handleLogout" class="px-3 py-1.5 rounded-lg text-sm font-medium bg-rose-500 hover:bg-rose-600 text-white transition-colors">
            退出
          </button>
        </div>
      </header>

      <main class="flex-1 p-4 lg:p-6 pb-20 lg:pb-6">
        <router-view />
      </main>
    </div>

    <AdminBottomNav />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuth } from '../../composables/useAuth';
import AdminSidebar from '../../components/admin/AdminSidebar.vue';
import AdminBottomNav from '../../components/admin/AdminBottomNav.vue';

const router = useRouter();
const route = useRoute();
const { user: authUser, logout } = useAuth();

const currentTitle = computed(() => {
  const meta = route.meta as any;
  return meta?.title || '管理后台';
});

const handleLogout = async () => {
  await logout();
  router.push('/');
};
</script>
