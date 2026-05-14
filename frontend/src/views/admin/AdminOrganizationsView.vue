<template>
  <FloatingPanel
    ref="panelRef"
    :selected-label="selectedOrgId ? selectedOrg?.name || '' : ''"
    placeholder="选择一个组织"
    list-label="组织列表"
    :count="orgsPage.total"
    :prev-enabled="orgsPage.page > 1"
    :next-enabled="orgsPage.page < Math.ceil(orgsPage.total / orgsPage.pageSize)"
    @prev="prevPage"
    @next="nextPage"
  >
    <template #content>
      <div v-if="selectedOrg" class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col">
        <div class="p-4 lg:p-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
          <h2 class="text-lg lg:text-xl font-bold text-slate-800 dark:text-white">组织审核</h2>
        </div>
        <div class="flex-1 overflow-y-auto p-4 lg:p-8 space-y-4 lg:space-y-6">
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
            <div class="space-y-2">
              <div class="text-sm font-extrabold text-slate-700 dark:text-slate-300">组织名称</div>
              <div class="text-lg font-extrabold text-slate-900 dark:text-white">{{ selectedOrg.name }}</div>
            </div>
            <div class="space-y-2">
              <div class="text-sm font-extrabold text-slate-700 dark:text-slate-300">Slug</div>
              <div class="text-sm text-slate-600 dark:text-slate-400">{{ selectedOrg.slug }}</div>
            </div>
            <div class="space-y-2">
              <div class="text-sm font-extrabold text-slate-700 dark:text-slate-300">状态</div>
              <span class="inline-block px-2.5 py-1 rounded-full text-xs font-bold" :class="statusClass(selectedOrg.status)">{{ statusLabel(selectedOrg.status) }}</span>
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
          <div v-if="orgMembers.length" class="space-y-2">
            <div class="text-sm font-extrabold text-slate-700 dark:text-slate-300">成员</div>
            <div class="space-y-2">
              <div v-for="m in orgMembers" :key="m.user_id" class="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50">
                <div class="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold">{{ (m.role || 'm')[0].toUpperCase() }}</div>
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-bold text-slate-800 dark:text-white truncate">{{ m.user_id }}</div>
                  <div class="text-xs text-slate-500 dark:text-slate-400">{{ m.role }}</div>
                </div>
              </div>
            </div>
          </div>
          <div class="space-y-2">
            <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">审核备注（可选）</label>
            <textarea v-model="reviewNote" rows="2" class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:border-emerald-500 resize-none text-base"></textarea>
          </div>
        </div>
        <div class="p-4 border-t border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col sm:flex-row gap-3">
          <button v-if="selectedOrg.status === 'pending'" @click="approveOrg" class="flex-1 px-4 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold transition-colors">通过</button>
          <button v-if="selectedOrg.status === 'pending'" @click="rejectOrg" class="flex-1 px-4 py-3 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-bold transition-colors">驳回</button>
          <button v-if="selectedOrg.status === 'approved'" @click="suspendOrg" class="flex-1 px-4 py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-bold transition-colors">暂停</button>
          <button v-if="selectedOrg.status === 'suspended'" @click="reactivateOrg" class="flex-1 px-4 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold transition-colors">恢复</button>
          <button v-if="selectedOrg.status !== 'pending'" @click="deleteOrg" class="flex-1 px-4 py-3 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-bold transition-colors">删除</button>
        </div>
      </div>
      <div v-else class="flex items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl min-h-[400px]">
        <div class="text-center">
          <p class="text-slate-400 mb-2">点击上方列表选择组织</p>
          <button @click="openPanel" class="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold transition-colors">打开列表</button>
        </div>
      </div>
    </template>

    <template #list>
      <div class="space-y-3">
        <div class="flex gap-2">
          <select v-model="statusFilter" @change="fetchOrgs" class="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-emerald-500 text-sm">
            <option value="">全部状态</option>
            <option value="pending">待审核</option>
            <option value="approved">已通过</option>
            <option value="rejected">已驳回</option>
            <option value="suspended">已暂停</option>
          </select>
        </div>
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
              <span class="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold" :class="statusClass(org.status)">{{ statusLabel(org.status) }}</span>
              <span class="ml-1">{{ org.slug }}</span>
            </div>
          </div>
          <div v-if="orgsPage.items.length === 0" class="text-sm text-slate-400 text-center py-10">暂无组织</div>
        </div>
        <div class="flex items-center justify-between text-sm pt-2 border-t border-slate-100 dark:border-slate-700">
          <button @click="prevPage" :disabled="orgsPage.page <= 1" class="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed">上一页</button>
          <div class="text-slate-500 dark:text-slate-300">{{ orgsPage.page }} / {{ Math.max(1, Math.ceil(orgsPage.total / orgsPage.pageSize)) }}</div>
          <button @click="nextPage" :disabled="orgsPage.page >= Math.ceil(orgsPage.total / orgsPage.pageSize)" class="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed">下一页</button>
        </div>
      </div>
    </template>
  </FloatingPanel>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { adminFetch, formatAdminError } from '../../composables/useAdminFetch';
import FloatingPanel from '../../components/admin/FloatingPanel.vue';

const panelRef = ref<InstanceType<typeof FloatingPanel> | null>(null);
const openPanel = () => { if (panelRef.value) (panelRef.value as any).expanded = true; };

const orgsPage = ref<{ items: any[]; page: number; pageSize: number; total: number }>({ items: [], page: 1, pageSize: 20, total: 0 });
const statusFilter = ref('pending');
const selectedOrgId = ref<string | null>(null);
const selectedOrg = ref<any | null>(null);
const orgMembers = ref<any[]>([]);
const reviewNote = ref('');

const statusLabel = (s: string) => {
  const map: Record<string, string> = { pending: '待审核', approved: '已通过', rejected: '已驳回', suspended: '已暂停' };
  return map[s] ?? s;
};

const statusClass = (s: string) => {
  const map: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    rejected: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
    suspended: 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400',
  };
  return map[s] ?? '';
};

const fetchOrgs = async () => {
  try {
    const qs = new URLSearchParams();
    if (statusFilter.value) qs.set('status', statusFilter.value);
    qs.set('page', String(orgsPage.value.page));
    qs.set('pageSize', String(orgsPage.value.pageSize));
    const res = await adminFetch(`/api/admin/organizations?${qs.toString()}`);
    if (!res.ok) return;
    orgsPage.value = await res.json();
  } catch {}
};

const selectOrg = async (org: any) => {
  selectedOrgId.value = org.id;
  selectedOrg.value = org;
  reviewNote.value = '';
  try {
    const res = await adminFetch(`/api/admin/organizations/${encodeURIComponent(org.id)}`);
    if (res.ok) {
      const detail = await res.json();
      selectedOrg.value = detail;
      orgMembers.value = detail.members ?? [];
    }
  } catch {}
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

const prevPage = async () => { if (orgsPage.value.page <= 1) return; orgsPage.value.page -= 1; await fetchOrgs(); };
const nextPage = async () => { const maxPage = Math.max(1, Math.ceil(orgsPage.value.total / orgsPage.value.pageSize)); if (orgsPage.value.page >= maxPage) return; orgsPage.value.page += 1; await fetchOrgs(); };

onMounted(() => { fetchOrgs(); });
</script>
