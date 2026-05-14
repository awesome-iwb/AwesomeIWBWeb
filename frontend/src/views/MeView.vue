<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useHead } from '@unhead/vue';
import { Github, LogIn, LogOut, Shield, Wrench, AlertCircle, Camera, Building2, FolderKanban, ArrowRight } from 'lucide-vue-next';
import { useAuth } from '../composables/useAuth';
import ImageCropper from '../components/ImageCropper.vue';

useHead({
  title: '个人中心 - Awesome IWB',
  meta: [
    { name: 'description', content: '管理你的 Awesome IWB 账户、查看收藏项目和提交历史。' }
  ]
});

const router = useRouter();
const route = useRoute();
const { user, isAuthenticated, logout, getCasdoorAuthorizeUrl, uploadAvatar, hasCapability, fetchUser, organizations } = useAuth();

const redirectTo = computed(() => {
  const q = route.query.redirect;
  return typeof q === 'string' && q ? q : '/';
});

const roleLabel = computed(() => {
  if (!user.value) return '';
  if (hasCapability('admin_panel_access')) return '运维';
  if (hasCapability('dev_panel_access')) return '开发者';
  return '用户';
});

const goNext = () => router.push(redirectTo.value);

const isLoggingIn = ref(false);
const loginError = ref('');
const logoutError = ref('');
const popupStatus = ref('');

const isUploadingAvatar = ref(false);
const avatarUploadError = ref('');
const fileInputRef = ref<HTMLInputElement | null>(null);

const showEmergencyLocalLogin = computed(() => !import.meta.env.PROD);

const showCropper = ref(false);
const cropperImageSrc = ref('');

onMounted(async () => {
  const authSuccess = route.query.auth as string | undefined;
  const returnTo = route.query.returnTo as string | undefined;
  const nextPath = returnTo && returnTo.startsWith('/') ? returnTo : '/';

  if (authSuccess === 'failed') {
    loginError.value = '登录未完成，请重试';
    await router.replace({ path: '/me', query: {} });
    return;
  }

  if (authSuccess === 'success') {
    isLoggingIn.value = true;
    loginError.value = '';
    try {
      const { fetchUser } = useAuth();
      const ok = await fetchUser();
      await router.replace({ path: '/me', query: {} });
      if (!ok) {
        loginError.value = '登录状态获取失败，请重试';
        return;
      }
      await router.push({ path: '/auth/result', query: { returnTo: nextPath } });
      return;
    } catch (e: unknown) {
      loginError.value = e instanceof Error && e.message ? e.message : '登录过程中发生错误';
      await router.replace({ path: '/me', query: {} });
    } finally {
      isLoggingIn.value = false;
    }
  }

});

