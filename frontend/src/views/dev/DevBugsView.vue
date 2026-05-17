<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-bold text-slate-900 dark:text-white">Bug 反馈</h2>
    </div>

    <div class="flex flex-wrap gap-2">
      <select v-model="filterStatus" @change="fetchBugs" class="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-blue-500 text-sm">
        <option value="">全部状态</option>
        <option value="open">待处理</option>
        <option value="doing">处理中</option>
        <option value="done">已完成</option>
        <option value="closed">已关闭</option>
      </select>
      <select v-model="filterProject" @change="fetchBugs" class="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-blue-500 text-sm">
        <option value="">全部项目</option>
        <option v-for="p in projectNames" :key="p" :value="p">{{ p }}</option>
      </select>
    </div>

    <ui-LoadingSpinner v-if="loading" brand="dev" />

    <div v-else-if="bugs.length === 0" class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
      <ui-EmptyState :icon="Bug" title="暂无 Bug 反馈" containerClass="p-10" />
    </div>

    <div v-else class="space-y-3">
      <div v-for="bug in bugs" :key="bug.id" class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div class="p-4 lg:p-5">
          <div class="flex items-start justify-between gap-3">
            <div class="flex-1 min-w-0">
              <div class="font-bold text-sm text-slate-900 dark:text-white truncate">{{ bug.title || bug.body?.slice(0, 80) || '无标题' }}</div>
              <div class="text-xs text-slate-400 mt-1">
                <span>{{ bug.project_name }}</span>
                <span v-if="bug.actor_username"> · {{ bug.actor_username }}</span>
                <span> · {{ formatTime(bug.created_at) }}</span>
              </div>
            </div>
            <ui-StatusBadge :status="badgeStatus(bug.status)" :label="badgeLabel(bug.status)" />
          </div>
          <p v-if="bug.body && bug.title" class="text-xs text-slate-500 dark:text-slate-400 mt-2 line-clamp-2">{{ bug.body }}</p>
          <div class="flex items-center gap-2 mt-3">
            <select
              :value="bug.status"
              @change="updateBugStatus(bug.id, ($event.target as HTMLSelectElement).value)"
              class="text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none"
            >
              <option value="open">待处理</option>
              <option value="doing">处理中</option>
              <option value="done">已完成</option>
              <option value="closed">已关闭</option>
            </select>
            <button @click="openReply(bug)" class="text-xs px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors">
              回复
            </button>
          </div>
        </div>
      </div>
    </div>

    <ui-Pagination v-model:page="page" :total="total" :page-size="20" />

    <div v-if="showReplyModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div class="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden">
        <div class="p-6 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <div class="text-xl font-extrabold text-slate-900 dark:text-white">回复 Bug</div>
          <button @click="showReplyModal = false" class="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-500">✕</button>
        </div>
        <div class="p-6 space-y-4">
          <textarea v-model="replyBody" rows="4" class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:border-blue-500 resize-none text-base" placeholder="输入回复内容"></textarea>
          <div class="flex gap-3">
            <button @click="submitReply" :disabled="isReplying || !replyBody.trim()" class="flex-1 px-4 py-3 rounded-2xl bg-blue-500 hover:bg-blue-600 text-white font-bold transition-colors disabled:opacity-50">
              {{ isReplying ? '提交中...' : '提交回复' }}
            </button>
            <button @click="showReplyModal = false" class="flex-1 px-4 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
              取消
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { adminFetch, formatAdminError } from '../../composables/useAdminFetch';
import { API } from '../../api/endpoints';
import { Bug } from 'lucide-vue-next';
import { Pagination as uiPagination, LoadingSpinner as uiLoadingSpinner, EmptyState as uiEmptyState, StatusBadge as uiStatusBadge } from '../../components/ui';

const bugs = ref<any[]>([]);
const page = ref(1);
const pageSize = ref(20);
const total = ref(0);
const loading = ref(true);
const filterStatus = ref('');
const filterProject = ref('');
const projectNames = ref<string[]>([]);

const showReplyModal = ref(false);
const replyBugId = ref('');
const replyBody = ref('');
const isReplying = ref(false);

const formatTime = (v: string) => {
  try {
    const d = new Date(v);
    if (isNaN(d.getTime())) return v;
    return d.toLocaleString('zh-CN');
  } catch { return v; }
};

const badgeStatus = (s: string) => {
  const map: Record<string, string> = { doing: 'pending', done: 'resolved' };
  return map[s] ?? s;
};

const badgeLabel = (s: string) => {
  const map: Record<string, string> = { doing: '处理中', done: '已完成' };
  return map[s] ?? undefined;
};

const fetchBugs = async () => {
  loading.value = true;
  try {
    const qs = new URLSearchParams();
    qs.set('kind', 'bug');
    if (filterStatus.value) qs.set('status', filterStatus.value);
    if (filterProject.value) qs.set('project', filterProject.value);
    qs.set('page', String(page.value));
    qs.set('pageSize', String(pageSize.value));
    const res = await adminFetch(`${API.dev.feedback}?${qs.toString()}`);
    if (res.ok) {
      const json = await res.json();
      bugs.value = json.items ?? [];
      total.value = json.total ?? 0;
      const names = new Set<string>();
      for (const b of bugs.value) {
        if (b.project_name) names.add(b.project_name);
      }
      projectNames.value = Array.from(names);
    }
  } catch (e) {
    console.error('Fetch dev bugs error:', e);
  } finally {
    loading.value = false;
  }
};

const updateBugStatus = async (id: string, status: string) => {
  try {
    const res = await adminFetch(API.dev.feedbackDetail(id), {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(formatAdminError(json, '更新失败', res.status));
    await fetchBugs();
  } catch (e: unknown) {
    alert(formatAdminError({ message: e instanceof Error ? e.message : '' }, '更新失败'));
  }
};

const openReply = (bug: any) => {
  replyBugId.value = bug.id;
  replyBody.value = '';
  showReplyModal.value = true;
};

const submitReply = async () => {
  if (!replyBody.value.trim()) return;
  isReplying.value = true;
  try {
    const res = await adminFetch(API.dev.feedbackReplies(replyBugId.value), {
      method: 'POST',
      body: JSON.stringify({ body: replyBody.value }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(formatAdminError(json, '回复失败', res.status));
    showReplyModal.value = false;
    replyBody.value = '';
  } catch (e: unknown) {
    alert(formatAdminError({ message: e instanceof Error ? e.message : '' }, '回复失败'));
  } finally {
    isReplying.value = false;
  }
};

watch(page, fetchBugs);

onMounted(fetchBugs);
</script>
