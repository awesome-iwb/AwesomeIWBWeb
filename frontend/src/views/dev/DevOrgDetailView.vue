<template>
  <div class="space-y-4">
    <ui-LoadingSpinner v-if="loading" brand="dev" />

    <template v-else-if="org">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <ui-Avatar :src="org.avatar_url" :name="org.name" size="md" rounded="default" />
          <div>
            <h2 class="text-lg font-bold text-slate-900 dark:text-white">{{ org.name }}</h2>
            <div class="text-xs text-slate-400">{{ org.slug }}</div>
          </div>
          <ui-StatusBadge :status="org.status" :label="orgStatusLabel(org.status)" />
        </div>
        <button v-if="org.is_admin && hasCapability('dev:org_manage')" @click="saveOrg" :disabled="isSaving" class="px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50">
          {{ isSaving ? '保存中...' : '保存修改' }}
        </button>
      </div>

      <div v-if="org.is_admin && hasCapability('dev:org_manage')" class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div class="p-4 lg:p-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
          <h3 class="font-bold text-sm text-slate-700 dark:text-slate-300">组织信息</h3>
        </div>
        <div class="p-4 lg:p-6 space-y-4">
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">组织名称</label>
              <input type="text" v-model="draft.name" class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:border-blue-500 text-base" />
            </div>
            <div>
              <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">网站</label>
              <input type="text" v-model="draft.website_url" class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:border-blue-500 text-base" />
            </div>
          </div>
          <div>
            <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">组织头像</label>
            <div class="flex flex-col sm:flex-row gap-3 sm:items-center">
              <div class="w-16 h-16 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden flex items-center justify-center shrink-0">
                <img v-if="draft.avatar_url" :src="draft.avatar_url" class="w-full h-full object-cover" alt="组织头像" />
                <span v-else class="text-xs text-slate-400">无头像</span>
              </div>
              <div class="flex-1 min-w-0 space-y-2">
                <div class="flex gap-2 flex-wrap">
                  <button type="button" @click="triggerAvatarUpload" :disabled="isUploadingAvatar" class="px-3 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-xs font-bold transition-colors">
                    {{ isUploadingAvatar ? '上传中...' : '上传头像' }}
                  </button>
                  <button type="button" @click="clearAvatar" :disabled="isUploadingAvatar || !draft.avatar_url" class="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors">
                    清空头像
                  </button>
                  <input ref="avatarInputRef" type="file" accept="image/*" class="hidden" @change="onAvatarFile" />
                </div>
                <input type="text" v-model="draft.avatar_url" @input="draft.avatar_url = normalizeMediaUrl(draft.avatar_url)" class="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:border-blue-500 text-sm" placeholder="请上传并使用站内地址（/api/uploads/...）" />
                <div v-if="avatarUploadError" class="text-xs text-rose-500">{{ avatarUploadError }}</div>
              </div>
            </div>
          </div>
          <div>
            <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">描述</label>
            <textarea v-model="draft.description" rows="3" class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:border-blue-500 resize-none text-base"></textarea>
          </div>
        </div>
      </div>

      <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div class="p-4 lg:p-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
          <h3 class="font-bold text-sm text-slate-700 dark:text-slate-300">组织成员</h3>
          <button v-if="org.is_admin && hasCapability('dev:org_manage')" @click="showInviteMember = true" class="px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold transition-colors">
            邀请成员
          </button>
        </div>
        <div class="p-4 lg:p-6">
          <div class="space-y-2">
            <div v-for="m in members" :key="m.user_id" class="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50">
              <ui-Avatar :name="m.user_name" size="sm" />
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium truncate text-slate-900 dark:text-white">{{ m.user_name || '未知' }}</div>
              </div>
              <span class="text-[10px] px-1.5 py-0.5 rounded font-medium" :class="m.role === 'owner' ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400' : m.role === 'admin' ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'">
                {{ m.role === 'owner' ? '所有者' : m.role === 'admin' ? '管理员' : '成员' }}
              </span>
              <select
                v-if="org.is_admin && hasCapability('dev:org_manage') && m.role !== 'owner'"
                :value="m.role"
                @change="changeMemberRole(m.user_id, ($event.target as HTMLSelectElement).value)"
                class="text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none"
              >
                <option value="admin">管理员</option>
                <option value="member">成员</option>
              </select>
              <button
                v-if="org.is_admin && hasCapability('dev:org_manage') && m.role !== 'owner'"
                @click="removeMember(m.user_id)"
                class="text-xs px-2 py-1 rounded-lg bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 font-medium hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors"
              >
                移除
              </button>
            </div>
            <div v-if="members.length === 0" class="text-sm text-slate-400 text-center py-6">暂无成员</div>
          </div>
        </div>
      </div>
    </template>

    <div v-else class="text-center py-20 text-slate-400">
      <p class="text-sm">组织不存在或无权访问</p>
    </div>

    <div v-if="showInviteMember" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div class="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden">
        <div class="p-6 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <div class="text-xl font-extrabold text-slate-900 dark:text-white">邀请成员</div>
          <button @click="showInviteMember = false" class="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-500">✕</button>
        </div>
        <div class="p-6 space-y-4">
          <div>
            <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">用户 ID</label>
            <input type="text" v-model="inviteUserId" class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:border-blue-500 text-base" placeholder="输入用户 ID" />
          </div>
          <div>
            <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">角色</label>
            <select v-model="inviteRole" class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:border-blue-500 text-base">
              <option value="member">成员</option>
              <option value="admin">管理员</option>
            </select>
          </div>
          <div class="flex gap-3">
            <button @click="inviteMember" :disabled="isInviting" class="flex-1 px-4 py-3 rounded-2xl bg-blue-500 hover:bg-blue-600 text-white font-bold transition-colors disabled:opacity-50">
              {{ isInviting ? '邀请中...' : '邀请' }}
            </button>
            <button @click="showInviteMember = false" class="flex-1 px-4 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
              取消
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { adminFetch, formatAdminError, uploadFile, normalizeMediaUrl } from '../../composables/useAdminFetch';
import { API } from '../../api/endpoints';
import { useAuth } from '../../composables/useAuth';
import { LoadingSpinner as uiLoadingSpinner, StatusBadge as uiStatusBadge, Avatar as uiAvatar } from '../../components/ui';

