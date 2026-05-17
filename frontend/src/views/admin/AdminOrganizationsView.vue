<template>
  <ui-ListDetailLayout
    :selected-id="selectedOrgId"
    :selected-item-label="selectedOrg?.name"
    :selected-item-icon="Building2"
    :searchable="false"
    list-title="组织列表"
    detail-title="组织详情"
    :page="orgsPage.page"
    :total="orgsPage.total"
    :page-size="orgsPage.pageSize"
    @update:page="onOrgPageChange"
    @back="selectedOrgId = null"
  >
    <template #list-toolbar>
      <select v-model="statusFilter" @change="fetchOrgs" class="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-emerald-500 text-sm">
        <option value="">全部状态</option>
        <option value="pending">待审核</option>
        <option value="approved">已通过</option>
        <option value="rejected">已驳回</option>
        <option value="suspended">已暂停</option>
      </select>
    </template>

    <template #list>
      <div class="space-y-2">
        <div
          v-for="org in orgsPage.items"
          :key="org.id"
          @click="selectOrg(org)"
          class="p-3 rounded-xl border cursor-pointer transition-all duration-200"
          :class="selectedOrgId === org.id ? 'bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-500/20' : 'bg-slate-50 dark:bg-slate-900/50 border-transparent hover:border-emerald-300'"
        >
          <div class="font-bold text-sm truncate">{{ org.name }}</div>
          <div class="text-xs opacity-80 truncate mt-1">
            <ui-StatusBadge :status="org.status" :label="org.status === 'suspended' ? '已暂停' : undefined" />
            <span class="ml-1">{{ org.slug }}</span>
          </div>
        </div>
        <ui-EmptyState v-if="orgsPage.items.length === 0" :icon="Building2" title="暂无组织" />
      </div>
    </template>

    <template #detail>
      <div v-if="selectedOrg" class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col">
        <div class="p-4 lg:p-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
          <h2 class="text-lg lg:text-xl font-bold text-slate-800 dark:text-white">组织审核与管理</h2>
        </div>
        <div class="flex-1 overflow-y-auto p-4 lg:p-8 space-y-4 lg:space-y-6">
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
            <div class="space-y-2 lg:col-span-2">
              <div class="text-sm font-extrabold text-slate-700 dark:text-slate-300">组织名称</div>
              <div v-if="!hasCapability('org:manage')" class="text-lg font-extrabold text-slate-900 dark:text-white">{{ selectedOrg.name }}</div>
              <div v-else class="flex flex-col sm:flex-row gap-2">
                <input v-model="editOrgName" type="text" maxlength="100" class="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-emerald-500 text-base" />
                <button type="button" @click="saveOrgName" :disabled="savingName" class="px-4 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold text-sm shrink-0">
                  {{ savingName ? '保存中…' : '保存名称' }}
                </button>
              </div>
            </div>
            <div class="space-y-2">
              <div class="text-sm font-extrabold text-slate-700 dark:text-slate-300">Slug</div>
              <div class="text-sm text-slate-600 dark:text-slate-400">{{ selectedOrg.slug }}</div>
            </div>
            <div class="space-y-2">
              <div class="text-sm font-extrabold text-slate-700 dark:text-slate-300">状态</div>
              <ui-StatusBadge :status="selectedOrg.status" :label="selectedOrg.status === 'suspended' ? '已暂停' : undefined" />
            </div>
            <div class="space-y-2">
              <div class="text-sm font-extrabold text-slate-700 dark:text-slate-300">网站</div>
              <a v-if="selectedOrg.website_url" :href="selectedOrg.website_url" target="_blank" class="text-sm text-emerald-600 hover:underline break-all">{{ selectedOrg.website_url }}</a>
              <span v-else class="text-sm text-slate-400">-</span>
            </div>
          </div>
          <div class="space-y-2">
            <div class="text-sm font-extrabold text-slate-700 dark:text-slate-300">描述</div>
            <div class="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 whitespace-pre-wrap text-sm">{{ selectedOrg.description || '无' }}</div>
          </div>

          <div v-if="hasCapability('org:manage')" class="space-y-3 p-4 rounded-2xl border border-dashed border-slate-200 dark:border-slate-600 bg-slate-50/80 dark:bg-slate-900/40">
            <div class="text-sm font-extrabold text-slate-700 dark:text-slate-300">添加成员</div>
            <SearchSelect v-model="inviteUserId" :search-fn="memberSearchFn" placeholder="搜索用户名添加…" clearable />
            <div class="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
              <label class="text-xs text-slate-500 dark:text-slate-400 shrink-0">角色</label>
              <select v-model="inviteRole" class="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm">
                <option value="member">成员</option>
                <option value="admin">管理员</option>
              </select>
              <button type="button" @click="addOrgMember" :disabled="addingMember || !inviteUserId" class="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold text-sm shrink-0">
                {{ addingMember ? '添加中…' : '添加' }}
              </button>
            </div>
          </div>

          <div class="space-y-2">
            <div class="text-sm font-extrabold text-slate-700 dark:text-slate-300">成员 ({{ orgMembers.length }})</div>
            <div v-if="orgMembers.length" class="space-y-2">
              <div v-for="m in orgMembers" :key="m.user_id" class="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50">
                <div class="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden">
                  <img v-if="m.user_avatar_url || m.avatar_url" :src="m.user_avatar_url || m.avatar_url" class="w-full h-full object-cover" />
                  <span v-else>{{ (m.user_name || m.role || 'm')[0].toUpperCase() }}</span>
                </div>
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-bold text-slate-800 dark:text-white truncate">{{ m.user_name || m.user_id }}</div>
                  <div class="text-xs text-slate-500 dark:text-slate-400 font-mono truncate">{{ m.user_id }}</div>
                </div>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0" :class="roleBadgeClass(m.role)">{{ m.role }}</span>
              </div>
            </div>
            <div v-else class="text-sm text-slate-400 py-2">暂无成员</div>
          </div>

          <div class="space-y-2">
            <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">审核备注（可选）</label>
            <textarea v-model="reviewNote" rows="2" class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:border-emerald-500 resize-none text-base"></textarea>
          </div>
        </div>
        <div class="p-4 border-t border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col sm:flex-row gap-3">
          <button v-if="selectedOrg.status === 'pending' && hasCapability('org:review')" @click="approveOrg" class="flex-1 px-4 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold transition-colors">通过</button>
          <button v-if="selectedOrg.status === 'pending' && hasCapability('org:review')" @click="rejectOrg" class="flex-1 px-4 py-3 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-bold transition-colors">驳回</button>
          <button v-if="selectedOrg.status === 'approved' && hasCapability('org:manage')" @click="suspendOrg" class="flex-1 px-4 py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-bold transition-colors">暂停</button>
          <button v-if="selectedOrg.status === 'suspended' && hasCapability('org:manage')" @click="reactivateOrg" class="flex-1 px-4 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold transition-colors">恢复</button>
          <button v-if="selectedOrg.status !== 'pending' && hasCapability('org:manage')" @click="deleteOrg" class="flex-1 px-4 py-3 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-bold transition-colors">删除</button>
        </div>
      </div>
    </template>

    <template #empty-detail>
      <div class="flex items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl min-h-[400px]">
        <div class="text-center">
          <p class="text-slate-400 mb-2">从列表中选择组织查看详情</p>
        </div>
      </div>
    </template>
  </ui-ListDetailLayout>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { adminFetch, formatAdminError } from '../../composables/useAdminFetch';
