<template>
  <div class="h-full min-h-0">
  <ui-ListDetailLayout
    :selected-id="selectedSubmissionId"
    :selected-item-label="submissionDraft?.project_name || submissionDraft?.name"
    :selected-item-icon="ClipboardCheck"
    :searchable="false"
    :infinite="true"
    :has-more="submissionsHasMore"
    :loading-more="submissionsLoadingMore"
    list-title="待审核列表"
    detail-title="审核详情"
    @load-more="loadMoreSubmissions"
    @back="selectedSubmissionId = null, submissionDraft = null"
  >
    <template #detail>
      <div v-if="submissionDraft" class="bg-white/72 dark:bg-slate-900/62 backdrop-blur-lg rounded-3xl border border-white/70 dark:border-slate-700/70 shadow-xl shadow-slate-900/8 dark:shadow-black/30 overflow-hidden flex flex-col h-full min-h-0">
        <div class="p-4 lg:p-6 border-b border-border bg-accent/50 dark:bg-slate-900/50">
          <h2 class="text-lg lg:text-xl font-bold text-foreground">审核项目提交</h2>
        </div>
        <div class="flex-1 overflow-y-auto p-4 lg:p-8 space-y-5 lg:space-y-6">
          <div v-if="submissionKind === 'project_update'" class="space-y-5 lg:space-y-6">
            <div class="p-4 lg:p-5 rounded-2xl border border-border bg-card/50">
              <div class="text-sm font-extrabold text-foreground mb-2">目标项目</div>
              <div class="text-lg font-extrabold text-foreground">{{ submissionDraft.project_name }}</div>
              <div class="text-sm text-muted-foreground mt-1">开发者：{{ submissionDraft.actor?.username || '-' }}</div>
            </div>
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-6">
              <div class="space-y-2">
                <div class="text-sm font-extrabold text-muted-foreground">新简介</div>
                <div class="p-4 rounded-2xl border border-border bg-card whitespace-pre-wrap text-sm">{{ submissionDraft.patch?.description || '' }}</div>
              </div>
              <div class="space-y-2">
                <div class="text-sm font-extrabold text-muted-foreground">新关键词</div>
                <div class="p-4 rounded-2xl border border-border bg-card whitespace-pre-wrap text-sm">{{ submissionDraft.patch?.keywords || '' }}</div>
              </div>
            </div>
            <div class="space-y-2">
              <label class="block text-sm font-bold text-muted-foreground mb-2">驳回原因（可选）</label>
              <textarea v-model="submissionReviewNote" rows="2" class="w-full px-4 py-3.5 lg:py-3 rounded-xl border border-border bg-card outline-none focus:border-emerald-500 resize-none text-base"></textarea>
            </div>
          </div>
          <div v-else class="space-y-5 lg:grid lg:grid-cols-2 lg:gap-8">
            <div class="lg:col-span-1">
              <label class="block text-sm font-bold text-muted-foreground mb-2">项目名称</label>
              <input type="text" v-model="submissionDraft.name" class="w-full px-4 py-3.5 lg:py-3 rounded-xl border border-border bg-card outline-none focus:border-emerald-500 text-base" />
            </div>
            <div class="lg:col-span-1">
              <label class="block text-sm font-bold text-muted-foreground mb-2">开发者</label>
              <input type="text" v-model="submissionDraft.developer" class="w-full px-4 py-3.5 lg:py-3 rounded-xl border border-border bg-card outline-none focus:border-emerald-500 text-base" />
            </div>
            <div class="lg:col-span-2">
              <label class="block text-sm font-bold text-muted-foreground mb-2">GitHub 仓库</label>
              <input type="text" v-model="submissionDraft.github_url" class="w-full px-4 py-3.5 lg:py-3 rounded-xl border border-border bg-card outline-none focus:border-emerald-500 text-base" />
            </div>
            <div class="lg:col-span-2">
              <label class="block text-sm font-bold text-muted-foreground mb-2">简介</label>
              <textarea v-model="submissionDraft.description" rows="3" class="w-full px-4 py-3.5 lg:py-3 rounded-xl border border-border bg-card outline-none focus:border-emerald-500 resize-none text-base"></textarea>
            </div>
            <div class="lg:col-span-1">
              <label class="block text-sm font-bold text-muted-foreground mb-2">功能特性标签（逗号分隔）</label>
              <input type="text" v-model="submissionDraft.keywords" class="w-full px-4 py-3.5 lg:py-3 rounded-xl border border-border bg-card outline-none focus:border-emerald-500 text-base" />
              <p class="text-xs text-muted-foreground mt-2">入库后可由管理员映射到标签注册表，显示在详情侧栏画廊。</p>
            </div>
            <div class="lg:col-span-1">
              <label class="block text-sm font-bold text-muted-foreground mb-2">项目 AI 率是否超过 50%</label>
              <select v-model="submissionDraft.ai_usage_state" class="w-full px-4 py-3.5 lg:py-3 rounded-xl border border-border bg-card outline-none focus:border-emerald-500 text-base">
                <option value="unknown">未知</option>
                <option value="under50">未超过 50%</option>
                <option value="over50">超过 50%</option>
              </select>
            </div>
            <div class="lg:col-span-2">
              <label class="block text-sm font-bold text-muted-foreground mb-2">分类</label>
              <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <select v-model="submissionCategoryId" class="w-full px-4 py-3.5 lg:py-3 rounded-xl border border-border bg-card outline-none focus:border-emerald-500 text-base">
                  <option value="">选择现有分类</option>
                  <option v-for="c in adminCategories" :key="c.id" :value="c.id">{{ c.name }}</option>
                </select>
                <input v-model="submissionNewCategoryName" type="text" placeholder="或新建分类名称" class="w-full px-4 py-3.5 lg:py-3 rounded-xl border border-border bg-card outline-none focus:border-emerald-500 text-base" />
              </div>
              <div class="text-xs text-muted-foreground mt-2">优先使用"选择现有分类"，若填写新分类名称则会自动创建。</div>
            </div>
            <div class="lg:col-span-2">
              <label class="block text-sm font-bold text-muted-foreground mb-2">驳回原因（可选）</label>
              <textarea v-model="submissionReviewNote" rows="2" class="w-full px-4 py-3.5 lg:py-3 rounded-xl border border-border bg-card outline-none focus:border-emerald-500 resize-none text-base"></textarea>
            </div>
          </div>
        </div>
        <div class="p-4 border-t border-border bg-card flex flex-col sm:flex-row gap-3">
          <button @click="approveSubmission" class="flex-1 px-4 py-3.5 lg:py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold transition-colors min-h-[48px]">通过并入库</button>
          <button @click="rejectSubmission" class="flex-1 px-4 py-3.5 lg:py-3 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-bold transition-colors min-h-[48px]">驳回</button>
        </div>
      </div>
    </template>

    <template #empty-detail>
      <div class="h-full min-h-0 flex items-center justify-center border-2 border-dashed border-border rounded-3xl bg-white/50 dark:bg-slate-900/35 backdrop-blur-sm">
        <div class="text-center">
          <p class="text-slate-400 mb-2">从列表选择待审核项目</p>
        </div>
      </div>
    </template>

    <template #list-toolbar>
      <div class="space-y-3">
        <div class="flex gap-2">
          <input v-model="submissionQuery.q" @keyup.enter="resetAndFetchSubmissions" type="text" class="flex-1 px-3 py-3 lg:py-2.5 rounded-xl border border-border bg-card outline-none focus:border-emerald-500 text-sm min-h-[48px]" placeholder="搜索（名称/GitHub）" />
          <button @click="resetAndFetchSubmissions" class="px-4 py-3 lg:py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold transition-colors min-h-[48px]">搜索</button>
        </div>
      </div>
    </template>

    <template #list>
      <div class="space-y-2">
          <div
            v-for="s in submissionsPage.items"
            :key="s.id"
            @click="selectSubmission(s)"
            class="p-3.5 lg:p-3 rounded-xl border cursor-pointer transition-all duration-200 flex items-center gap-3 min-h-[64px]"
            :class="selectedSubmissionId === s.id ? 'bg-[var(--color-brand-50)] dark:bg-[var(--color-brand-500)]/10 border-l-[3px] border-l-[var(--color-brand-500)] border-y border-r border-transparent' : 'bg-card/50 border-transparent hover:bg-accent/80'"
          >
            <component :is="ClipboardCheck" class="w-6 h-6 lg:w-5 lg:h-5 text-slate-400 shrink-0" />
            <div class="flex-1 min-w-0">
              <div class="font-medium text-base lg:text-sm truncate text-foreground">
                <span v-if="s.payload?.kind === 'project_update'">变更：{{ s.payload?.project_name || '未命名' }}</span>
                <span v-else>{{ s.payload?.name || '未命名' }}</span>
              </div>
              <div class="text-sm lg:text-xs text-muted-foreground truncate mt-0.5">
                <span v-if="s.payload?.kind === 'project_update'">{{ s.payload?.actor?.username ? `开发者：${s.payload.actor.username}` : '' }}</span>
                <span v-else>{{ s.payload?.github_url || '' }}</span>
              </div>
            </div>
          </div>
          <ui-EmptyState v-if="submissionsPage.items.length === 0" :icon="ClipboardCheck" title="暂无待审核" />
      </div>
    </template>
  </ui-ListDetailLayout>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { adminFetch, formatAdminError } from '../../composables/useAdminFetch';
