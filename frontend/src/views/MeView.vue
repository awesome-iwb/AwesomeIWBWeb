<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Github, LogIn, LogOut, Shield, Wrench } from 'lucide-vue-next';
import { useAuth } from '../composables/useAuth';

const router = useRouter();
const route = useRoute();
const { user, isAuthenticated, loginDemo, logout, setRole } = useAuth();

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

const loginStcnDemoAsCjk = () => {
  loginDemo({
    name: 'CJK_MKP',
    role: 'dev',
    stcn_user_id: 'stcn:demo:cjk_mkp',
    sectl_user_id: '',
    lincube_user_id: ''
  });
  goNext();
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
          <div class="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40">
            <div class="text-sm font-extrabold text-slate-800 dark:text-slate-200">智教联盟登录系统</div>
            <div class="text-sm text-slate-600 dark:text-slate-300 mt-1">当前为演示模式：点击按钮模拟完成 STCN 授权登录。</div>
          </div>
          <div class="flex flex-col sm:flex-row gap-3">
          <button
            @click="loginStcnDemoAsCjk"
            class="flex-1 inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3.5 rounded-2xl font-extrabold transition-colors"
          >
            <LogIn class="w-5 h-5" />
            使用智教联盟登录（演示）
          </button>
          <a
            href="https://github.com/awesome-iwb/awesome-iwb"
            target="_blank"
            class="flex-1 inline-flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-6 py-3.5 rounded-2xl font-extrabold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <Github class="w-5 h-5" />
            GitHub
          </a>
          </div>
        </div>

        <div v-else class="mt-8 space-y-6">
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              @click="setRole('user')"
              class="px-4 py-3 rounded-2xl border font-extrabold transition-colors"
              :class="user?.role === 'user' ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10' : 'border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/30 hover:bg-slate-50 dark:hover:bg-slate-900/50'"
            >
              普通用户（演示）
            </button>
            <button
              @click="setRole('dev')"
              class="px-4 py-3 rounded-2xl border font-extrabold transition-colors"
              :class="user?.role === 'dev' ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10' : 'border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/30 hover:bg-slate-50 dark:hover:bg-slate-900/50'"
            >
              开发者（演示）
            </button>
            <button
              @click="setRole('ops')"
              class="px-4 py-3 rounded-2xl border font-extrabold transition-colors"
              :class="user?.role === 'ops' ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10' : 'border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/30 hover:bg-slate-50 dark:hover:bg-slate-900/50'"
            >
              运维（演示）
            </button>
          </div>

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
