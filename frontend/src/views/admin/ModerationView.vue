<template>
  <div class="grid grid-cols-1 lg:grid-cols-4 gap-4 lg:gap-8">
    <!-- 审核队列列表 -->
    <div class="lg:col-span-1 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col" :class="{ 'hidden lg:flex': isMobile && mobileView === 'detail' }" style="height: auto; min-height: 400px; max-height: 700px;">
      <div class="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
        <h2 class="font-bold text-lg">内容审核队列</h2>
      </div>
      <div class="p-4 border-b border-slate-100 dark:border-slate-700 space-y-3">
        <div class="flex gap-2">
          <button
            @click="moderationKind = 'comment'"
            class="flex-1 px-3 py-3 lg:py-2 rounded-xl text-base lg:text-sm font-bold transition-colors"
            :class="moderationKind === 'comment' ? 'bg-amber-500 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'"
          >
            评论
          </button>
          <button
            @click="moderationKind = 'bug'"
            class="flex-1 px-3 py-3 lg:py-2 rounded-xl text-base lg:text-sm font-bold transition-colors"
            :class="moderationKind === 'bug' ? 'bg-amber-500 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'"
          >
            Bug反馈
          </button>
        </div>
        <select v-model="moderationStatus" @change="moderationQuery.page = 1; fetchModeration()" class="w-full px-3 py-3 lg:py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-amber-500 text-base lg:text-sm">
          <option value="pending">待审核</option>
          <option value="approved">已通过</option>
          <option value="rejected">已驳回</option>
        </select>
        <button @click="moderationQuery.page = 1; fetchModeration()" class="w-full px-3 py-3 lg:py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-base lg:text-sm font-bold transition-colors">刷新</button>
      </div>
      <div class="flex-1 overflow-y-auto p-4 space-y-2">
        <div
          v-for="m in moderationPage.items"
          :key="m.id"
          @click="selectModeration(m); if (isMobile) openDetail()"
          class="p-3 rounded-xl border cursor-pointer transition-all duration-200"
          :class="selectedModerationId === m.id ? 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/20' : 'bg-slate-50 dark:bg-slate-900/50 border-transparent hover:border-amber-300'"
        >
          <div class="font-bold text-sm truncate">{{ moderationKind === 'comment' ? '评论' : m.title || 'Bug反馈' }}</div>
          <div class="text-xs opacity-80 truncate mt-1">{{ m.project_name }} · {{ m.actor_username }}</div>
          <div class="text-xs opacity-60 mt-1">{{ new Date(m.created_at).toLocaleString() }}</div>
        </div>
        <div v-if="moderationPage.items.length === 0" class="text-sm text-slate-400 text-center py-10">暂无数据</div>
      </div>
      <div class="p-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-sm">
        <button @click="prevModerationPage" :disabled="moderationQuery.page <= 1" class="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed">上一页</button>
        <div class="text-slate-500 dark:text-slate-300">{{ moderationQuery.page }} / {{ Math.max(1, Math.ceil(moderationPage.total / moderationQuery.pageSize)) }}</div>
        <button @click="nextModerationPage" :disabled="moderationQuery.page >= Math.ceil(moderationPage.total / moderationQuery.pageSize)" class="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed">下一页</button>
      </div>
    </div>

    <!-- 审核详情 -->
    <div class="lg:col-span-3 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col" :class="{ 'hidden': isMobile && mobileView === 'list' }" v-if="moderationDraft">
      <div class="p-4 lg:p-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
        <h2 class="text-lg lg:text-xl font-bold text-slate-800 dark:text-white">审核{{ moderationKind === 'comment' ? '评论' : 'Bug反馈' }}</h2>
      </div>
      <div class="flex-1 overflow-y-auto p-4 lg:p-8 space-y-4 lg:space-y-6" style="max-height: 500px;">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
          <div class="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
            <div class="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">项目</div>
            <div class="text-sm text-slate-900 dark:text-white">{{ moderationDraft.project_name }}</div>
          </div>
          <div class="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
            <div class="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">提交者</div>
            <div class="text-sm text-slate-900 dark:text-white">{{ moderationDraft.actor_username }} ({{ moderationDraft.actor_role }})</div>
          </div>
        </div>

        <div v-if="moderationKind === 'bug' && moderationDraft.title" class="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
          <div class="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">标题</div>
          <div class="text-sm text-slate-900 dark:text-white">{{ moderationDraft.title }}</div>
        </div>

        <div class="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
          <div class="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">内容</div>
          <div class="text-sm text-slate-900 dark:text-white whitespace-pre-wrap">{{ moderationDraft.body }}</div>
        </div>

        <div v-if="moderationKind === 'bug' && moderationDraft.labels?.length" class="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
          <div class="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">标签</div>
          <div class="flex flex-wrap gap-2">
            <span v-for="label in moderationDraft.labels" :key="label" class="px-2 py-1 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/20 text-xs font-bold">{{ label }}</span>
          </div>
        </div>

        <div class="space-y-2">
          <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">驳回原因（可选）</label>
          <textarea v-model="moderationReviewNote" rows="2" class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:border-amber-500 resize-none text-base"></textarea>
        </div>

        <div v-if="moderationDraft.status !== 'pending'" class="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
          <div class="text-sm font-bold text-slate-700 dark:text-slate-300">审核状态</div>
          <div class="text-sm mt-1" :class="moderationDraft.status === 'approved' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'">
            {{ moderationDraft.status === 'approved' ? '已通过' : '已驳回' }}
            <span v-if="moderationDraft.review_note"> - {{ moderationDraft.review_note }}</span>
          </div>
        </div>
      </div>
      <!-- 操作栏 -->
      <div class="p-4 border-t border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col sm:flex-row gap-3" v-if="moderationDraft.status === 'pending'">
        <button @click="approveModeration" class="flex-1 px-4 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold transition-colors">通过</button>
        <button @click="rejectModeration" class="flex-1 px-4 py-3 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-bold transition-colors">驳回</button>
      </div>
    </div>
    <div v-else class="lg:col-span-3 flex items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl min-h-[300px] lg:min-h-[700px]" :class="{ 'hidden': isMobile && mobileView === 'list' }">
      <p class="text-slate-400">请在左侧选择一条待审核内容</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { adminFetch, formatAdminError } from '../../composables/useAdminFetch';