import { useAuth } from '../../composables/useAuth';
import { ListDetailLayout as uiListDetailLayout, EmptyState as uiEmptyState, StatusBadge as uiStatusBadge } from '../../components/ui';
import SearchSelect from '../../components/admin/SearchSelect.vue';
import { Building2 } from 'lucide-vue-next';

const { hasCapability } = useAuth();

const orgsPage = ref<{ items: any[]; page: number; pageSize: number; total: number }>({ items: [], page: 1, pageSize: 20, total: 0 });
const statusFilter = ref('pending');
const selectedOrgId = ref<string | null>(null);
const selectedOrg = ref<any | null>(null);
const orgMembers = ref<any[]>([]);
const reviewNote = ref('');
const editOrgName = ref('');
const savingName = ref(false);
const inviteUserId = ref<string | null>(null);
const inviteRole = ref<'member' | 'admin'>('member');
const addingMember = ref(false);

const roleBadgeClass = (role: string) => {
  const map: Record<string, string> = {
    owner: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    admin: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    member: 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400',
  };
  return map[role] ?? 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400';
};

const fetchOrgs = async () => {
  try {
    const qs = new URLSearchParams();
    if (statusFilter.value) qs.set('status', statusFilter.value);
    qs.set('page', String(orgsPage.value.page));
    qs.set('pageSize', String(orgsPage.value.pageSize));
    const res = await adminFetch(`/api/admin/organizations?${qs.toString()}`);
    if (!res.ok) return;
    const nextPage = await res.json();
    orgsPage.value = nextPage;

    const hasSelected = !!selectedOrgId.value;
    const selectedStillExists = hasSelected
      && nextPage.items.some((item: any) => item.id === selectedOrgId.value);

    if (hasSelected && !selectedStillExists) {
      selectedOrgId.value = null;
      selectedOrg.value = null;
      orgMembers.value = [];
      reviewNote.value = '';
      inviteUserId.value = null;
      editOrgName.value = '';
    }
  } catch {}
};

const memberSearchFn = async (query: string) => {
  if (!selectedOrgId.value) return [];
  const qs = new URLSearchParams({ q: query });
  const res = await adminFetch(`/api/admin/organizations/${encodeURIComponent(selectedOrgId.value)}/member-search?${qs.toString()}`);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.items ?? []).map((u: any) => ({
    id: u.id,
    label: u.name,
    subtitle: u.email || (u.id ? String(u.id).slice(0, 8) : ''),
    avatar: u.avatar_url,
  }));
};

