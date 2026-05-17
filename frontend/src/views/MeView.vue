<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useHead } from '@unhead/vue';
import { Github, LogIn, LogOut, Shield, Wrench, AlertCircle, Camera, Pencil } from 'lucide-vue-next';
import { useAuth, getAvatarDisplaySrc } from '../composables/useAuth';
import { useApi } from '../composables/useApi';
import { API } from '../api/endpoints';
import ImageCropper from '../components/ImageCropper.vue';
import { inferDisplayRole, displayRoleLabel } from '../utils/displayRole';

useHead({
  title: '个人中心 - Awesome IWB',
  meta: [
    { name: 'description', content: '管理你的 Awesome IWB 账户、查看收藏项目和提交历史。' }
  ]
});

const router = useRouter();
const route = useRoute();
const { user, isAuthenticated, logout, getCasdoorAuthorizeUrl, uploadAvatar, hasCapability, fetchUser, setAvatarSource } = useAuth();
const { apiFetch } = useApi();

const redirectTo = computed(() => {
  const q = route.query.redirect;
  return typeof q === 'string' && q ? q : '/';
});

const roleLabel = computed(() => {
  if (!user.value) return '';
  const caps = user.value.capabilities ?? [];
  const role = inferDisplayRole(caps, { isSuperadmin: user.value.is_superadmin });
  return displayRoleLabel(role);
});

const goNext = () => router.push(redirectTo.value);

const isLoggingIn = ref(false);
const loginError = ref('');
const logoutError = ref('');
const popupStatus = ref('');

const isUploadingAvatar = ref(false);
const avatarUploadError = ref('');
const fileInputRef = ref<HTMLInputElement | null>(null);

const pendingAvatarSource = ref<'casdoor' | 'upload'>('casdoor');
const savingAvatarSource = ref(false);
const avatarSourceError = ref('');

watch(
  user,
  (u) => {
    if (!u) return;
    pendingAvatarSource.value = u.avatar_source === 'upload' ? 'upload' : 'casdoor';
  },
  { immediate: true }
);

const saveAvatarSourcePref = async () => {
  if (!user.value) return;
  const currentIsUpload = user.value.avatar_source === 'upload';
  const pendingIsUpload = pendingAvatarSource.value === 'upload';
  if (currentIsUpload === pendingIsUpload) {
    avatarSourceError.value = '';
    return;
  }
  savingAvatarSource.value = true;
  avatarSourceError.value = '';
  const r = await setAvatarSource(pendingAvatarSource.value);
  savingAvatarSource.value = false;
  if (!r.ok) {
    avatarSourceError.value = r.message;
    return;
  }
  avatarSourceError.value = '';
};

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

const showRenameForm = ref(false);
const renameValue = ref('');
const isRenaming = ref(false);
const renameError = ref('');

const startRename = () => {
  renameValue.value = user.value?.name ?? '';
  renameError.value = '';
  showRenameForm.value = true;
};

const cancelRename = () => {
  showRenameForm.value = false;
  renameValue.value = '';
  renameError.value = '';
};

const submitRename = async () => {
  const newName = renameValue.value.trim();
  if (!newName) {
    renameError.value = '用户名不能为空';
    return;
  }
  isRenaming.value = true;
  renameError.value = '';
  try {
    const res = await apiFetch(API.auth.userRename, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName }),
    });
    const json = await res.json();
    if (!res.ok) {
      renameError.value = json?.error ?? json?.message ?? '修改失败';
      return;
    }
    showRenameForm.value = false;
    renameValue.value = '';
    await fetchUser();
  } catch (e: any) {
    renameError.value = e?.message ?? '修改失败';
  } finally {
    isRenaming.value = false;
  }
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
              <img v-if="user" :src="getAvatarDisplaySrc(user)" class="h-full w-full object-cover" />
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
            <div class="space-y-3 border-t border-slate-200/80 dark:border-slate-800/80 pt-3">
              <div class="text-sm font-semibold text-slate-700 dark:text-slate-200">头像显示偏好</div>
              <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                选择使用智教联盟（OAuth）同步的头像，或本站图床上传的自定义头像；保存后刷新或换设备仍会保持你的选择。
              </p>
              <div class="space-y-2">
                <label class="flex items-start gap-3 cursor-pointer group">
                  <input
                    v-model="pendingAvatarSource"
                    type="radio"
                    value="casdoor"
                    class="mt-1 h-4 w-4 text-emerald-600 border-slate-300 focus:ring-emerald-500"
                  />
                  <span class="text-sm text-slate-700 dark:text-slate-200 group-hover:text-emerald-700 dark:group-hover:text-emerald-300">使用智教联盟同步头像</span>
                </label>
                <label class="flex items-start gap-3 cursor-pointer group">
                  <input
                    v-model="pendingAvatarSource"
                    type="radio"
                    value="upload"
                    class="mt-1 h-4 w-4 text-emerald-600 border-slate-300 focus:ring-emerald-500"
                  />
                  <span class="text-sm text-slate-700 dark:text-slate-200 group-hover:text-emerald-700 dark:group-hover:text-emerald-300">使用本站图床上传头像</span>
                </label>
              </div>
              <div v-if="avatarSourceError" class="text-sm text-rose-600 dark:text-rose-400">{{ avatarSourceError }}</div>
              <button
                type="button"
                @click="saveAvatarSourcePref"
                :disabled="savingAvatarSource"
                class="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold transition-colors"
              >
                <span v-if="savingAvatarSource" class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {{ savingAvatarSource ? '保存中...' : '保存头像偏好' }}
              </button>
            </div>
            <div v-if="hasCapability('user:rename')" class="flex items-center justify-between">
              <span class="text-sm text-slate-500 dark:text-slate-400">用户名</span>
              <div v-if="!showRenameForm" class="flex items-center gap-2">
                <span class="text-sm font-medium text-slate-700 dark:text-slate-200">{{ user?.name }}</span>
                <button @click="startRename" class="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400">
                  <Pencil class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div v-if="showRenameForm" class="space-y-3 pt-1">
              <div class="text-xs text-slate-500 dark:text-slate-400">2-30 位中文、英文、数字、下划线、连字符，30天内只能修改一次</div>
              <input
                v-model="renameValue"
                class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-emerald-500 text-base"
                placeholder="输入新用户名"
                @keyup.enter="submitRename"
              />
              <div v-if="renameError" class="text-sm text-rose-600 dark:text-rose-400">{{ renameError }}</div>
              <div class="flex gap-2">
                <button @click="submitRename" :disabled="isRenaming" class="flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm transition-colors">{{ isRenaming ? '修改中...' : '确认修改' }}</button>
                <button @click="cancelRename" class="px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-sm hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors">取消</button>
              </div>
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
