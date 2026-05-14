<template>
  <FloatingPanel
    ref="panelRef"
    :selected-label="selectedSubmissionId ? (submissionKind === 'project_update' ? `变更：${submissionDraft?.project_name}` : submissionDraft?.name) : ''"
    placeholder="选择一个待审核项目"
    list-label="待审核列表"
    :count="submissionsPage.total"
    :prev-enabled="submissionsPage.page > 1"
    :next-enabled="submissionsPage.page < Math.ceil(submissionsPage.total / submissionsPage.pageSize)"
    @prev="prevSubmissionPage"
    @next="nextSubmissionPage"
  >
    <template #content>
      <div v-if="submissionDraft" class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col">
        <div class="p-4 lg:p-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
          <h2 class="text-lg lg:text-xl font-bold text-slate-800 dark:text-white">审核项目提交</h2>
        </div>
        <div class="flex-1 overflow-y-auto p-4 lg:p-8 space-y-4 lg:space-y-6">
          <div v-if="submissionKind === 'project_update'" class="space-y-4 lg:space-y-6">
            <div class="p-4 lg:p-5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
              <div class="text-sm font-extrabold text-slate-800 dark:text-slate-200 mb-2">目标项目</div>
              <div class="text-lg font-extrabold text-slate-900 dark:text-white">{{ submissionDraft.project_name }}</div>
              <div class="text-sm text-slate-500 dark:text-slate-400 mt-1">开发者：{{ submissionDraft.actor?.username || '-' }}</div>
            </div>
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
              <div class="space-y-2">
                <div class="text-sm font-extrabold text-slate-700 dark:text-slate-300">新简介</div>
                <div class="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 whitespace-pre-wrap text-sm">{{ submissionDraft.patch?.description || '' }}</div>
              </div>
              <div class="space-y-2">
                <div class="text-sm font-extrabold text-slate-700 dark:text-slate-300">新关键词</div>
                <div class="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 whitespace-pre-wrap text-sm">{{ submissionDraft.patch?.keywords || '' }}</div>
              </div>
            </div>
            <div class="space-y-2">
              <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">驳回原因（可选）</label>
              <textarea v-model="submissionReviewNote" rows="2" class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:border-emerald-500 resize-none text-base"></textarea>
            </div>
          </div>
          <div v-else class="space-y-4 lg:grid lg:grid-cols-2 lg:gap-8">
            <div class="lg:col-span-1">
              <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">项目名称</label>
              <input type="text" v-model="submissionDraft.name" class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:border-emerald-500 text-base" />
            </div>
            <div class="lg:col-span-1">
              <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">开发者</label>
              <input type="text" v-model="submissionDraft.developer" class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:border-emerald-500 text-base" />
            </div>
            <div class="lg:col-span-2">
              <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">GitHub 仓库</label>
              <input type="text" v-model="submissionDraft.github_url" class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:border-emerald-500 text-base" />
            </div>
            <div class="lg:col-span-2">
              <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">简介</label>
              <textarea v-model="submissionDraft.description" rows="3" class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:border-emerald-500 resize-none text-base"></textarea>
            </div>
            <div class="lg:col-span-1">
              <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">标签（逗号分隔）</label>
              <input type="text" v-model="submissionDraft.keywords" class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:border-emerald-500 text-base" />
            </div>
            <div class="lg:col-span-1">
              <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">推荐标签（逗号分隔）</label>
              <input type="text" v-model="submissionDraft.recommendation" class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:border-emerald-500 text-base" />
            </div>
            <div class="lg:col-span-2">
              <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">分类</label>
              <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <select v-model="submissionCategoryId" class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:border-emerald-500 text-base">
                  <option value="">选择现有分类</option>
                  <option v-for="c in adminCategories" :key="c.id" :value="c.id">{{ c.name }}</option>
                </select>
                <input v-model="submissionNewCategoryName" type="text" placeholder="或新建分类名称" class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:border-emerald-500 text-base" />
              </div>
              <div class="text-xs text-slate-500 dark:text-slate-400 mt-2">优先使用"选择现有分类"，若填写新分类名称则会自动创建。</div>
            </div>
            <div class="lg:col-span-2">
              <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">驳回原因（可选）</label>
              <textarea v-model="submissionReviewNote" rows="2" class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:border-emerald-500 resize-none text-base"></textarea>
            </div>
          </div>
        </div>
        <div class="p-4 border-t border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col sm:flex-row gap-3">
          <button @click="approveSubmission" class="flex-1 px-4 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold transition-colors">通过并入库</button>
          <button @click="rejectSubmission" class="flex-1 px-4 py-3 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-bold transition-colors">驳回</button>
        </div>
      </div>
      <div v-else class="flex items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl min-h-[400px]">
        <div class="text-center">
          <p class="text-slate-400 mb-2">点击下方悬浮栏选择待审核项目</p>
          <button @click="panelRef?.expanded = true" class="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold transition-colors">打开列表</button>
        </div>
      </div>
    </template>

    <template #list>
      <div class="space-y-3">
        <div class="flex gap-2">
          <input v-model="submissionQuery.q" @keyup.enter="fetchSubmissions" type="text" class="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-emerald-500 text-sm" placeholder="搜索（名称/GitHub）" />
          <button @click="submissionQuery.page = 1; fetchSubmissions()" class="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold transition-colors">搜索</button>
        </div>
        <div class="space-y-2">
          <div
            v-for="s in submissionsPage.items"
            :key="s.id"
            @click="selectSubmission(s); panelRef?.close()"
            class="p-3 rounded-xl border cursor-pointer transition-all duration-200"
            :class="selectedSubmissionId === s.id ? 'bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-500/20' : 'bg-slate-50 dark:bg-slate-900/50 border-transparent hover:border-emerald-300'"
          >
            <div class="font-bold text-sm truncate">
              <span v-if="s.payload?.kind === 'project_update'">变更：{{ s.payload?.project_name || '未命名' }}</span>
              <span v-else>{{ s.payload?.name || '未命名' }}</span>
            </div>
            <div class="text-xs opacity-80 truncate mt-1">
              <span v-if="s.payload?.kind === 'project_update'">{{ s.payload?.actor?.username ? `开发者：${s.payload.actor.username}` : '' }}</span>
              <span v-else>{{ s.payload?.github_url || '' }}</span>
            </div>
          </div>
          <div v-if="submissionsPage.items.length === 0" class="text-sm text-slate-400 text-center py-10">暂无待审核</div>
        </div>
        <div class="flex items-center justify-between text-sm pt-2 border-t border-slate-100 dark:border-slate-700">
          <button @click="prevSubmissionPage" :disabled="submissionsPage.page <= 1" class="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed">上一页</button>
          <div class="text-slate-500 dark:text-slate-300">{{ submissionsPage.page }} / {{ Math.max(1, Math.ceil(submissionsPage.total / submissionsPage.pageSize)) }}</div>
          <button @click="nextSubmissionPage" :disabled="submissionsPage.page >= Math.ceil(submissionsPage.total / submissionsPage.pageSize)" class="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed">下一页</button>
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