const selectOrg = async (org: any) => {
  selectedOrgId.value = org.id;
  selectedOrg.value = org;
  reviewNote.value = '';
  inviteUserId.value = null;
  try {
    const res = await adminFetch(`/api/admin/organizations/${encodeURIComponent(org.id)}`);
    if (res.ok) {
      const detail = await res.json();
      selectedOrg.value = detail;
      orgMembers.value = detail.members ?? [];
      editOrgName.value = detail.name ?? '';
    }
  } catch {}
};

const saveOrgName = async () => {
  if (!selectedOrgId.value) return;
  const name = editOrgName.value.trim();
  if (!name) {
    alert('名称不能为空');
    return;
  }
  savingName.value = true;
  try {
    const res = await adminFetch(`/api/admin/organizations/${encodeURIComponent(selectedOrgId.value)}`, { method: 'PATCH', body: JSON.stringify({ name }) });
    const json = await res.json();
    if (!res.ok) {
      alert(formatAdminError(json, '保存失败', res.status));
      return;
    }
    alert('名称已更新');
    if (selectedOrg.value) selectedOrg.value = { ...selectedOrg.value, ...json };
    await fetchOrgs();
  } finally {
    savingName.value = false;
  }
};

const addOrgMember = async () => {
  if (!selectedOrgId.value || !inviteUserId.value) return;
  addingMember.value = true;
  try {
    const res = await adminFetch(`/api/admin/organizations/${encodeURIComponent(selectedOrgId.value)}/members`, {
      method: 'POST',
      body: JSON.stringify({ user_id: inviteUserId.value, role: inviteRole.value }),
    });
    const json = await res.json();
    if (!res.ok) {
      alert(formatAdminError(json, '添加失败', res.status));
      return;
    }
    alert('成员已添加');
    inviteUserId.value = null;
    await selectOrg(selectedOrg.value);
  } finally {
    addingMember.value = false;
  }
};

const approveOrg = async () => {
  if (!selectedOrgId.value) return;
  const res = await adminFetch(`/api/admin/organizations/${encodeURIComponent(selectedOrgId.value)}/approve`, { method: 'POST', body: JSON.stringify({ review_note: reviewNote.value }) });
  const json = await res.json();
  if (!res.ok) { alert(formatAdminError(json, '审核失败', res.status)); return; }
  alert('已通过审核');
  selectedOrg.value = null; selectedOrgId.value = null;
  await fetchOrgs();
};

const rejectOrg = async () => {
  if (!selectedOrgId.value) return;
  const res = await adminFetch(`/api/admin/organizations/${encodeURIComponent(selectedOrgId.value)}/reject`, { method: 'POST', body: JSON.stringify({ review_note: reviewNote.value }) });
  const json = await res.json();
  if (!res.ok) { alert(formatAdminError(json, '驳回失败', res.status)); return; }
  alert('已驳回');
  selectedOrg.value = null; selectedOrgId.value = null;
  await fetchOrgs();
};

const suspendOrg = async () => {
  if (!selectedOrgId.value) return;
  const res = await adminFetch(`/api/admin/organizations/${encodeURIComponent(selectedOrgId.value)}`, { method: 'PATCH', body: JSON.stringify({ status: 'suspended', review_note: reviewNote.value }) });
  const json = await res.json();
  if (!res.ok) { alert(formatAdminError(json, '操作失败', res.status)); return; }
  alert('已暂停');
  selectedOrg.value = null; selectedOrgId.value = null;
  await fetchOrgs();
};

const reactivateOrg = async () => {
  if (!selectedOrgId.value) return;
  const res = await adminFetch(`/api/admin/organizations/${encodeURIComponent(selectedOrgId.value)}`, { method: 'PATCH', body: JSON.stringify({ status: 'approved', review_note: reviewNote.value }) });
  const json = await res.json();
  if (!res.ok) { alert(formatAdminError(json, '操作失败', res.status)); return; }
  alert('已恢复');
  selectedOrg.value = null; selectedOrgId.value = null;
  await fetchOrgs();
};

const deleteOrg = async () => {
  if (!selectedOrgId.value) return;
  if (!confirm('确定要删除此组织吗？此操作不可撤销。')) return;
  const res = await adminFetch(`/api/admin/organizations/${encodeURIComponent(selectedOrgId.value)}`, { method: 'DELETE' });
  const json = await res.json();
  if (!res.ok) { alert(formatAdminError(json, '删除失败', res.status)); return; }
  alert('已删除');
  selectedOrg.value = null; selectedOrgId.value = null;
  await fetchOrgs();
};

const onOrgPageChange = async (newPage: number) => {
  orgsPage.value.page = newPage;
  await fetchOrgs();
};

watch(statusFilter, () => {
  orgsPage.value.page = 1;
  selectedOrgId.value = null;
  selectedOrg.value = null;
  orgMembers.value = [];
  reviewNote.value = '';
  inviteUserId.value = null;
  editOrgName.value = '';
  void fetchOrgs();
});

onMounted(() => { fetchOrgs(); });
</script>