const startStcnLogin = async () => {
  isLoggingIn.value = true;
  loginError.value = '';
  popupStatus.value = '正在打开登录窗口...';

  let popup: Window | null = null;
  let pollTimer: number | null = null;

  const stopPoll = () => {
    if (pollTimer !== null) {
      window.clearInterval(pollTimer);
      pollTimer = null;
    }
  };

  const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

  const fetchUserWithRetry = async (attempts = 6, delayMs = 300) => {
    for (let i = 0; i < attempts; i += 1) {
      const ok = await fetchUser();
      if (ok) return true;
      if (i < attempts - 1) await wait(delayMs);
    }
    return false;
  };

  const finishError = (message: string) => {
    stopPoll();
    popupStatus.value = '';
    loginError.value = message;
    isLoggingIn.value = false;
  };

  const finishSuccess = async () => {
    stopPoll();
    popupStatus.value = '正在接收登录数据...';
    const ok = await fetchUserWithRetry();
    if (!ok) {
      finishError('登录完成，但接收数据失败，请重试');
      return;
    }

    popupStatus.value = '已成功接收到数据，正在跳转结果页...';
    await wait(700);

    isLoggingIn.value = false;
    popupStatus.value = '';

    const nextPath = redirectTo.value && redirectTo.value.startsWith('/') ? redirectTo.value : '/';
    await router.push({ path: '/auth/result', query: { returnTo: nextPath } });
  };

  const onMessage = async (event: MessageEvent) => {
    if (event.origin !== window.location.origin) return;
    const data = event.data as { type?: string; success?: boolean; message?: string };
    if (data?.type !== 'aiwb-oauth-popup-result') return;

    window.removeEventListener('message', onMessage);
    try {
      popup?.close();
    } catch {}

    if (data.success) {
      await finishSuccess();
      return;
    }
    finishError(data.message || '登录失败，请重试');
  };

  try {
    const authorizeUrl = await getCasdoorAuthorizeUrl(redirectTo.value || undefined);
    popup = window.open(authorizeUrl, 'aiwb-auth-popup', 'width=560,height=760,menubar=no,toolbar=no,location=yes,status=no,noopener=no');
    if (!popup) {
      finishError('浏览器拦截了登录弹窗，请允许弹窗后重试');
      return;
    }

    window.addEventListener('message', onMessage);
    popupStatus.value = '请在弹窗中完成登录...';

    pollTimer = window.setInterval(async () => {
      if (!popup || popup.closed) {
        stopPoll();
        window.removeEventListener('message', onMessage);
        popupStatus.value = '正在检测登录状态...';
        const ok = await fetchUserWithRetry(2, 250);
        if (ok) {
          await finishSuccess();
        } else {
          finishError('登录窗口已关闭，未完成登录');
        }
      }
    }, 500);
  } catch (e: any) {
    window.removeEventListener('message', onMessage);
    finishError(e?.message || '无法启动登录流程，请检查网络连接');
  }
};

const triggerFileInput = () => {
  fileInputRef.value?.click();
};

const handleAvatarChange = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  avatarUploadError.value = '';

  const reader = new FileReader();
  reader.onload = (e) => {
    cropperImageSrc.value = e.target?.result as string;
    showCropper.value = true;
  };
  reader.onerror = () => {
    avatarUploadError.value = '无法读取图片文件';
  };
  reader.readAsDataURL(file);

  if (fileInputRef.value) fileInputRef.value.value = '';
};

const handleCropConfirm = async (blob: Blob) => {
  showCropper.value = false;
  isUploadingAvatar.value = true;
  avatarUploadError.value = '';

  try {
    const file = new File([blob], 'avatar.webp', { type: 'image/webp' });
    const url = await uploadAvatar(file);
    if (!url) {
      avatarUploadError.value = '头像上传失败，请重试';
    } else {
      const { fetchUser } = useAuth();
      await fetchUser();
    }
  } catch (e: any) {
    avatarUploadError.value = e?.message || '头像上传失败';
  } finally {
    isUploadingAvatar.value = false;
  }
};

const handleCropCancel = () => {
  showCropper.value = false;
  cropperImageSrc.value = '';
};

const handleLogout = async () => {
  logoutError.value = '';
  const ok = await logout();
  if (!ok) {
    logoutError.value = '退出登录未生效，请稍后重试';
    return;
  }
  await router.replace('/me');
};
</script>

