<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { AlertCircle, Home, User } from 'lucide-vue-next';

const route = useRoute();
const router = useRouter();

const reasonText = computed(() => {
  const reason = route.query.reason;
  if (reason === 'navigation-error') return '页面加载失败或路由跳转中断，请稍后重试。';
  return '你访问的页面不存在，可能已被移动或删除。';
});

const goHome = () => router.push('/');
const goMe = () => router.push('/me');
</script>

<template>
  <div class="min-h-screen bg-[#F8FAFC] dark:bg-[#0B1120] text-foreground font-sans pb-24">
    <main class="pt-24 px-6 max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out-expo">
      <div class="mb-10 text-center">
        <h1 class="text-4xl font-extrabold tracking-tight text-foreground mb-3">页面未找到</h1>
        <p class="text-muted-foreground">别担心，你可以直接返回可用页面继续操作。</p>
      </div>

      <div class="bg-white dark:bg-[#111827] rounded-3xl p-6 sm:p-10 border border-border shadow-xl shadow-slate-200/50 dark:shadow-none">
        <div class="p-4 rounded-2xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-500/10 flex items-start gap-3">
          <AlertCircle class="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
          <div class="text-sm text-rose-700 dark:text-rose-300">{{ reasonText }}</div>
        </div>

        <div class="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            @click="goHome"
            class="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3.5 rounded-2xl font-extrabold transition-colors"
          >
            <Home class="w-5 h-5" />
            返回首页
          </button>
          <button
            @click="goMe"
            class="inline-flex items-center justify-center gap-2 bg-secondary text-foreground px-6 py-3.5 rounded-2xl font-extrabold hover:bg-accent transition-colors"
          >
            <User class="w-5 h-5" />
            去个人中心
          </button>
        </div>
      </div>
    </main>
  </div>
</template>
