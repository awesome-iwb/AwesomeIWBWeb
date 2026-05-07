<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Github, LogIn, LogOut, Shield, Wrench, AlertCircle } from 'lucide-vue-next';
import { useAuth } from '../composables/useAuth';

const router = useRouter();
const route = useRoute();
const { user, isAuthenticated, logout, loginWithCasdoor, handleCallback } = useAuth();

const redirectTo = computed(() => {
  const q = route.query.redirect;
  return typeof q === 'string' && q ? q : '/';
});

const roleLabel = computed(() => {
  if (!user.value) return '';
  if (user.value.role === 'ops') return '运维';
  if (user.value.role === 'dev') return '开发者';
  return '用户';
});

const goNext = () => router.push(redirectTo.value);

const isLoggingIn = ref(false);
const loginError = ref('');

// Handle Casdoor OAuth callback (two modes: backend redirect with token, or direct code+state)
onMounted(async () => {
  // Mode 1: Backend redirect with token in URL
  const token = route.query.token as string | undefined;
  const userId = route.query.user_id as string | undefined;
  const userName = route.query.user_name as string | undefined;
  const userRole = route.query.user_role as string | undefined;

  if (token && userId) {
    isLoggingIn.value = true;
    loginError.value = '';
    try {
      const { setToken, fetchUser } = useAuth();
      setToken(token, {
        id: userId,
        name: userName || '',
        role: (userRole as any) || 'user',
      });
      // Fetch full user info from backend
      await fetchUser();
      // Clean URL
      await router.replace({ path: '/me', query: {} });
      goNext();
      return;
    } catch (e: any) {
      loginError.value = e?.message || '登录过程中发生错误';
    } finally {
      isLoggingIn.value = false;
    }
  }

  // Mode 2: Direct code+state (fallback for API mode)
  const code = route.query.code as string | undefined;
  const state = route.query.state as string | undefined;

  if (code && state) {
    isLoggingIn.value = true;
    loginError.value = '';
    try {
      const success = await handleCallback(code, state);
      if (success) {
        await router.replace({ path: '/me', query: {} });
        goNext();
        return;
      }
      loginError.value = '登录回调处理失败，请重试';
    } catch (e: any) {
      loginError.value = e?.message || '登录过程中发生错误';
    } finally {
      isLoggingIn.value = false;
    }
  }
});

const startStcnLogin = async () => {
  isLoggingIn.value = true;
  loginError.value = '';
  try {
    await loginWithCasdoor();
  } catch (e: any) {
    loginError.value = e?.message || '无法启动登录流程，请检查网络连接';
    isLoggingIn.value = false;
  }
};

</script>

<template>
  <div class="min-h-screen bg-[#F8FAFC] dark:bg-[#0B1120] text-slate-900 dark:text-slate-100 font-sans pb-24">
    <main class="pt-24 px-6 max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out-expo">
      <div class="mb-10">
        <h1 class="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-3">个人中心</h1>
        <p class="text-slate-600 dark:text-slate-300">本页面先做 UI 占位，后续接入智教联盟（STCN，基于 Casdoor）等第三方授权后替换登录逻辑。</p>
      </div>

      <div class="bg-white dark:bg-[#111827] rounded-3xl p-6 sm:p-10 border border-slate-200/80 dark:border-slate-800/80 shadow-xl shadow-slate-200/50 dark:shadow-none">
        <div class="flex items-center gap-4">
          <div class="h-14 w-14 rounded-full bg-slate-200/70 dark:bg-slate-700/70 overflow-hidden shrink-0">
            <img v-if="user" :src="user.avatarUrl" class="h-full w-full object-cover" />
          </div>
          <div class="min-w-0">
            <div class="text-xl font-extrabold text-slate-900 dark:text-white truncate">
              {{ user?.name || '未登录' }}
            </div>
            <div class="text-sm text-slate-500 dark:text-slate-400 truncate">
              {{ isAuthenticated ? `身份：${roleLabel}` : '登录后可提交项目并进入对应后台入口' }}
            </div>
          </div>
        </div>

        <div v-if="!isAuthenticated" class="mt-8 space-y-4">
          <div v-if="loginError" class="p-4 rounded-2xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-500/10 flex items-start gap-3">
            <AlertCircle class="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            <div class="text-sm text-rose-700 dark:text-rose-300">{{ loginError }}</div>
          </div>

          <div class="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40">
            <div class="text-sm font-extrabold text-slate-800 dark:text-slate-200">智教联盟登录系统</div>
            <div class="text-sm text-slate-600 dark:text-slate-300 mt-1">使用智教联盟（STCN）统一身份认证登录，无需额外注册。</div>
          </div>

          <button
            @click="startStcnLogin"
            :disabled="isLoggingIn"
            class="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed text-white px-6 py-3.5 rounded-2xl font-extrabold transition-colors"
          >
            <LogIn v-if="!isLoggingIn" class="w-5 h-5" />
            <span v-if="isLoggingIn" class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            {{ isLoggingIn ? '正在跳转登录...' : '使用智教联盟登录' }}
          </button>

          <div class="flex flex-col sm:flex-row gap-3">
            <a
              href="https://github.com/awesome-iwb/awesome-iwb"
              target="_blank"
              class="flex-1 inline-flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-6 py-3.5 rounded-2xl font-extrabold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              <Github class="w-5 h-5" />
              GitHub
            </a>
          </div>

          <!-- Emergency admin login -->
          <div class="pt-2">
            <button
              @click="router.push('/admin-login')"
              class="w-full text-xs text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 transition-colors py-2"
            >
              超级管理员登录（应急通道）
            </button>
          </div>
        </div>

        <div v-else class="mt-8 space-y-6">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              v-if="user?.role === 'ops'"
              @click="router.push('/admin')"
              class="inline-flex items-center justify-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-6 py-3.5 rounded-2xl font-extrabold transition-colors"
            >
              <Shield class="w-5 h-5" />
              运维后台
            </button>
            <button
              v-if="user?.role === 'dev'"
              @click="router.push('/dev')"
              class="inline-flex items-center justify-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-6 py-3.5 rounded-2xl font-extrabold transition-colors"
            >
              <Wrench class="w-5 h-5" />
              开发者后台
            </button>
            <button
              @click="goNext()"
              class="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3.5 rounded-2xl font-extrabold transition-colors"
            >
              返回
            </button>
            <button
              @click="logout(); router.replace('/me')"
              class="inline-flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-6 py-3.5 rounded-2xl font-extrabold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              <LogOut class="w-5 h-5" />
              退出登录
            </button>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>