const adminCategories = ref<any[]>([]);

const fetchAdminCategories = async () => {
  try {
    const res = await adminFetch('/api/admin/categories');
    if (res.ok) { adminCategories.value = await res.json(); return; }
  } catch {}
  try {
    const res = await adminFetch('/api/categories');
    if (res.ok) adminCategories.value = await res.json();
  } catch {}
};

const submissionsPage = ref<{ items: any[]; page: number; pageSize: number; total: number }>({ items: [], page: 1, pageSize: 20, total: 0 });
const submissionQuery = ref<{ q: string; page: number; pageSize: number }>({ q: '', page: 1, pageSize: 20 });
const selectedSubmissionId = ref<string | null>(null);
const submissionDraft = ref<any | null>(null);
const submissionKind = ref<'new_project' | 'project_update'>('new_project');
const submissionReviewNote = ref('');
const submissionCategoryId = ref('');
const submissionNewCategoryName = ref('');

const normalizeProjectDraft = (p: any) => {
  const clone = { ...p };
  if (Array.isArray(clone.keywords)) clone.keywords = clone.keywords.join(', ');
  if (Array.isArray(clone.recommendation)) clone.recommendation = clone.recommendation.join(', ');
  if (!Array.isArray(clone.platform_developers)) clone.platform_developers = [];
  clone.platform_developers = clone.platform_developers.map((d: any) => {
    const legacy = typeof d?.user_id === 'string' ? d.user_id : '';
    const stcn = typeof d?.stcn_user_id === 'string' ? d.stcn_user_id : legacy;
    return { username: typeof d?.username === 'string' ? d.username : '', stcn_user_id: stcn, hzzc_user_id: typeof d?.hzzc_user_id === 'string' ? d.hzzc_user_id : '' };
  });
  if (clone.ai_usage_state !== 'unknown' && clone.ai_usage_state !== 'over50' && clone.ai_usage_state !== 'under50') clone.ai_usage_state = 'unknown';
  return clone;
};

