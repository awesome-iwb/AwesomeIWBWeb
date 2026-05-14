<template>
  <div class="grid grid-cols-1 lg:grid-cols-4 gap-4 lg:gap-8">
    <div class="lg:col-span-1 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col" :class="{ 'hidden lg:flex': isMobile && mobileView === 'detail' }" style="height: auto; min-height: 400px; max-height: 700px;">
      <div class="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center">
        <h2 class="font-bold text-lg">用户列表</h2>
        <button @click="showCreateUserForm = !showCreateUserForm" class="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold transition-colors">创建用户</button>
      </div>
      <div class="p-4 border-b border-slate-100 dark:border-slate-700 space-y-3">
        <input v-model="userQuery.q" @keyup.enter="fetchUsers" type="text" class="w-full px-3 py-3 lg:py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-emerald-500 text-base lg:text-sm" placeholder="搜索（用户名/邮箱/STCN ID）" />
        <select v-model="userQuery.role" @change="userQuery.page = 1; fetchUsers()" class="w-full px-3 py-3 lg:py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-emerald-500 text-base lg:text-sm">
          <option value="">全部角色</option>
          <option value="user">普通用户</option>
          <option value="dev">开发者</option>
          <option value="ops">运维</option>
        </select>
        <button @click="userQuery.page = 1; fetchUsers()" class="w-full px-3 py-3 lg:py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-base lg:text-sm font-bold transition-colors">刷新</button>
      </div>
      <div v-if="showCreateUserForm" class="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-100 dark:bg-slate-900/80 space-y-3">
        <input v-model="newUserName" type="text" class="w-full px-3 py-3 lg:py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-emerald-500 text-base lg:text-sm" placeholder="用户名（必填）" />
        <input v-model="newUserPassword" type="password" class="w-full px-3 py-3 lg:py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-emerald-500 text-base lg:text-sm" placeholder="留空则仅支持第三方登录" />
        <input v-model="newUserEmail" type="email" class="w-full px-3 py-3 lg:py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-emerald-500 text-base lg:text-sm" placeholder="邮箱（选填）" />
        <div class="flex gap-2">
          <button @click="createUser" :disabled="creatingUser || !newUserName.trim()" class="flex-1 px-3 py-3 lg:py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-base lg:text-sm font-bold transition-colors">{{ creatingUser ? '创建中...' : '创建' }}</button>
          <button @click="showCreateUserForm = false; newUserName = ''; newUserPassword = ''; newUserEmail = ''" class="px-3 py-3 lg:py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-base lg:text-sm font-bold hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors">取消</button>
        </div>
      </div>
      <div class="flex-1 overflow-y-auto p-4 space-y-2">
        <div
          v-for="u in usersPage.items"
          :key="u.id"
          @click="selectUser(u); if (isMobile) openDetail()"
          class="p-3 rounded-xl border cursor-pointer transition-all duration-200 flex items-center gap-3"
          :class="selectedUserId === u.id ? 'bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-500/20' : 'bg-slate-50 dark:bg-slate-900/50 border-transparent hover:border-emerald-300'"
        >
          <div class="w-10 h-10 lg:w-8 lg:h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold overflow-hidden">
            <img v-if="u.avatar_url" :src="u.avatar_url" class="w-full h-full object-cover" />
            <span v-else :class="selectedUserId === u.id ? 'text-white' : 'text-slate-500'">{{ (u.name || '?').charAt(0) }}</span>
          </div>
          <div class="flex-1 min-w-0">
            <div class="font-medium truncate text-sm">{{ u.name }}</div>
            <div class="text-xs opacity-80 truncate">{{ u.role }} {{ u.is_active ? '' : '(已禁用)' }}</div>
          </div>
        </div>
        <div v-if="usersPage.items.length === 0" class="text-sm text-slate-400 text-center py-10">暂无用户</div>
      </div>
      <div class="p-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-sm">
        <button @click="prevUserPage" :disabled="usersPage.page <= 1" class="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed">上一页</button>
        <div class="text-slate-500 dark:text-slate-300">{{ usersPage.page }} / {{ Math.max(1, Math.ceil(usersPage.total / usersPage.pageSize)) }}</div>
        <button @click="nextUserPage" :disabled="usersPage.page >= Math.ceil(usersPage.total / usersPage.pageSize)" class="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed">下一页</button>
      </div>
    </div>

    <div class="lg:col-span-3 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col" :class="{ 'hidden': isMobile && mobileView === 'list' }" v-if="userDraft">
      <div class="p-4 lg:p-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
        <h2 class="text-lg lg:text-xl font-bold text-slate-800 dark:text-white">用户详情</h2>
      </div>
      <div class="flex-1 overflow-y-auto p-4 lg:p-8 space-y-4 lg:space-y-6" style="max-height: 600px;">
        <div class="flex items-center gap-4">
          <div class="w-16 h-16 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
            <img v-if="userDraft.avatar_url" :src="userDraft.avatar_url" class="w-full h-full object-cover" />
            <div v-else class="w-full h-full flex items-center justify-center text-xl font-bold text-slate-500">{{ (userDraft.name || '?').charAt(0) }}</div>
          </div>
          <div>
            <div class="text-lg font-extrabold text-slate-900 dark:text-white">{{ userDraft.name }}</div>
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
                class="px-4 py-3 lg:py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-bold transition-colors"
              >
                重置密码
              </button>
            </div>
          </div>

          <div v-if="showResetPassword" class="space-y-3">
            <input v-model="resetPasswordValue" type="password" class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-blue-500 text-base" placeholder="输入新密码" />
            <div class="flex gap-2">
              <button @click="resetPassword" :disabled="resettingPassword || !resetPasswordValue" class="flex-1 px-4 py-3 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold transition-colors">{{ resettingPassword ? '重置中...' : '确认重置' }}</button>
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
    <div v-else class="lg:col-span-3 flex items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl min-h-[300px] lg:min-h-[700px]" :class="{ 'hidden': isMobile && mobileView === 'list' }">
      <p class="text-slate-400">请在左侧选择一个用户进行管理</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { adminFetch, formatAdminError, formatDateTime } from '../../composables/useAdminFetch';