import { ListDetailLayout as uiListDetailLayout, EmptyState as uiEmptyState } from '../../components/ui';
import { ClipboardCheck } from 'lucide-vue-next';

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

const submissionsPage = ref<{ items: any[]; page: number; pageSize: number; total: number }>({ items: [], page: 1, pageSize: 30, total: 0 });
const submissionQuery = ref<{ q: string; page: number; pageSize: number }>({ q: '', page: 1, pageSize: 30 });
const submissionsLoading = ref(true);
const submissionsLoadingMore = ref(false);
const submissionsHasMore = computed(() => submissionsPage.value.items.length < submissionsPage.value.total);
const selectedSubmissionId = ref<string | null>(null);
const submissionDraft = ref<any | null>(null);
const submissionKind = ref<'new_project' | 'project_update'>('new_project');
const submissionReviewNote = ref('');
const submissionCategoryId = ref('');
const submissionNewCategoryName = ref('');

const normalizeProjectDraft = (p: any) => {
  const clone = { ...p };
  if (Array.isArray(clone.keywords)) clone.keywords = clone.keywords.join(', ');
  if (!Array.isArray(clone.platform_developers)) clone.platform_developers = [];
  clone.platform_developers = clone.platform_developers.map((d: any) => {
    const legacy = typeof d?.user_id === 'string' ? d.user_id : '';
    const stcn = typeof d?.stcn_user_id === 'string' ? d.stcn_user_id : legacy;
    return { username: typeof d?.username === 'string' ? d.username : '', stcn_user_id: stcn, hzzc_user_id: typeof d?.hzzc_user_id === 'string' ? d.hzzc_user_id : '' };
  });
  if (clone.ai_usage_state !== 'unknown' && clone.ai_usage_state !== 'over50' && clone.ai_usage_state !== 'under50') clone.ai_usage_state = 'unknown';
  return clone;
};

