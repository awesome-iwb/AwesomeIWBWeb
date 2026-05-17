<template>
  <ui-ListDetailLayout
    :selected-id="selectedClaimId"
    :selected-item-label="selectedClaim?.project_id?.slice(0, 8) ? '项目 ' + selectedClaim.project_id.slice(0, 8) + '...' : '认领详情'"
    :selected-item-icon="ClipboardList"
    :searchable="false"
    list-title="认领列表"
    detail-title="认领审核"
    :page="claimsPage.page"
    :total="claimsPage.total"
    :page-size="claimsPage.pageSize"
    @update:page="onClaimPageChange"
    @back="selectedClaimId = null"
  >
    <template #list-toolbar>
      <select v-model="statusFilter" @change="fetchClaims" class="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-emerald-500 text-sm">
        <option value="">全部状态</option>
        <option value="pending">待审核</option>
        <option value="approved">已通过</option>
        <option value="rejected">已驳回</option>
      </select>
    </template>

    <template #list>
      <div class="space-y-2">
        <div
          v-for="claim in claimsPage.items"
          :key="claim.id"
          @click="selectClaim(claim)"
          class="p-3 rounded-xl border cursor-pointer transition-all duration-200"
          :class="selectedClaimId === claim.id ? 'bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-500/20' : 'bg-slate-50 dark:bg-slate-900/50 border-transparent hover:border-emerald-300'"
        >
          <div class="font-bold text-sm truncate">
            项目：{{ claim.project_id?.slice(0, 8) || '-' }}
          </div>
          <div class="text-xs opacity-80 truncate mt-1">
            <ui-StatusBadge :status="claim.status" />
            <span class="ml-1">申请者：{{ claim.user_id?.slice(0, 8) || '-' }}</span>
          </div>
        </div>
        <ui-EmptyState v-if="claimsPage.items.length === 0" :icon="ClipboardList" title="暂无认领申请" />
      </div>
    </template>

    <template #detail>
      <div v-if="selectedClaim" class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col">
        <div class="p-4 lg:p-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
          <h2 class="text-lg lg:text-xl font-bold text-slate-800 dark:text-white">认领审核</h2>
        </div>
        <div class="flex-1 overflow-y-auto p-4 lg:p-8 space-y-4 lg:space-y-6">
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
            <div class="space-y-2">
              <div class="text-sm font-extrabold text-slate-700 dark:text-slate-300">项目 ID</div>
              <div class="text-sm text-slate-600 dark:text-slate-400 font-mono break-all">{{ selectedClaim.project_id }}</div>
            </div>
            <div class="space-y-2">
              <div class="text-sm font-extrabold text-slate-700 dark:text-slate-300">申请者 ID</div>
              <div class="text-sm text-slate-600 dark:text-slate-400 font-mono break-all">{{ selectedClaim.user_id }}</div>
            </div>
            <div class="space-y-2">
              <div class="text-sm font-extrabold text-slate-700 dark:text-slate-300">状态</div>
              <ui-StatusBadge :status="selectedClaim.status" />
            </div>
            <div class="space-y-2">
              <div class="text-sm font-extrabold text-slate-700 dark:text-slate-300">申请时间</div>
              <div class="text-sm text-slate-600 dark:text-slate-400">{{ formatDate(selectedClaim.created_at) }}</div>
            </div>
          </div>
          <div class="space-y-2">
            <div class="text-sm font-extrabold text-slate-700 dark:text-slate-300">申请理由</div>
            <div class="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 whitespace-pre-wrap text-sm">{{ selectedClaim.message || '无' }}</div>
          </div>
          <div v-if="selectedClaim.review_note" class="space-y-2">
            <div class="text-sm font-extrabold text-slate-700 dark:text-slate-300">审核备注</div>
            <div class="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 whitespace-pre-wrap text-sm">{{ selectedClaim.review_note }}</div>
          </div>
          <div class="space-y-2">
            <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">审核备注（可选）</label>
            <textarea v-model="reviewNote" rows="2" class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:border-emerald-500 resize-none text-base"></textarea>
          </div>
        </div>
        <div v-if="selectedClaim.status === 'pending'" class="p-4 border-t border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col sm:flex-row gap-3">
          <button @click="approveClaim" class="flex-1 px-4 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold transition-colors">通过</button>
          <button @click="rejectClaim" class="flex-1 px-4 py-3 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-bold transition-colors">驳回</button>
        </div>
      </div>
    </template>

    <template #empty-detail>
      <div class="flex items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl min-h-[400px]">
        <div class="text-center">
          <p class="text-slate-400 mb-2">从列表中选择认领申请查看详情</p>
        </div>
      </div>
    </template>
  </ui-ListDetailLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { adminFetch, formatAdminError } from '../../composables/useAdminFetch';
import { ListDetailLayout as uiListDetailLayout, EmptyState as uiEmptyState, StatusBadge as uiStatusBadge } from '../../components/ui';
import { ClipboardList } from 'lucide-vue-next';

const claimsPage = ref<{ items: any[]; page: number; pageSize: number; total: number }>({ items: [], page: 1, pageSize: 20, total: 0 });
const statusFilter = ref('pending');
const selectedClaimId = ref<string | null>(null);
const selectedClaim = ref<any | null>(null);
const reviewNote = ref('');

const formatDate = (v: string) => {
  if (!v) return '-';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleString();
};

const fetchClaims = async () => {
  try {
    const qs = new URLSearchParams();
    if (statusFilter.value) qs.set('status', statusFilter.value);
    qs.set('page', String(claimsPage.value.page));
    qs.set('pageSize', String(claimsPage.value.pageSize));
    const res = await adminFetch(`/api/admin/project-claims?${qs.toString()}`);
    if (!res.ok) return;
    claimsPage.value = await res.json();
  } catch {}
};

const selectClaim = (claim: any) => {
  selectedClaimId.value = claim.id;
  selectedClaim.value = claim;
  reviewNote.value = '';
};

const approveClaim = async () => {
  if (!selectedClaimId.value) return;
  const res = await adminFetch(`/api/admin/project-claims/${encodeURIComponent(selectedClaimId.value)}/approve`, { method: 'POST', body: JSON.stringify({ review_note: reviewNote.value }) });
  const json = await res.json();
  if (!res.ok) { alert(formatAdminError(json, '审核失败', res.status)); return; }
  alert('已通过认领');
  selectedClaim.value = null; selectedClaimId.value = null;
  await fetchClaims();
};

const rejectClaim = async () => {
  if (!selectedClaimId.value) return;
  const res = await adminFetch(`/api/admin/project-claims/${encodeURIComponent(selectedClaimId.value)}/reject`, { method: 'POST', body: JSON.stringify({ review_note: reviewNote.value }) });
  const json = await res.json();
  if (!res.ok) { alert(formatAdminError(json, '驳回失败', res.status)); return; }
  alert('已驳回');
  selectedClaim.value = null; selectedClaimId.value = null;
  await fetchClaims();
};

const onClaimPageChange = async (newPage: number) => {
  claimsPage.value.page = newPage;
  await fetchClaims();
};

onMounted(() => { fetchClaims(); });
</script>
