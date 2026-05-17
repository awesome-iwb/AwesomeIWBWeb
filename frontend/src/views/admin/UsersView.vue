<template>
  <div class="h-full min-h-0">
  <ui-ListDetailLayout
    :selected-id="selectedUserId"
    :selected-item-label="userDraft?.name"
    :selected-item-icon="UsersIcon"
    list-title="用户列表"
    detail-title="用户详情"
    :searchable="false"
    :infinite="true"
    :has-more="usersHasMore"
    :loading-more="usersLoadingMore"
    @load-more="loadMoreUsers"
    @back="selectedUserId = null; userDraft = null"
  >
    <template #list-toolbar>
      <div class="space-y-3">
        <div class="flex justify-end">
          <button @click="showCreateUserForm = !showCreateUserForm" class="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold transition-colors">创建用户</button>
        </div>
        <input v-model="userQuery.q" @keyup.enter="resetAndFetchUsers" type="text" class="w-full px-3 py-3 lg:py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-emerald-500 text-base lg:text-sm" placeholder="搜索（用户名/邮箱/STCN ID）" />
        <select v-model="userQuery.role" @change="resetAndFetchUsers" class="w-full px-3 py-3 lg:py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-emerald-500 text-base lg:text-sm">
          <option value="">全部角色</option>
          <option value="user">普通用户</option>
          <option value="dev">开发者</option>
          <option value="editor">编者</option>
          <option value="ops">运维</option>
        </select>
        <button @click="resetAndFetchUsers()" class="w-full px-3 py-3 lg:py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-base lg:text-sm font-bold transition-colors">刷新</button>

        <div v-if="showCreateUserForm" class="p-4 rounded-2xl border border-slate-100 dark:border-slate-700 bg-slate-100 dark:bg-slate-900/80 space-y-3">
          <input v-model="newUserName" type="text" class="w-full px-3 py-3 lg:py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-emerald-500 text-base lg:text-sm" placeholder="用户名（必填）" />
          <input v-model="newUserPassword" type="password" class="w-full px-3 py-3 lg:py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-emerald-500 text-base lg:text-sm" placeholder="留空则仅支持第三方登录" />
          <input v-model="newUserEmail" type="email" class="w-full px-3 py-3 lg:py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-emerald-500 text-base lg:text-sm" placeholder="邮箱（选填）" />
          <div class="flex gap-2">
            <button @click="createUser" :disabled="creatingUser || !newUserName.trim()" class="flex-1 px-3 py-3 lg:py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-base lg:text-sm font-bold transition-colors">{{ creatingUser ? '创建中...' : '创建' }}</button>
            <button @click="showCreateUserForm = false; newUserName = ''; newUserPassword = ''; newUserEmail = ''" class="px-3 py-3 lg:py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-base lg:text-sm font-bold hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors">取消</button>
          </div>
        </div>

      </div>
    </template>

    <template #list>
      <div v-if="usersLoading && usersPage.items.length === 0" class="py-10 flex justify-center">
        <ui-LoadingSpinner brand="admin" />
      </div>
      <div v-else class="space-y-2">
        <div
          v-for="u in usersPage.items"
          :key="u.id"
          @click="selectUser(u)"
          class="p-3 rounded-xl border cursor-pointer transition-all duration-200 flex items-center gap-3"
          :class="selectedUserId === u.id ? 'bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-500/20' : 'bg-slate-50 dark:bg-slate-900/50 border-transparent hover:border-emerald-300'"
        >
          <div class="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold overflow-hidden">
            <img v-if="u.avatar_url" :src="u.avatar_url" class="w-full h-full object-cover" />
            <span v-else :class="selectedUserId === u.id ? 'text-white' : 'text-slate-500'">{{ (u.name || '?').charAt(0) }}</span>
          </div>
          <div class="flex-1 min-w-0">
            <div class="font-medium truncate text-sm">{{ u.name }}</div>
            <div class="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <span
                class="inline-flex px-1.5 py-0.5 rounded-md text-[10px] font-bold leading-none"
                :class="selectedUserId === u.id ? 'bg-white/20 text-white' : displayRoleBadgeClass(u.display_role || u.role)"
              >{{ u.role_label || displayRoleLabel(u.display_role || u.role) }}</span>
              <span v-if="!u.is_active" class="text-[10px] opacity-80">已禁用</span>
            </div>
          </div>
        </div>
        <ui-EmptyState v-if="usersPage.items.length === 0" :icon="UsersIcon" title="暂无用户" />
      </div>
    </template>

    <template #detail>
      <div v-if="userDraft" class="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col">
        <div class="p-4 lg:p-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
          <h2 class="text-lg lg:text-xl font-bold text-slate-800 dark:text-white">用户详情</h2>
        </div>
        <div class="flex-1 min-h-0 overflow-y-auto p-4 lg:p-8 space-y-4 lg:space-y-6">
          <div class="flex items-center gap-4">
            <div class="w-16 h-16 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
              <img v-if="userDraft.avatar_url" :src="userDraft.avatar_url" class="w-full h-full object-cover" />
              <div v-else class="w-full h-full flex items-center justify-center text-xl font-bold text-slate-500">{{ (userDraft.name || '?').charAt(0) }}</div>
            </div>
            <div>
              <div class="flex items-center gap-2">
                <div class="text-lg font-extrabold text-slate-900 dark:text-white">{{ userDraft.name }}</div>
                <button v-if="!showRenameForm" @click="showRenameForm = true; renameValue = userDraft.name; renameError = ''" class="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"/></svg>
                </button>
              </div>
              <div v-if="showRenameForm" class="mt-2 space-y-2">
                <input v-model="renameValue" class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-emerald-500 text-sm" placeholder="输入新用户名" @keyup.enter="submitAdminRename" />
                <div v-if="renameError" class="text-xs text-rose-600 dark:text-rose-400">{{ renameError }}</div>
                <div class="flex gap-2">
                  <button @click="submitAdminRename" :disabled="isRenaming" class="flex-1 px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-bold transition-colors">{{ isRenaming ? '修改中...' : '确认' }}</button>
                  <button @click="showRenameForm = false; renameValue = ''; renameError = ''" class="px-3 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-bold hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors">取消</button>
                </div>
              </div>
              <div class="text-sm text-slate-500 dark:text-slate-400">{{ userDraft.email || '无邮箱' }}</div>
            </div>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
            <div class="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
              <div class="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">用户 ID</div>
              <div class="text-sm text-slate-900 dark:text-white font-mono">{{ userDraft.id }}</div>
            </div>
            <div class="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
              <div class="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Casdoor ID</div>
              <div class="text-sm text-slate-900 dark:text-white font-mono">{{ userDraft.casdoor_id || '-' }}</div>
            </div>
            <div class="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
              <div class="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">STCN 用户 ID</div>
              <div class="text-sm text-slate-900 dark:text-white font-mono">{{ userDraft.stcn_user_id || '-' }}</div>
            </div>
            <div class="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
              <div class="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">HZZC 用户 ID</div>
              <div class="text-sm text-slate-900 dark:text-white font-mono">{{ userDraft.hzzc_user_id || '-' }}</div>
            </div>
            <div class="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
              <div class="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">注册时间</div>
              <div class="text-sm text-slate-900 dark:text-white">{{ formatDateTime(userDraft.created_at) }}</div>
            </div>
            <div class="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
              <div class="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">最后登录</div>
              <div class="text-sm text-slate-900 dark:text-white">{{ userDraft.last_login_at ? formatDateTime(userDraft.last_login_at) : '从未登录' }}</div>
            </div>
          </div>

          <div class="p-4 lg:p-6 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 space-y-4">
            <div class="text-sm font-extrabold text-slate-800 dark:text-slate-200">权限管理</div>

            <div v-if="userDraftIsSuperadmin" class="p-4 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30">
              <div class="flex items-center gap-2">
                <svg class="w-5 h-5 text-amber-500" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                <span class="text-sm font-bold text-amber-700 dark:text-amber-300">超级管理员</span>
              </div>
              <div class="text-xs text-amber-600 dark:text-amber-400 mt-1">此用户拥有所有权限，不可修改</div>
            </div>

            <div v-if="!userDraftIsSuperadmin" class="space-y-3">
              <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                  <div class="text-sm font-bold text-slate-700 dark:text-slate-300">当前角色</div>
                  <div class="text-xs text-slate-500 dark:text-slate-400">根据能力自动推断</div>
                </div>
                <span
                  class="inline-flex items-center px-4 py-2 rounded-xl text-sm font-bold"
                  :class="inferredRoleTagClass"
                >{{ inferredRoleLabel }}</span>
              </div>

              <div class="h-px bg-slate-200 dark:bg-slate-700"></div>

              <div>
                <div class="flex items-center justify-between mb-3">
                  <div>
                    <div class="text-sm font-bold text-slate-700 dark:text-slate-300">细粒度权限</div>
                    <div class="text-xs text-slate-500 dark:text-slate-400">为用户精确分配操作能力</div>
                  </div>
                </div>
                <CapabilityEditor
                  v-model="userDraftCapabilities"
                  :all-capabilities="allCapabilitiesList"
                  :templates="roleTemplates"
                  :disabled="userDraftIsSuperadmin"
                />
                <div class="flex justify-end mt-3">
                  <button
                    @click="saveCapabilities"
                    :disabled="savingCapabilities"
                    class="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm transition-colors"
                  >
                    {{ savingCapabilities ? '保存中...' : '保存权限' }}
                  </button>
                </div>
              </div>
            </div>

            <div class="h-px bg-slate-200 dark:border-slate-700"></div>

            <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <div class="text-sm font-bold text-slate-700 dark:text-slate-300">账号状态</div>
                <div class="text-xs text-slate-500 dark:text-slate-400">禁用后用户将无法登录</div>
              </div>
              <div class="flex gap-2">
                <button
                  @click="updateUserActive(!userDraft.is_active)"
                  class="px-4 py-3 lg:py-2 rounded-xl font-bold transition-colors"
                  :class="userDraft.is_active ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300' : 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300'"
                >
                  {{ userDraft.is_active ? '已启用' : '已禁用' }}
                </button>
                <button
                  @click="showResetPassword = !showResetPassword"
                  class="px-4 py-3 lg:py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold transition-colors"
                >
                  重置密码
                </button>
              </div>
            </div>

            <div v-if="showResetPassword" class="space-y-3">
              <input v-model="resetPasswordValue" type="password" class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-emerald-500 text-base" placeholder="输入新密码" />
              <div class="flex gap-2">
                <button @click="resetPassword" :disabled="resettingPassword || !resetPasswordValue" class="flex-1 px-4 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold transition-colors">{{ resettingPassword ? '重置中...' : '确认重置' }}</button>
                <button @click="showResetPassword = false; resetPasswordValue = ''" class="px-4 py-3 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors">取消</button>
              </div>
            </div>
          </div>

          <div class="p-4 lg:p-6 rounded-2xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 space-y-4">
            <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <div class="text-sm font-extrabold text-rose-700 dark:text-rose-300">危险操作</div>
                <div class="text-xs text-rose-500 dark:text-rose-400">删除用户后数据不可恢复</div>
              </div>
              <button
                @click="deleteUser"
                :disabled="deletingUser"
                class="px-4 py-3 lg:py-2 rounded-xl bg-rose-500 hover:bg-rose-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold transition-colors"
              >
                {{ deletingUser ? '删除中...' : '删除用户' }}
              </button>
            </div>
          </div>
        </div>
      </div>

    </template>

    <template #empty-detail>
      <div class="flex items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl min-h-[400px]">
        <p class="text-slate-400">点击左侧列表选择用户</p>
      </div>
    </template>
  </ui-ListDetailLayout>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { adminFetch, formatAdminError, formatDateTime } from '../../composables/useAdminFetch';
