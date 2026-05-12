<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();

const statusText = ref('正在确认登录状态...');
const detailText = ref('请稍候，完成后将自动关闭此窗口。');

const notifyOpener = (success: boolean, message?: string) => {
  if (!window.opener) return;
  window.opener.postMessage(
    {
      type: 'aiwb-oauth-popup-result',
      success,
      message,
    },
    window.location.origin,
  );
};

onMounted(async () => {
  const auth = route.query.auth;
  const returnTo = typeof route.query.returnTo === 'string' ? route.query.returnTo : '/';

  if (auth === 'success') {
    statusText.value = '登录成功';
    detailText.value = '正在通知主页面同步登录状态...';
    notifyOpener(true);
    window.setTimeout(() => {
      window.close();
      router.replace({ path: '/me', query: { auth: 'success', returnTo } });
    }, 500);
    return;
  }

  statusText.value = '登录未完成';
  detailText.value = '未收到有效登录结果，请返回主页面重试。';
  notifyOpener(false, '未收到有效登录结果');
});
</script>

<template>
  <div class="min-h-screen bg-[#F8FAFC] dark:bg-[#0B1120] text-slate-900 dark:text-slate-100 font-sans flex items-center justify-center px-6">
    <div class="w-full max-w-md bg-white dark:bg-[#111827] rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-xl shadow-slate-200/50 dark:shadow-none p-8 text-center">
      <div class="inline-flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-extrabold text-lg">
        <span class="w-4 h-4 rounded-full bg-emerald-500 animate-pulse"></span>
        {{ statusText }}
      </div>
      <p class="mt-4 text-sm text-slate-600 dark:text-slate-300">{{ detailText }}</p>
      <p class="mt-6 text-xs text-slate-400">如果窗口未自动关闭，请手动关闭并返回原页面。</p>
    </div>
  </div>
</template>