<template>
  <div class="min-h-screen bg-[#F8FAFC] dark:bg-[#0B1120] text-slate-900 dark:text-slate-100 font-sans pb-24">
    <main class="pt-24 px-6 max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out-expo">
      <div class="mb-10">
        <h1 class="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-3">个人中心</h1>
        <p class="text-slate-600 dark:text-slate-300">管理你的 Awesome IWB 账户信息。</p>
      </div>

      <div class="bg-white dark:bg-[#111827] rounded-3xl p-6 sm:p-10 border border-slate-200/80 dark:border-slate-800/80 shadow-xl shadow-slate-200/50 dark:shadow-none">
        <!-- User Profile Header -->
        <div class="flex items-center gap-4">
          <!-- Avatar with upload overlay -->
          <div class="relative group shrink-0">
            <div class="h-20 w-20 rounded-full bg-slate-200/70 dark:bg-slate-700/70 overflow-hidden">
              <img v-if="user" :src="user.avatarUrl" class="h-full w-full object-cover" />
              <div v-else class="h-full w-full flex items-center justify-center">
                <span class="text-2xl font-extrabold text-slate-400">?</span>
              </div>
            </div>
            <!-- Upload overlay (only when logged in) -->
            <button
              v-if="isAuthenticated"
              @click="triggerFileInput"
              :disabled="isUploadingAvatar"
              class="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer disabled:cursor-not-allowed"
            >
              <Camera v-if="!isUploadingAvatar" class="w-6 h-6 text-white" />
              <span v-else class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            </button>
            <input
              ref="fileInputRef"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              class="hidden"
              @change="handleAvatarChange"
            />
          </div>
          <div class="min-w-0">
            <div class="text-xl font-extrabold text-slate-900 dark:text-white truncate">
              {{ user?.name || '未登录' }}
            </div>
            <div v-if="user?.stcn_username" class="text-sm text-emerald-600 dark:text-emerald-400 truncate">
              @{{ user.stcn_username }}
            </div>
            <div class="text-sm text-slate-500 dark:text-slate-400 truncate">
              {{ isAuthenticated ? `身份：${roleLabel}` : '登录后可提交项目并进入对应后台入口' }}
            </div>
          </div>
        </div>

        <!-- Avatar upload error -->
        <div v-if="avatarUploadError" class="mt-4 p-4 rounded-2xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-500/10 flex items-start gap-3">
          <AlertCircle class="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
          <div class="text-sm text-rose-700 dark:text-rose-300">{{ avatarUploadError }}</div>
        </div>

        <!-- Not logged in -->
        <div v-if="!isAuthenticated" class="mt-8 space-y-4">
          <div v-if="loginError" class="p-4 rounded-2xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-500/10 flex items-start gap-3">
            <AlertCircle class="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            <div class="text-sm text-rose-700 dark:text-rose-300">{{ loginError }}</div>
          </div>

          <div v-if="popupStatus" class="p-4 rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-500/10 text-sm text-emerald-700 dark:text-emerald-300">
            {{ popupStatus }}
          </div>

          <div class="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40">
            <div class="text-sm font-extrabold text-slate-800 dark:text-slate-200">智教联盟登录系统</div>
            <div class="text-sm text-slate-600 dark:text-slate-300 mt-1">普通用户使用智教联盟（STCN）统一身份认证登录，无需额外注册。</div>
            <div class="text-xs text-slate-500 dark:text-slate-400 mt-2">员工请使用专用 staff 通道登录。</div>
          </div>

          <button
            @click="startStcnLogin"
            :disabled="isLoggingIn"
            class="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed text-white px-6 py-3.5 rounded-2xl font-extrabold transition-colors"
          >
            <LogIn v-if="!isLoggingIn" class="w-5 h-5" />
            <span v-if="isLoggingIn" class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            {{ isLoggingIn ? '登录处理中...' : '使用智教联盟登录' }}
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
          <div v-if="showEmergencyLocalLogin" class="pt-2">
            <button
              @click="router.push('/dontusejy')"
              class="w-full text-xs text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 transition-colors py-2"
            >
              本地登录入口
            </button>
          </div>
        </div>

        <!-- Logged in -->
        <div v-else class="mt-8 space-y-6">
          <div v-if="logoutError" class="p-4 rounded-2xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-500/10 flex items-start gap-3">
            <AlertCircle class="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            <div class="text-sm text-rose-700 dark:text-rose-300">{{ logoutError }}</div>
          </div>
          <!-- Profile info card -->
          <div class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 p-4 space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-sm text-slate-500 dark:text-slate-400">头像来源</span>
              <span class="text-sm font-medium text-slate-700 dark:text-slate-200">
                {{ user?.avatar_source === 'upload' ? '自定义上传' : user?.avatar_source === 'casdoor' ? '智教联盟同步' : '默认' }}
              </span>
            </div>
            <div v-if="user?.email" class="flex items-center justify-between">
              <span class="text-sm text-slate-500 dark:text-slate-400">邮箱</span>
              <span class="text-sm font-medium text-slate-700 dark:text-slate-200">{{ user.email }}</span>
            </div>
            <div v-if="user?.stcn_username" class="flex items-center justify-between">
              <span class="text-sm text-slate-500 dark:text-slate-400">STCN 账号</span>
              <span class="text-sm font-medium text-emerald-600 dark:text-emerald-400">@{{ user.stcn_username }}</span>
            </div>
            <div class="pt-2">
              <button
                @click="router.push('/auth/result')"
                class="w-full inline-flex items-center justify-center gap-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-4 py-2.5 rounded-xl font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                查看智教联盟绑定信息
              </button>
            </div>
          </div>

          <!-- My Organizations & Projects -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              @click="router.push('/dev/organizations')"
              class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 p-4 text-left hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors group"
            >
              <div class="flex items-center gap-3 mb-3">
                <div class="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center">
                  <Building2 class="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <div class="text-sm font-extrabold text-slate-900 dark:text-white">我的组织</div>
                  <div class="text-xs text-slate-500 dark:text-slate-400">{{ organizations.length }} 个组织</div>
                </div>
              </div>
              <div v-if="organizations.length > 0" class="space-y-1.5">
                <div v-for="org in organizations.slice(0, 3)" :key="org.id" class="flex items-center gap-2">
                  <img
                    :src="org.avatar_url || ''"
                    :alt="org.name"
                    class="w-5 h-5 rounded object-cover"
                    @error="(e) => { (e.target as HTMLImageElement).style.display = 'none' }"
                  />
                  <span class="text-xs text-slate-600 dark:text-slate-300 truncate">{{ org.name }}</span>
                  <span class="text-[10px] text-slate-400 dark:text-slate-500 ml-auto shrink-0">{{ org.member_role === 'owner' ? '所有者' : org.member_role === 'admin' ? '管理员' : '成员' }}</span>
                </div>
              </div>
              <div v-else class="text-xs text-slate-400 dark:text-slate-500">暂无组织</div>
              <div class="flex items-center gap-1 mt-2 text-xs font-medium text-emerald-600 dark:text-emerald-400 group-hover:gap-2 transition-all">
                查看全部 <ArrowRight class="w-3 h-3" />
              </div>
            </button>

            <button
              @click="router.push('/dev/projects')"
              class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 p-4 text-left hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors group"
            >
              <div class="flex items-center gap-3 mb-3">
                <div class="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
                  <FolderKanban class="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <div class="text-sm font-extrabold text-slate-900 dark:text-white">我的项目</div>
                  <div class="text-xs text-slate-500 dark:text-slate-400">管理参与的项目</div>
                </div>
              </div>
              <div class="text-xs text-slate-400 dark:text-slate-500">在开发者后台查看和管理</div>
              <div class="flex items-center gap-1 mt-2 text-xs font-medium text-emerald-600 dark:text-emerald-400 group-hover:gap-2 transition-all">
                进入项目 <ArrowRight class="w-3 h-3" />
              </div>
            </button>
          </div>

          <!-- Dev Panel Access Button -->
          <button
            v-if="hasCapability('dev_panel_access')"
            @click="router.push('/dev')"
            class="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3.5 rounded-2xl font-extrabold transition-colors shadow-lg shadow-emerald-600/20"
          >
            <Wrench class="w-5 h-5" />
            进入开发者后台
          </button>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              v-if="hasCapability('admin_panel_access')"
              @click="router.push('/admin')"
              class="inline-flex items-center justify-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-6 py-3.5 rounded-2xl font-extrabold transition-colors"
            >
              <Shield class="w-5 h-5" />
              运维后台
            </button>
            <button
              v-if="hasCapability('dev_panel_access')"
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
              @click="handleLogout"
              class="inline-flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-6 py-3.5 rounded-2xl font-extrabold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              <LogOut class="w-5 h-5" />
              退出登录
            </button>
          </div>
        </div>
      </div>
    </main>

    <!-- Avatar Cropper Modal -->
    <ImageCropper
      v-if="showCropper && cropperImageSrc"
      :imageSrc="cropperImageSrc"
      :aspectRatio="1"
      :outputWidth="512"
      :outputHeight="512"
      title="裁剪头像"
      @confirm="handleCropConfirm"
      @cancel="handleCropCancel"
    />
  </div>
</template>