import { useAuth } from '../../composables/useAuth';
import CapabilityEditor from '../../components/admin/CapabilityEditor.vue';
import { ListDetailLayout as uiListDetailLayout, EmptyState as uiEmptyState, LoadingSpinner as uiLoadingSpinner } from '../../components/ui';
import { Users as UsersIcon } from 'lucide-vue-next';
import {
  inferDisplayRole,
  displayRoleLabel,
  displayRoleBadgeClass,
} from '../../utils/displayRole';

type Capability = { id: string; name: string; category: string; description: string };
type RoleTemplate = { name: string; capabilityIds: string[] };

const { user: _currentUser } = useAuth();

const userQuery = ref({ q: '', role: '', page: 1, pageSize: 30 });
const usersPage = ref<{ items: any[]; page: number; pageSize: number; total: number }>({ items: [], page: 1, pageSize: 30, total: 0 });
const usersLoading = ref(true);
const usersLoadingMore = ref(false);
const usersHasMore = computed(() => usersPage.value.items.length < usersPage.value.total);

const selectedUserId = ref<string | null>(null);
const userDraft = ref<any>(null);
const userDraftCapabilities = ref<string[]>([]);
const userDraftIsSuperadmin = ref(false);
const savingCapabilities = ref(false);

const showCreateUserForm = ref(false);
const newUserName = ref('');
const newUserPassword = ref('');
const newUserEmail = ref('');
const creatingUser = ref(false);

