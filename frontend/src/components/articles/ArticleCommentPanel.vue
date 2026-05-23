<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { API } from '../../api/endpoints';
import { useAuth } from '../../composables/useAuth';
import { useApi } from '../../composables/useApi';
import { adminFetch } from '../../composables/useAdminFetch';

const props = defineProps<{
  articleSlug: string;
  adminMode?: boolean;
}>();

interface Comment {
  id: string;
  body: string;
  author_user_id: string | null;
  author_username: string;
  author_role: string;
  avatar_url: string | null;
  reply_count?: number;
  created_at: string;
  updated_at: string;
}

const { user } = useAuth();
const { apiFetch } = useApi();
const comments = ref<Comment[]>([]);
const loading = ref(false);
const newBody = ref('');
const submitting = ref(false);
const replyingTo = ref<string | null>(null);
const replyBody = ref('');
const repliesMap = ref<Record<string, Comment[]>>({});
const expandedReplies = ref<Set<string>>(new Set());

function doFetch(url: string, options?: RequestInit) {
  return props.adminMode ? adminFetch(url, options) : apiFetch(url, options);
}

async function loadComments() {
  loading.value = true;
  try {
    const res = await doFetch(API.catalog.articleComments(props.articleSlug));
    if (res.ok) {
      const data = await res.json();
      comments.value = data.items ?? [];
    }
  } finally {
    loading.value = false;
  }
}

async function submitComment() {
  if (!newBody.value.trim()) return;
  submitting.value = true;
  try {
    const res = await doFetch(API.catalog.articleComments(props.articleSlug), {
      method: 'POST',
      body: JSON.stringify({ body: newBody.value }),
    });
    if (res.ok) {
      newBody.value = '';
      await loadComments();
    }
  } finally {
    submitting.value = false;
  }
}

async function submitReply(parentId: string) {
  if (!replyBody.value.trim()) return;
  submitting.value = true;
  try {
    const res = await doFetch(API.catalog.articleCommentReplies(parentId), {
      method: 'POST',
      body: JSON.stringify({ body: replyBody.value }),
    });
    if (res.ok) {
      replyBody.value = '';
      replyingTo.value = null;
      await loadReplies(parentId);
    }
  } finally {
    submitting.value = false;
  }
}

async function loadReplies(parentId: string) {
  const res = await doFetch(API.catalog.articleCommentReplies(parentId));
  if (res.ok) {
    const data = await res.json();
    repliesMap.value[parentId] = data.items ?? [];
    expandedReplies.value.add(parentId);
  }
}

async function deleteComment(id: string) {
  if (!window.confirm('确定删除此评论？')) return;
  const res = await doFetch(API.admin.articleCommentDelete(id), { method: 'DELETE' });
  if (res.ok) await loadComments();
}

function toggleReplies(parentId: string) {
  if (expandedReplies.value.has(parentId)) {
    expandedReplies.value.delete(parentId);
  } else {
    void loadReplies(parentId);
  }
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

onMounted(loadComments);
watch(() => props.articleSlug, loadComments);
</script>

<template>
  <div class="space-y-4">
    <h3 class="text-lg font-bold">评论</h3>

    <div v-if="user" class="flex gap-2">
      <textarea
        v-model="newBody"
        class="flex-1 text-sm p-2 rounded-lg border border-input bg-background resize-none"
        rows="2"
        placeholder="写下你的评论…"
        @keydown.ctrl.enter="submitComment"
        @keydown.meta.enter="submitComment"
      />
      <button
        type="button"
        class="self-end px-3 py-1.5 text-xs font-bold rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
        :disabled="submitting || !newBody.trim()"
        @click="submitComment"
      >
        发送
      </button>
    </div>
    <p v-else class="text-sm text-muted-foreground">登录后可评论</p>

    <div v-if="loading" class="text-sm text-muted-foreground">加载中…</div>
    <div v-else-if="comments.length === 0" class="text-sm text-muted-foreground">暂无评论</div>

    <div v-for="comment in comments" :key="comment.id" class="space-y-2">
      <div class="flex gap-3 p-3 rounded-lg border border-border bg-card">
        <img
          :src="comment.avatar_url || '/assets/people/placeholder.svg'"
          :alt="comment.author_username"
          class="w-8 h-8 rounded-full object-cover shrink-0"
        />
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <span class="text-sm font-bold">{{ comment.author_username }}</span>
            <span class="text-xs text-muted-foreground">{{ formatTime(comment.created_at) }}</span>
          </div>
          <p class="text-sm mt-1 whitespace-pre-wrap break-words">{{ comment.body }}</p>
          <div class="flex items-center gap-3 mt-2">
            <button
              v-if="user"
              type="button"
              class="text-xs text-muted-foreground hover:text-primary"
              @click="replyingTo = replyingTo === comment.id ? null : comment.id"
            >
              回复
            </button>
            <button
              v-if="comment.reply_count"
              type="button"
              class="text-xs text-muted-foreground hover:text-primary"
              @click="toggleReplies(comment.id)"
            >
              {{ expandedReplies.has(comment.id) ? '收起回复' : `${comment.reply_count} 条回复` }}
            </button>
            <button
              v-if="user?.id === comment.author_user_id"
              type="button"
              class="text-xs text-rose-500 hover:underline"
              @click="deleteComment(comment.id)"
            >
              删除
            </button>
          </div>

          <div v-if="replyingTo === comment.id" class="flex gap-2 mt-2">
            <textarea
              v-model="replyBody"
              class="flex-1 text-xs p-2 rounded border border-input bg-background resize-none"
              rows="2"
              placeholder="回复…"
              @keydown.ctrl.enter="submitReply(comment.id)"
              @keydown.meta.enter="submitReply(comment.id)"
            />
            <button
              type="button"
              class="self-end px-2 py-1 text-xs rounded bg-primary text-primary-foreground disabled:opacity-50"
              :disabled="submitting || !replyBody.trim()"
              @click="submitReply(comment.id)"
            >
              回复
            </button>
          </div>
        </div>
      </div>

      <div v-if="expandedReplies.has(comment.id) && repliesMap[comment.id]" class="ml-11 space-y-2">
        <div
          v-for="reply in repliesMap[comment.id]"
          :key="reply.id"
          class="flex gap-3 p-2 rounded-lg bg-muted/50"
        >
          <img
            :src="reply.avatar_url || '/assets/people/placeholder.svg'"
            :alt="reply.author_username"
            class="w-6 h-6 rounded-full object-cover shrink-0"
          />
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="text-xs font-bold">{{ reply.author_username }}</span>
              <span class="text-xs text-muted-foreground">{{ formatTime(reply.created_at) }}</span>
            </div>
            <p class="text-xs mt-0.5 whitespace-pre-wrap break-words">{{ reply.body }}</p>
            <button
              v-if="user?.id === reply.author_user_id"
              type="button"
              class="text-xs text-rose-500 hover:underline mt-1"
              @click="deleteComment(reply.id)"
            >
              删除
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
