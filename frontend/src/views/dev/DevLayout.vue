<template>
  <div class="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white flex overflow-x-hidden">
    <DevSidebar @logout="handleLogout" />

    <div class="flex-1 flex flex-col min-h-screen min-w-0 overflow-x-hidden">
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

      <main class="flex-1 p-4 lg:p-6">
        <router-view />
      </main>
    </div>

    <DevBottomNav />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuth } from '../../composables/useAuth';
import DevSidebar from '../../components/dev/DevSidebar.vue';
import DevBottomNav from '../../components/dev/DevBottomNav.vue';

const router = useRouter();
const route = useRoute();
const { user: authUser, logout } = useAuth();

const currentTitle = computed(() => {
  const meta = route.meta as any;
  return meta?.title || 'Dev 后台';
});

const handleLogout = async () => {
  await logout();
  router.push('/');
};
</script>