const fetchSubmissions = async () => {
  try {
    const qs = new URLSearchParams();
    if (submissionQuery.value.q) qs.set('q', submissionQuery.value.q);
    qs.set('status', 'pending');
    qs.set('page', String(submissionQuery.value.page));
    qs.set('pageSize', String(submissionQuery.value.pageSize));
    const res = await adminFetch(`/api/admin/submissions?${qs.toString()}`);
    if (!res.ok) return;
    submissionsPage.value = await res.json();
  } catch {}
};

const selectSubmission = (s: any) => {
  selectedSubmissionId.value = s.id;
  const payload = s.payload ?? {};
  if (payload.kind === 'project_update') {
    submissionKind.value = 'project_update';
    submissionDraft.value = { kind: 'project_update', project_name: payload.project_name ?? '', patch: payload.patch ?? {}, actor: payload.actor ?? {} };
    submissionReviewNote.value = '';
    submissionCategoryId.value = '';
    submissionNewCategoryName.value = '';
    return;
  }
  submissionKind.value = 'new_project';
  submissionDraft.value = normalizeProjectDraft({
    name: payload.name ?? '', developer: payload.developer ?? '', github_url: payload.github_url ?? payload.githubUrl ?? '',
    description: payload.description ?? '', keywords: payload.keywords ?? payload.tags ?? '', recommendation: payload.recommendation ?? '',
    status: payload.status ?? '', language: payload.language ?? '', stars: payload.stars ?? 0, icon: payload.icon ?? '', banner: payload.banner ?? ''
  });
  submissionReviewNote.value = '';
  submissionCategoryId.value = '';
  submissionNewCategoryName.value = typeof payload.category === 'string' ? payload.category : '';
};

const approveSubmission = async () => {
  if (!selectedSubmissionId.value || !submissionDraft.value) return;
  if (submissionKind.value === 'project_update') {
    const res = await adminFetch(`/api/admin/submissions/${selectedSubmissionId.value}/approve`, { method: 'POST', body: JSON.stringify({}) });
    const json = await res.json();
    if (!res.ok) { alert(formatAdminError(json, '审核失败', res.status)); return; }
    alert('已通过并应用变更');
    submissionDraft.value = null; selectedSubmissionId.value = null;
    await fetchSubmissions();
    return;
  }
  const toList = (v: any) => { if (Array.isArray(v)) return v; if (typeof v !== 'string') return []; return v.split(/[,，;]/).map((x) => x.trim()).filter(Boolean); };
  const p: any = { ...submissionDraft.value };
  p.keywords = toList(p.keywords); p.recommendation = toList(p.recommendation);
  const body: any = { project: p };
  if (submissionNewCategoryName.value.trim()) body.category_name = submissionNewCategoryName.value.trim();
  else if (submissionCategoryId.value) body.category_id = submissionCategoryId.value;
  const res = await adminFetch(`/api/admin/submissions/${selectedSubmissionId.value}/approve`, { method: 'POST', body: JSON.stringify(body) });
  const json = await res.json();
  if (!res.ok) { alert(formatAdminError(json, '审核失败', res.status)); return; }
  alert('已通过并入库');
  submissionDraft.value = null; selectedSubmissionId.value = null;
  await fetchAdminCategories(); await fetchSubmissions();
};

const rejectSubmission = async () => {
  if (!selectedSubmissionId.value) return;
  const res = await adminFetch(`/api/admin/submissions/${selectedSubmissionId.value}/reject`, { method: 'POST', body: JSON.stringify({ review_note: submissionReviewNote.value }) });
  const json = await res.json();
  if (!res.ok) { alert(formatAdminError(json, '驳回失败', res.status)); return; }
  alert('已驳回');
  submissionDraft.value = null; selectedSubmissionId.value = null;
  await fetchSubmissions();
};

const prevSubmissionPage = async () => { if (submissionsPage.value.page <= 1) return; submissionQuery.value.page -= 1; await fetchSubmissions(); };
const nextSubmissionPage = async () => { const maxPage = Math.max(1, Math.ceil(submissionsPage.value.total / submissionsPage.value.pageSize)); if (submissionsPage.value.page >= maxPage) return; submissionQuery.value.page += 1; await fetchSubmissions(); };

onMounted(() => { fetchAdminCategories(); fetchSubmissions(); });
</script>
