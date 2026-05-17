<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-bold text-slate-900 dark:text-white">评论管理</h2>
    </div>

    <div class="flex flex-wrap gap-2">
      <select v-model="filterProject" @change="fetchComments" class="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-blue-500 text-sm">
        <option value="">全部项目</option>
        <option v-for="p in projectNames" :key="p" :value="p">{{ p }}</option>
      </select>
    </div>

    <ui-LoadingSpinner v-if="loading" brand="dev" />

    <div v-else-if="comments.length === 0" class="bg-white/72 dark:bg-slate-900/62 backdrop-blur-lg rounded-3xl border border-white/70 dark:border-slate-700/70 shadow-xl shadow-slate-900/8 dark:shadow-black/30">
      <ui-EmptyState :icon="MessageSquare" title="暂无评论" containerClass="p-10" />
    </div>

    <div v-else class="space-y-3">
      <div v-for="comment in comments" :key="comment.id" class="bg-white/72 dark:bg-slate-900/62 backdrop-blur-lg rounded-3xl border border-white/70 dark:border-slate-700/70 shadow-xl shadow-slate-900/8 dark:shadow-black/30 overflow-hidden">
        <div class="p-4 lg:p-5">
          <div class="flex items-start justify-between gap-3">
            <div class="flex-1 min-w-0">
              <p class="text-sm text-slate-900 dark:text-white whitespace-pre-wrap">{{ comment.body || comment.title || '无内容' }}</p>
              <div class="text-xs text-slate-400 mt-2">
                <span>{{ comment.project_name }}</span>
                <span v-if="comment.actor_username"> · {{ comment.actor_username }}</span>
                <span> · {{ formatTime(comment.created_at) }}</span>
              </div>
            </div>
          </div>
          <div class="flex items-center gap-2 mt-3">
            <button @click="openReply(comment)" class="text-xs px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors">
              回复
            </button>
            <button @click="deleteComment(comment.id)" class="text-xs px-2 py-1 rounded-lg bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 font-medium hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors">
              删除
            </button>
          </div>
        </div>
      </div>
    </div>

    <ui-Pagination v-model:page="page" :total="total" :page-size="20" />

    <div v-if="showReplyModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div class="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden">
        <div class="p-6 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <div class="text-xl font-extrabold text-slate-900 dark:text-white">回复评论</div>
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
import { MessageSquare } from 'lucide-vue-next';
import { Pagination as uiPagination, LoadingSpinner as uiLoadingSpinner, EmptyState as uiEmptyState } from '../../components/ui';

const comments = ref<any[]>([]);
const page = ref(1);
const pageSize = ref(20);
const total = ref(0);
const loading = ref(true);
const filterProject = ref('');
const projectNames = ref<string[]>([]);

const showReplyModal = ref(false);
const replyCommentId = ref('');
const replyBody = ref('');
const isReplying = ref(false);

const formatTime = (v: string) => {
  try {
    const d = new Date(v);
    if (isNaN(d.getTime())) return v;
    return d.toLocaleString('zh-CN');
  } catch { return v; }
};

const fetchComments = async () => {
  loading.value = true;
  try {
    const qs = new URLSearchParams();
    if (filterProject.value) qs.set('project', filterProject.value);
    qs.set('page', String(page.value));
    qs.set('pageSize', String(pageSize.value));
    const res = await adminFetch(`${API.dev.comments}?${qs.toString()}`);
    if (res.ok) {
      const json = await res.json();
      comments.value = json.items ?? [];
      total.value = json.total ?? 0;
      const names = new Set<string>();
      for (const c of comments.value) {
        if (c.project_name) names.add(c.project_name);
      }
      projectNames.value = Array.from(names);
    }
  } catch (e) {
    console.error('Fetch dev comments error:', e);
  } finally {
    loading.value = false;
  }
};

const deleteComment = async (id: string) => {
  if (!confirm('确认删除该评论？')) return;
  try {
    const res = await adminFetch(API.dev.commentDetail(id), { method: 'DELETE' });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(formatAdminError(json, '删除失败', res.status));
    }
    await fetchComments();
  } catch (e: unknown) {
    alert(formatAdminError({ message: e instanceof Error ? e.message : '' }, '删除失败'));
  }
};

const openReply = (comment: any) => {
  replyCommentId.value = comment.id;
  replyBody.value = '';
  showReplyModal.value = true;
};

const submitReply = async () => {
  if (!replyBody.value.trim()) return;
  isReplying.value = true;
  try {
    const res = await adminFetch(API.dev.commentReplies(replyCommentId.value), {
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

watch(page, fetchComments);

onMounted(fetchComments);
</script>
