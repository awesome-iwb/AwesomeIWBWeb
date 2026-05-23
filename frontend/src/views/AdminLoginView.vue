<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { Shield, LogIn, AlertCircle, ArrowLeft, Eye, EyeOff } from 'lucide-vue-next';
import { useAuth } from '../composables/useAuth';

const router = useRouter();
const { loginWithPassword, hasCapability } = useAuth();

const username = ref('');
const password = ref('');
const showPassword = ref(false);
const isLoading = ref(false);
const error = ref('');
const remainingAttempts = ref<number | undefined>(undefined);

const goBack = () => router.push('/me');

const handleLogin = async () => {
  error.value = '';
  remainingAttempts.value = undefined;

  if (!username.value.trim()) {
    error.value = '请输入超级管理员账号';
    return;
  }

  if (!password.value) {
    error.value = '请输入密码';
    return;
  }

  isLoading.value = true;
  try {
    const ok = await loginWithPassword(username.value.trim(), password.value);
    if (!ok) {
      throw new Error('登录失败');
    }

    if (hasCapability('admin_panel_access')) {
      router.push('/admin');
      return;
    }

    error.value = '登录成功，但当前账号没有后台访问权限';
  } catch (e: any) {
    error.value = '登录失败';
  } finally {
    isLoading.value = false;
  }
};
</script>

<template>
  <div class="min-h-screen bg-[#F8FAFC] dark:bg-[#0B1120] text-foreground font-sans flex items-center justify-center px-4">
    <div class="w-full max-w-md">
      <!-- Back button -->
      <button
        @click="goBack"
        class="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
      >
        <ArrowLeft class="w-4 h-4" />
        返回登录页
      </button>

      <!-- Card -->
      <div class="bg-white dark:bg-[#111827] rounded-3xl p-8 border border-border shadow-xl shadow-slate-200/50 dark:shadow-none">
        <!-- Header -->
        <div class="flex items-center gap-3 mb-2">
          <div class="h-10 w-10 rounded-2xl bg-rose-500/10 dark:bg-rose-500/20 flex items-center justify-center">
            <Shield class="w-5 h-5 text-rose-500" />
          </div>
          <div>
            <h1 class="text-xl font-extrabold text-foreground">超级管理员登录</h1>
            <p class="text-xs text-muted-foreground">员工/运维入口</p>
          </div>
        </div>

        <p class="text-sm text-muted-foreground mt-4 mb-6">
          当智教联盟登录系统不可用时，可使用此应急通道登录运维后台。
        </p>

        <!-- Error -->
        <div v-if="error" class="mb-4 p-4 rounded-2xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-500/10 flex items-start gap-3">
          <AlertCircle class="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
          <div>
            <div class="text-sm text-rose-700 dark:text-rose-300">{{ error }}</div>
            <div v-if="remainingAttempts !== undefined && remainingAttempts > 0" class="text-xs text-rose-600 dark:text-rose-400 mt-1">
              剩余尝试次数：{{ remainingAttempts }}
            </div>
          </div>
        </div>

        <!-- Form -->
        <form @submit.prevent="handleLogin" class="space-y-4">
          <div>
            <label class="block text-sm font-extrabold text-foreground mb-1.5">用户名</label>
            <input
              v-model="username"
              type="text"
              autocomplete="username"
              placeholder="管理员账号"
              class="w-full px-4 py-3 rounded-2xl bg-card/50 border border-border text-foreground placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500 transition-all"
            />
          </div>

          <div>
            <label class="block text-sm font-extrabold text-foreground mb-1.5">密码</label>
            <div class="relative">
              <input
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                autocomplete="current-password"
                placeholder="请输入密码"
                class="w-full px-4 py-3 pr-12 rounded-2xl bg-card/50 border border-border text-foreground placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500 transition-all"
              />
              <button
                type="button"
                @click="showPassword = !showPassword"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                <Eye v-if="!showPassword" class="w-5 h-5" />
                <EyeOff v-else class="w-5 h-5" />
              </button>
            </div>
          </div>

          <button
            type="submit"
            :disabled="isLoading"
            class="w-full inline-flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 disabled:cursor-not-allowed text-white px-6 py-3.5 rounded-2xl font-extrabold transition-colors"
          >
            <LogIn v-if="!isLoading" class="w-5 h-5" />
            <span v-if="isLoading" class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            {{ isLoading ? '正在登录...' : '登录运维后台' }}
          </button>
        </form>

        <!-- Warning -->
        <div class="mt-6 p-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-500/10">
          <p class="text-xs text-amber-700 dark:text-amber-300">
            此登录方式仅用于应急场景。正常使用请通过智教联盟账号登录。
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
