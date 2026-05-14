<template>
  <FloatingPanel
    ref="panelRef"
    :selected-label="selectedClaimId ? `认领：${selectedClaim?.project_id?.slice(0, 8) || ''}` : ''"
    placeholder="选择一个认领申请"
    list-label="认领列表"
    :count="claimsPage.total"
    :prev-enabled="claimsPage.page > 1"
    :next-enabled="claimsPage.page < Math.ceil(claimsPage.total / claimsPage.pageSize)"
    @prev="prevPage"
    @next="nextPage"
  >
    <template #content>
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
              <span class="inline-block px-2.5 py-1 rounded-full text-xs font-bold" :class="statusClass(selectedClaim.status)">{{ statusLabel(selectedClaim.status) }}</span>
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
      <div v-else class="flex items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl min-h-[400px]">
        <div class="text-center">
          <p class="text-slate-400 mb-2">点击上方列表选择认领申请</p>
          <button @click="openPanel" class="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold transition-colors">打开列表</button>
        </div>
      </div>
    </template>

    <template #list>
      <div class="space-y-3">
        <div class="flex gap-2">
          <select v-model="statusFilter" @change="fetchClaims" class="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-emerald-500 text-sm">
            <option value="">全部状态</option>
            <option value="pending">待审核</option>
            <option value="approved">已通过</option>
            <option value="rejected">已驳回</option>
          </select>
        </div>
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
              <span class="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold" :class="statusClass(claim.status)">{{ statusLabel(claim.status) }}</span>
              <span class="ml-1">申请者：{{ claim.user_id?.slice(0, 8) || '-' }}</span>
            </div>
          </div>
          <div v-if="claimsPage.items.length === 0" class="text-sm text-slate-400 text-center py-10">暂无认领申请</div>
        </div>
        <div class="flex items-center justify-between text-sm pt-2 border-t border-slate-100 dark:border-slate-700">
          <button @click="prevPage" :disabled="claimsPage.page <= 1" class="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed">上一页</button>
          <div class="text-slate-500 dark:text-slate-300">{{ claimsPage.page }} / {{ Math.max(1, Math.ceil(claimsPage.total / claimsPage.pageSize)) }}</div>
          <button @click="nextPage" :disabled="claimsPage.page >= Math.ceil(claimsPage.total / claimsPage.pageSize)" class="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed">下一页</button>
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

const claimsPage = ref<{ items: any[]; page: number; pageSize: number; total: number }>({ items: [], page: 1, pageSize: 20, total: 0 });
const statusFilter = ref('pending');
const selectedClaimId = ref<string | null>(null);
const selectedClaim = ref<any | null>(null);
const reviewNote = ref('');

const statusLabel = (s: string) => {
  const map: Record<string, string> = { pending: '待审核', approved: '已通过', rejected: '已驳回' };
  return map[s] ?? s;
};

const statusClass = (s: string) => {
  const map: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    rejected: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  };
  return map[s] ?? '';
};

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

const prevPage = async () => { if (claimsPage.value.page <= 1) return; claimsPage.value.page -= 1; await fetchClaims(); };
const nextPage = async () => { const maxPage = Math.max(1, Math.ceil(claimsPage.value.total / claimsPage.value.pageSize)); if (claimsPage.value.page >= maxPage) return; claimsPage.value.page += 1; await fetchClaims(); };

onMounted(() => { fetchClaims(); });
</script>
