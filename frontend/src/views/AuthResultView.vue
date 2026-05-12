<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useHead } from '@unhead/vue';
import { AlertCircle, CheckCircle2, Copy, ArrowRight, ShieldCheck } from 'lucide-vue-next';
import { useAuth } from '../composables/useAuth';

useHead({
  title: '账号确认 - Awesome IWB',
  meta: [
    { name: 'description', content: '确认智教联盟绑定信息并进入系统。' }
  ]
});

const route = useRoute();
const router = useRouter();
const { fetchUser, user, capabilities, isSuperadmin, markProfileConfirmed } = useAuth();

const loading = ref(true);
const loadError = ref('');
const rawMePayload = ref<any>(null);
const copied = ref(false);
const showRaw = ref(false);

const safeReturnTo = computed(() => {
  const q = route.query.returnTo;
  if (typeof q === 'string' && q.startsWith('/')) return q;
  return '/';
});

const isConfirmed = computed(() => user.value?.profileConfirmed === true);

const continueToNext = async () => {
  markProfileConfirmed();
  await router.push(safeReturnTo.value);
};

const copyJson = async () => {
  if (!rawMePayload.value) return;
  try {
    await navigator.clipboard.writeText(JSON.stringify(rawMePayload.value, null, 2));
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 1200);
  } catch {}
};

onMounted(async () => {
  loading.value = true;
  loadError.value = '';
  try {
    const ok = await fetchUser();
    if (!ok) {
      loadError.value = '无法获取账号信息，请重新登录后重试。';
      return;
    }

    const res = await fetch('/api/auth/me', { credentials: 'include' });
    if (!res.ok) {
      loadError.value = `读取 /api/auth/me 失败（${res.status}）`;
      return;
    }
    rawMePayload.value = await res.json();
  } catch (e: any) {
    loadError.value = e?.message || '读取账号信息失败';
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="min-h-screen bg-[#F8FAFC] dark:bg-[#0B1120] text-slate-900 dark:text-slate-100 font-sans pb-24">
    <main class="pt-24 px-6 max-w-5xl mx-auto">
      <div class="mb-8">
        <h1 class="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-2">
          {{ isConfirmed ? '智教联盟绑定信息' : '创建账号确认' }}
        </h1>
        <p class="text-slate-600 dark:text-slate-300">
          {{ isConfirmed ? '你可以在这里随时查看当前绑定信息。' : '请确认以下账号信息，确认后进入系统。' }}
        </p>
      </div>

      <div v-if="loading" class="bg-white dark:bg-[#111827] rounded-3xl p-8 border border-slate-200/80 dark:border-slate-800/80 shadow-xl shadow-slate-200/50 dark:shadow-none">
        <div class="inline-flex items-center gap-3 text-slate-600 dark:text-slate-300">
          <span class="w-5 h-5 border-2 border-slate-300 border-t-slate-600 dark:border-slate-600 dark:border-t-slate-300 rounded-full animate-spin"></span>
          正在读取账号信息...
        </div>
      </div>

      <div v-else-if="loadError" class="bg-white dark:bg-[#111827] rounded-3xl p-8 border border-rose-200 dark:border-rose-800 shadow-xl shadow-slate-200/50 dark:shadow-none">
        <div class="flex items-start gap-3">
          <AlertCircle class="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
          <div class="text-rose-700 dark:text-rose-300">{{ loadError }}</div>
        </div>
      </div>

      <div v-else class="space-y-6">
        <div class="bg-white dark:bg-[#111827] rounded-3xl p-6 sm:p-8 border border-slate-200/80 dark:border-slate-800/80 shadow-xl shadow-slate-200/50 dark:shadow-none">
          <div class="flex items-center gap-2 mb-4">
            <ShieldCheck class="w-5 h-5 text-emerald-500" />
            <h2 class="text-xl font-extrabold text-slate-900 dark:text-white">账号信息预览</h2>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div class="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800">
              <div class="text-xs text-slate-500 dark:text-slate-400">姓名</div>
              <div class="font-bold mt-1 break-all">{{ user?.name || '-' }}</div>
            </div>
            <div class="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800">
              <div class="text-xs text-slate-500 dark:text-slate-400">邮箱</div>
              <div class="font-bold mt-1 break-all">{{ user?.email || '-' }}</div>
            </div>
            <div class="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800">
              <div class="text-xs text-slate-500 dark:text-slate-400">STCN 用户 ID</div>
              <div class="font-bold mt-1 break-all">{{ user?.stcn_user_id || '-' }}</div>
            </div>
            <div class="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800">
              <div class="text-xs text-slate-500 dark:text-slate-400">STCN 账号</div>
              <div class="font-bold mt-1 break-all">{{ user?.stcn_username || '-' }}</div>
            </div>
            <div class="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800">
              <div class="text-xs text-slate-500 dark:text-slate-400">头像来源</div>
              <div class="font-bold mt-1 break-all">{{ user?.avatar_source || '-' }}</div>
            </div>
            <div class="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800">
              <div class="text-xs text-slate-500 dark:text-slate-400">权限信息</div>
              <div class="font-bold mt-1 break-all">is_superadmin={{ isSuperadmin ? 'true' : 'false' }}, capabilities={{ capabilities.length }}</div>
            </div>
          </div>

          <div class="mt-4 inline-flex items-center gap-2 text-xs px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 class="w-4 h-4" />
            {{ isConfirmed ? '该账号已完成确认，可正常回看绑定信息。' : '确认后将进入系统，后续可在个人中心再次查看绑定信息。' }}
          </div>
        </div>

        <div class="bg-white dark:bg-[#111827] rounded-3xl p-6 sm:p-8 border border-slate-200/80 dark:border-slate-800/80 shadow-xl shadow-slate-200/50 dark:shadow-none">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-xl font-extrabold text-slate-900 dark:text-white">登录返回 JSON（辅助核对）</h2>
            <div class="flex items-center gap-2">
              <button
                @click="showRaw = !showRaw"
                class="inline-flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                {{ showRaw ? '收起 JSON' : '展开 JSON' }}
              </button>
              <button
                @click="copyJson"
                class="inline-flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                <Copy class="w-4 h-4" />
                {{ copied ? '已复制' : '复制 JSON' }}
              </button>
            </div>
          </div>
          <pre v-if="showRaw" class="text-xs leading-6 overflow-auto p-4 rounded-2xl bg-slate-950 text-slate-100 border border-slate-800">{{ JSON.stringify(rawMePayload, null, 2) }}</pre>
        </div>

        <div class="flex justify-end">
          <button
            @click="continueToNext"
            class="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-2xl font-extrabold transition-colors"
          >
            {{ isConfirmed ? '返回系统' : '确认并进入系统' }}
            <ArrowRight class="w-4 h-4" />
          </button>
        </div>
      </div>
    </main>
  </div>
</template>