const showResetPassword = ref(false);
const resetPasswordValue = ref('');
const resettingPassword = ref(false);

const deletingUser = ref(false);

const showRenameForm = ref(false);
const renameValue = ref('');
const renameError = ref('');
const isRenaming = ref(false);

const submitAdminRename = async () => {
  if (!userDraft.value?.id || !renameValue.value.trim()) return;
  isRenaming.value = true;
  renameError.value = '';
  try {
    const res = await adminFetch(`/api/admin/users/${userDraft.value.id}/name`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: renameValue.value.trim() }),
    });
    const json = await res.json();
    if (!res.ok) {
      renameError.value = formatAdminError(json, '修改失败', res.status);
      return;
    }
    userDraft.value = { ...userDraft.value, name: renameValue.value.trim() };
    showRenameForm.value = false;
    renameValue.value = '';
    await fetchUsers();
  } catch (e: unknown) {
    renameError.value = formatAdminError({ message: e instanceof Error ? e.message : '' }, '修改失败');
  } finally {
    isRenaming.value = false;
  }
};

const allCapabilitiesList = ref<Capability[]>([]);
const roleTemplates = ref<Record<string, RoleTemplate>>({});

const inferredDisplayRole = computed(() =>
  inferDisplayRole(userDraftCapabilities.value, { isSuperadmin: userDraftIsSuperadmin.value }),
);