const fetchSubmissions = async (append = false) => {
  if (append) submissionsLoadingMore.value = true;
  else submissionsLoading.value = true;
  try {
    const qs = new URLSearchParams();
    if (submissionQuery.value.q) qs.set('q', submissionQuery.value.q);
    qs.set('status', 'pending');
    qs.set('page', String(submissionQuery.value.page));
    qs.set('pageSize', String(submissionQuery.value.pageSize));
    const res = await adminFetch(`/api/admin/submissions?${qs.toString()}`);
    if (!res.ok) return;
    const json = await res.json();
    const incoming = Array.isArray(json.items) ? json.items : [];
    submissionsPage.value = {
      items: append ? [...submissionsPage.value.items, ...incoming] : incoming,
      page: Number(json.page ?? submissionQuery.value.page ?? 1),
      pageSize: Number(json.pageSize ?? submissionQuery.value.pageSize ?? 30),
      total: Number(json.total ?? (append ? submissionsPage.value.items.length : incoming.length) ?? 0),
    };
  } catch {} finally {
    submissionsLoading.value = false;
    submissionsLoadingMore.value = false;
  }
};

const resetAndFetchSubmissions = async () => {
  submissionQuery.value.page = 1;
  submissionsPage.value = { items: [], page: 1, pageSize: submissionQuery.value.pageSize, total: 0 };
  await fetchSubmissions(false);
};

const loadMoreSubmissions = async () => {
  if (submissionsLoadingMore.value || submissionsLoading.value || !submissionsHasMore.value) return;
  submissionQuery.value.page += 1;
  await fetchSubmissions(true);
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
    description: payload.description ?? '', keywords: payload.keywords ?? payload.tags ?? '',
    ai_usage_state: payload.ai_usage_state ?? 'unknown',
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
  p.keywords = toList(p.keywords);
  delete p.recommendation;
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

onMounted(() => { fetchAdminCategories(); fetchSubmissions(); });
</script>