import { useAuth } from '../../composables/useAuth';
import CapabilityEditor from '../../components/admin/CapabilityEditor.vue';

type Capability = { id: string; name: string; category: string; description: string };
type RoleTemplate = { name: string; capabilityIds: string[] };

const { user: currentUser } = useAuth();

const isMobile = ref(false);
const updateIsMobile = () => {
  if (typeof window !== 'undefined') {
    isMobile.value = window.innerWidth < 1024;
  }
};
onMounted(() => {
  updateIsMobile();
  window.addEventListener('resize', updateIsMobile);
  fetchUsers();
  fetchCapabilities();
  fetchRoleTemplates();
});
onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', updateIsMobile);
  }
});

const mobileView = ref<'list' | 'detail'>('list');
const openDetail = () => { mobileView.value = 'detail'; };

const userQuery = ref({ q: '', role: '', page: 1, pageSize: 20 });
const usersPage = ref<{ items: any[]; page: number; pageSize: number; total: number }>({ items: [], page: 1, pageSize: 20, total: 0 });

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

const allCapabilitiesList = ref<Capability[]>([]);
const roleTemplates = ref<Record<string, RoleTemplate>>({});

const inferredRoleLabel = computed(() => {
  if (userDraftIsSuperadmin.value) return '超级管理员';
  if (userDraftCapabilities.value.includes('admin_panel_access')) return '运维';
  if (userDraftCapabilities.value.includes('dev_panel_access')) return '开发者';
  return '用户';
});

const inferredRoleTagClass = computed(() => {
  if (userDraftIsSuperadmin.value) return 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40';
  if (userDraftCapabilities.value.includes('admin_panel_access')) return 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-500/40';
  if (userDraftCapabilities.value.includes('dev_panel_access')) return 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-500/40';
  return 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600';
});

const fetchUsers = async () => {
  try {
    const qs = new URLSearchParams();
    if (userQuery.value.q) qs.set('q', userQuery.value.q);
    if (userQuery.value.role) qs.set('role', userQuery.value.role);
    qs.set('page', String(userQuery.value.page));
    qs.set('pageSize', String(userQuery.value.pageSize));
    const res = await adminFetch(`/api/admin/users?${qs.toString()}`);
    if (!res.ok) return;
    const json = await res.json();
    usersPage.value = json;
  } catch {}
};

const selectUser = async (u: any) => {
  selectedUserId.value = u.id;
  userDraft.value = { ...u };
  userDraftCapabilities.value = [];
  userDraftIsSuperadmin.value = false;
  try {
    const res = await adminFetch(`/api/admin/users/${u.id}/capabilities`);
    if (res.ok) {
      const json = await res.json();
      userDraftCapabilities.value = json.capabilities ?? [];
      userDraftIsSuperadmin.value = json.is_superadmin ?? false;
    }
  } catch {}
};

const prevUserPage = async () => {
  if (usersPage.value.page <= 1) return;
  userQuery.value.page -= 1;
  await fetchUsers();
};

const nextUserPage = async () => {
  const maxPage = Math.max(1, Math.ceil(usersPage.value.total / usersPage.value.pageSize));
  if (usersPage.value.page >= maxPage) return;
  userQuery.value.page += 1;
  await fetchUsers();
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

const fetchRoleTemplates = async () => {
  try {
    const res = await adminFetch('/api/admin/role-templates');
    if (res.ok) {
      const json = await res.json();
      roleTemplates.value = json.templates ?? {};
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
</script>