const inferredRoleLabel = computed(() => displayRoleLabel(inferredDisplayRole.value));

const inferredRoleTagClass = computed(() => {
  const base = displayRoleBadgeClass(inferredDisplayRole.value);
  return `${base} border px-4 py-2 ${
    inferredDisplayRole.value === 'user'
      ? 'border-slate-200 dark:border-slate-600'
      : inferredDisplayRole.value === 'superadmin'
        ? 'border-amber-300 dark:border-amber-500/40'
        : inferredDisplayRole.value === 'ops'
          ? 'border-purple-300 dark:border-purple-500/40'
          : inferredDisplayRole.value === 'editor'
            ? 'border-orange-300 dark:border-orange-500/40'
            : 'border-blue-300 dark:border-blue-500/40'
  }`;
});

const fetchUsers = async (append = false) => {
  if (append) usersLoadingMore.value = true;
  else usersLoading.value = true;
  try {
    const qs = new URLSearchParams();
    if (userQuery.value.q) qs.set('q', userQuery.value.q);
    if (userQuery.value.role) qs.set('role', userQuery.value.role);
    qs.set('page', String(userQuery.value.page));
    qs.set('pageSize', String(userQuery.value.pageSize));
    const res = await adminFetch(`/api/admin/users?${qs.toString()}`);
    if (!res.ok) return;
    const json = await res.json();
    const incoming = Array.isArray(json.items) ? json.items : [];
    usersPage.value = {
      items: append ? [...usersPage.value.items, ...incoming] : incoming,
      page: Number(json.page ?? userQuery.value.page ?? 1),
      pageSize: Number(json.pageSize ?? userQuery.value.pageSize ?? 30),
      total: Number(json.total ?? (append ? usersPage.value.items.length : incoming.length) ?? 0),
    };

    const hasSelected = !!selectedUserId.value;
    const selectedStillExists = hasSelected
      && usersPage.value.items.some((item: any) => item.id === selectedUserId.value);

    if (hasSelected && !selectedStillExists) {
      selectedUserId.value = null;
      userDraft.value = null;
      userDraftCapabilities.value = [];
      userDraftIsSuperadmin.value = false;
      showResetPassword.value = false;
      resetPasswordValue.value = '';
      showRenameForm.value = false;
      renameValue.value = '';
      renameError.value = '';
    }
  } catch {} finally {
    usersLoading.value = false;
    usersLoadingMore.value = false;
  }
};

const resetAndFetchUsers = async () => {
  userQuery.value.page = 1;
  usersPage.value = { items: [], page: 1, pageSize: userQuery.value.pageSize, total: 0 };
  await fetchUsers(false);
};

const loadMoreUsers = async () => {
  if (usersLoadingMore.value || usersLoading.value || !usersHasMore.value) return;
  userQuery.value.page += 1;
  await fetchUsers(true);
};

const selectUser = async (u: any) => {
  selectedUserId.value = u.id;
  userDraft.value = { ...u };
  userDraftCapabilities.value = [];
  userDraftIsSuperadmin.value = false;
  showResetPassword.value = false;
  resetPasswordValue.value = '';
  showRenameForm.value = false;
  renameValue.value = '';
  renameError.value = '';
  try {
    const res = await adminFetch(`/api/admin/users/${u.id}/capabilities`);
    if (res.ok) {
      const json = await res.json();
      userDraftCapabilities.value = json.capabilities ?? [];
      userDraftIsSuperadmin.value = json.is_superadmin ?? false;
    }
  } catch {}
};