// 移动端适配
const isMobile = ref(false);
const mobileView = ref<'list' | 'detail'>('list');
const updateIsMobile = () => {
  if (typeof window !== 'undefined') {
    isMobile.value = window.innerWidth < 1024;
  }
};
onMounted(() => {
  updateIsMobile();
  window.addEventListener('resize', updateIsMobile);
  fetchModeration();
});
onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', updateIsMobile);
  }
});

const openDetail = () => { mobileView.value = 'detail'; };

// 审核状态
const moderationKind = ref<'comment' | 'bug'>('comment');
const moderationStatus = ref<'pending' | 'approved' | 'rejected'>('pending');
const moderationPage = ref<{ items: any[]; page: number; pageSize: number; total: number }>({
  items: [],
  page: 1,
  pageSize: 20,
  total: 0
});
const moderationQuery = ref<{ page: number; pageSize: number }>({ page: 1, pageSize: 20 });
const selectedModerationId = ref<string | null>(null);
const moderationDraft = ref<any | null>(null);
const moderationReviewNote = ref('');

const fetchModeration = async () => {
  try {
    const qs = new URLSearchParams();
    qs.set('status', moderationStatus.value);
    qs.set('page', String(moderationQuery.value.page));
    qs.set('pageSize', String(moderationQuery.value.pageSize));
    const endpoint = moderationKind.value === 'comment'
      ? `/api/admin/moderation/comments?${qs.toString()}`
      : `/api/admin/moderation/bugs?${qs.toString()}`;
    const res = await adminFetch(endpoint);
    if (!res.ok) return;
    const json = await res.json();
    moderationPage.value = json;
  } catch {}
};

const selectModeration = (m: any) => {
  selectedModerationId.value = m.id;
  moderationDraft.value = { ...m };
  moderationReviewNote.value = '';
};

const approveModeration = async () => {
  if (!selectedModerationId.value || !moderationDraft.value) return;
  const endpoint = moderationKind.value === 'comment'
    ? `/api/admin/moderation/comments/${selectedModerationId.value}/approve`
    : `/api/admin/moderation/bugs/${selectedModerationId.value}/approve`;
  const res = await adminFetch(endpoint, { method: 'POST', body: JSON.stringify({}) });
  const json = await res.json();
  if (!res.ok) {
    alert(formatAdminError(json, '审核失败', res.status));
    return;
  }
  alert('已通过');
  moderationDraft.value = null;
  selectedModerationId.value = null;
  await fetchModeration();
};

const rejectModeration = async () => {
  if (!selectedModerationId.value) return;
  const endpoint = moderationKind.value === 'comment'
    ? `/api/admin/moderation/comments/${selectedModerationId.value}/reject`
    : `/api/admin/moderation/bugs/${selectedModerationId.value}/reject`;
  const res = await adminFetch(endpoint, {
    method: 'POST',
    body: JSON.stringify({ review_note: moderationReviewNote.value })
  });
  const json = await res.json();
  if (!res.ok) {
    alert(formatAdminError(json, '驳回失败', res.status));
    return;
  }
  alert('已驳回');
  moderationDraft.value = null;
  selectedModerationId.value = null;
  await fetchModeration();
};

const prevModerationPage = async () => {
  if (moderationQuery.value.page <= 1) return;
  moderationQuery.value.page -= 1;
  await fetchModeration();
};

const nextModerationPage = async () => {
  const maxPage = Math.max(1, Math.ceil(moderationPage.value.total / moderationPage.value.pageSize));
  if (moderationQuery.value.page >= maxPage) return;
  moderationQuery.value.page += 1;
  await fetchModeration();
};

// 切换评论/Bug类型时重新加载
watch(moderationKind, () => {
  moderationQuery.value.page = 1;
  selectedModerationId.value = null;
  moderationDraft.value = null;
  fetchModeration();
});
</script>
