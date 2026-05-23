<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { CheckCircle2, XCircle } from 'lucide-vue-next';

const route = useRoute();

const statusText = ref('正在确认登录状态...');
const detailText = ref('请稍候，完成后将自动关闭此窗口。');
const isSuccess = ref(false);
const isFailed = ref(false);
const showCloseHint = ref(false);

const handleClose = () => {
  try { window.close(); } catch {}
};

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

  if (auth === 'success') {
    statusText.value = '登录成功';
    detailText.value = '正在通知主页面同步登录状态...';
    isSuccess.value = true;
    notifyOpener(true);

    window.setTimeout(async () => {
      try {
        window.close();
      } catch {}

      if (!window.closed) {
        statusText.value = '登录成功';
        detailText.value = '主页面已同步登录状态，你可以安全地关闭此窗口。';
        showCloseHint.value = true;
      }
    }, 800);
    return;
  }

  statusText.value = '登录未完成';
  detailText.value = '未收到有效登录结果，请返回主页面重试。';
  isFailed.value = true;
  showCloseHint.value = true;
  notifyOpener(false, '未收到有效登录结果');
});
</script>

<template>
  <div class="min-h-screen bg-[#F8FAFC] dark:bg-[#0B1120] text-foreground font-sans flex items-center justify-center px-6">
    <div class="w-full max-w-md bg-white dark:bg-[#111827] rounded-3xl border border-border shadow-xl shadow-slate-200/50 dark:shadow-none p-8 text-center">
      <div v-if="isSuccess" class="flex flex-col items-center gap-3">
        <div class="w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center">
          <CheckCircle2 class="w-8 h-8 text-emerald-500" />
        </div>
        <h1 class="text-lg font-bold text-emerald-600 dark:text-emerald-400">{{ statusText }}</h1>
      </div>
      <div v-else-if="isFailed" class="flex flex-col items-center gap-3">
        <div class="w-14 h-14 rounded-full bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center">
          <XCircle class="w-8 h-8 text-rose-500" />
        </div>
        <h1 class="text-lg font-bold text-rose-600 dark:text-rose-400">{{ statusText }}</h1>
      </div>
      <div v-else class="flex flex-col items-center gap-3">
        <div class="w-5 h-5 rounded-full bg-emerald-500 animate-pulse"></div>
        <h1 class="text-lg font-bold text-emerald-600 dark:text-emerald-400">{{ statusText }}</h1>
      </div>

      <p class="mt-4 text-sm text-muted-foreground">{{ detailText }}</p>

      <div v-if="showCloseHint" class="mt-6 p-4 rounded-2xl bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20">
        <p class="text-sm font-medium text-blue-700 dark:text-blue-300">你可以安全地关闭此窗口</p>
        <p class="mt-1 text-xs text-blue-500 dark:text-blue-400">返回原来的页面即可继续使用</p>
      </div>

      <button
        v-if="showCloseHint"
        type="button"
        class="mt-4 px-6 py-2.5 rounded-xl text-sm font-bold bg-[var(--color-brand-500)] text-white hover:bg-[var(--color-brand-600)] transition-colors"
        @click="handleClose"
      >关闭此窗口</button>
    </div>
  </div>
</template>