const updateUserActive = async (isActive: boolean) => {
  if (!userDraft.value?.id) return;
  const res = await adminFetch(`/api/admin/users/${userDraft.value.id}/active`, {
    method: 'PATCH',
    body: JSON.stringify({ is_active: isActive })
  });
  const json = await res.json();
  if (!res.ok) {
    alert(formatAdminError(json, '更新失败', res.status));
    return;
  }
  userDraft.value = { ...userDraft.value, is_active: isActive };
  await fetchUsers();
  alert(isActive ? '账号已启用' : '账号已禁用');
};

const createUser = async () => {
  if (!newUserName.value.trim()) return;
  creatingUser.value = true;
  try {
    const res = await adminFetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newUserName.value.trim(),
        password: newUserPassword.value || undefined,
        email: newUserEmail.value || undefined,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      alert(formatAdminError(json, '创建失败', res.status));
      return;
    }
    showCreateUserForm.value = false;
    newUserName.value = '';
    newUserPassword.value = '';
    newUserEmail.value = '';
    await fetchUsers();
    if (json.id) {
      selectUser(json);
    }
  } catch (e: unknown) {
    alert(formatAdminError({ message: e instanceof Error ? e.message : '' }, '创建失败'));
  } finally {
    creatingUser.value = false;
  }
};

const resetPassword = async () => {
  if (!userDraft.value?.id || !resetPasswordValue.value) return;
  resettingPassword.value = true;
  try {
    const res = await adminFetch(`/api/admin/users/${userDraft.value.id}/password`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: resetPasswordValue.value }),
    });
    const json = await res.json();
    if (!res.ok) {
      alert(formatAdminError(json, '重置失败', res.status));
      return;
    }
    alert('密码已重置');
    showResetPassword.value = false;
    resetPasswordValue.value = '';
  } catch (e: unknown) {
    alert(formatAdminError({ message: e instanceof Error ? e.message : '' }, '重置失败'));
  } finally {
    resettingPassword.value = false;
  }
};

const deleteUser = async () => {
  if (!userDraft.value?.id) return;
  const ok = confirm(`确认删除用户 ${userDraft.value.name}？此操作不可撤销！`);
  if (!ok) return;
  deletingUser.value = true;
  try {
    const res = await adminFetch(`/api/admin/users/${userDraft.value.id}`, {
      method: 'DELETE',
    });
    const json = await res.json();
    if (!res.ok) {
      alert(formatAdminError(json, '删除失败', res.status));
      return;
    }
    userDraft.value = null;
    selectedUserId.value = null;
    await fetchUsers();
  } catch (e: unknown) {
    alert(formatAdminError({ message: e instanceof Error ? e.message : '' }, '删除失败'));
  } finally {
    deletingUser.value = false;
  }
};

const fetchCapabilities = async () => {
  try {
    const res = await adminFetch('/api/capabilities');
    if (res.ok) {
      const json = await res.json();
      allCapabilitiesList.value = json.capabilities ?? [];
    }
  } catch {}
};

const normalizeRoleTemplates = (json: unknown): Record<string, RoleTemplate> => {
  if (!json || typeof json !== 'object') return {};
  const payload = json as Record<string, unknown>;
  if (payload.templates && typeof payload.templates === 'object') {
    return payload.templates as Record<string, RoleTemplate>;
  }
  const legacyKeys = ['user', 'developer', 'editor', 'ops'] as const;
  if (legacyKeys.some((key) => {
    const tpl = payload[key];
    return tpl && typeof tpl === 'object' && typeof (tpl as RoleTemplate).name === 'string';
  })) {
    return payload as Record<string, RoleTemplate>;
  }
  return {};
};

const fetchRoleTemplates = async () => {
  try {
    const res = await adminFetch('/api/admin/role-templates');
    if (res.ok) {
      const json = await res.json();
      roleTemplates.value = normalizeRoleTemplates(json);
    }
  } catch {}
};

const saveCapabilities = async () => {
  if (!userDraft.value?.id) return;
  savingCapabilities.value = true;
  try {
    const res = await adminFetch(`/api/admin/users/${userDraft.value.id}/capabilities`, {
      method: 'PUT',
      body: JSON.stringify({ capabilities: userDraftCapabilities.value })
    });
    const json = await res.json();
    if (!res.ok) {
      alert(formatAdminError(json, '保存失败', res.status));
      return;
    }
    alert('权限保存成功');
  } catch (e: unknown) {
    alert(formatAdminError({ message: e instanceof Error ? e.message : '' }, '保存失败'));
  } finally {
    savingCapabilities.value = false;
  }
};

onMounted(() => {
  fetchUsers();
  fetchCapabilities();
  fetchRoleTemplates();
});
</script>