const route = useRoute();
const { hasCapability } = useAuth();
const orgId = route.params.id as string;

const org = ref<any | null>(null);
const draft = ref<any>({});
const members = ref<any[]>([]);
const loading = ref(true);
const isSaving = ref(false);

const orgStatusLabel = (s: string) => {
  if (s === 'pending') return '审核中';
  if (s === 'suspended') return '已暂停';
  return undefined;
};
const showInviteMember = ref(false);
const inviteUserId = ref('');
const inviteRole = ref('member');
const isInviting = ref(false);
const avatarInputRef = ref<HTMLInputElement | null>(null);
const avatarUploadError = ref('');
const isUploadingAvatar = ref(false);

const fetchOrg = async () => {
  loading.value = true;
  try {
    const res = await adminFetch(API.dev.organizationDetail(orgId));
    if (res.ok) {
      const json = await res.json();
      org.value = json;
      draft.value = {
        name: json.name,
        description: json.description,
        website_url: json.website_url,
        avatar_url: json.avatar_url,
      };
      members.value = json.members ?? [];
    }
  } catch (e) {
    console.error('Fetch dev org detail error:', e);
  } finally {
    loading.value = false;
  }
};

const saveOrg = async () => {
  isSaving.value = true;
  try {
    const res = await adminFetch(API.dev.organizationDetail(orgId), {
      method: 'PATCH',
      body: JSON.stringify(draft.value),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(formatAdminError(json, '保存失败', res.status));
    org.value = { ...org.value, ...json };
    draft.value = {
      name: json.name,
      description: json.description,
      website_url: json.website_url,
      avatar_url: json.avatar_url,
    };
    avatarUploadError.value = '';
  } catch (e: unknown) {
    alert(formatAdminError({ message: e instanceof Error ? e.message : '' }, '保存失败'));
  } finally {
    isSaving.value = false;
  }
};

const onAvatarFile = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  avatarUploadError.value = '';
  isUploadingAvatar.value = true;
  try {
    draft.value.avatar_url = await uploadFile(file);
  } catch (err: unknown) {
    avatarUploadError.value = err instanceof Error ? err.message : '头像上传失败';
  } finally {
    isUploadingAvatar.value = false;
  }
};

const triggerAvatarUpload = () => {
  avatarInputRef.value?.click();
};

const clearAvatar = () => {
  draft.value.avatar_url = '';
  avatarUploadError.value = '';
};

const inviteMember = async () => {
  if (!inviteUserId.value.trim()) return;
  isInviting.value = true;
  try {
    const res = await adminFetch(API.dev.organizationMembers(orgId), {
      method: 'POST',
      body: JSON.stringify({ user_id: inviteUserId.value.trim(), role: inviteRole.value }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(formatAdminError(json, '邀请失败', res.status));
    showInviteMember.value = false;
    inviteUserId.value = '';
    inviteRole.value = 'member';
    await fetchOrg();
  } catch (e: unknown) {
    alert(formatAdminError({ message: e instanceof Error ? e.message : '' }, '邀请失败'));
  } finally {
    isInviting.value = false;
  }
};

const removeMember = async (userId: string) => {
  if (!confirm('确认移除该成员？')) return;
  try {
    const res = await adminFetch(`${API.dev.organizationMembers(orgId)}/${encodeURIComponent(userId)}`, { method: 'DELETE' });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(formatAdminError(json, '移除失败', res.status));
    }
    await fetchOrg();
  } catch (e: unknown) {
    alert(formatAdminError({ message: e instanceof Error ? e.message : '' }, '移除失败'));
  }
};

const changeMemberRole = async (userId: string, role: string) => {
  try {
    const res = await adminFetch(`${API.dev.organizationMembers(orgId)}/${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(formatAdminError(json, '修改角色失败', res.status));
    await fetchOrg();
  } catch (e: unknown) {
    alert(formatAdminError({ message: e instanceof Error ? e.message : '' }, '修改角色失败'));
  }
};

onMounted(fetchOrg);
</script>
