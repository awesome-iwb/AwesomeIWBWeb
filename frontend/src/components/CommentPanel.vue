<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  Bug, MessageSquare, Send, LogIn, X, CircleDot, CheckCircle2,
  Bold, Italic, Code, Link as LinkIcon, Image as ImageIcon,
  Reply
} from 'lucide-vue-next';
import { useAuth } from '../composables/useAuth';
import { useApi } from '../composables/useApi';
import { API } from '../api/endpoints';
import MarkdownIt from 'markdown-it';
import DOMPurify from 'dompurify';

type CommentKind = 'comment' | 'bug';

type ModerationStatus = 'pending' | 'approved' | 'rejected';

type EntryBase = {
  id: string;
  kind: CommentKind;
  project_name: string;
  author: string;
  author_avatar_url: string;
  created_at: string;
  moderation_status?: ModerationStatus;
  moderation_id?: string;
};

type CommentEntry = EntryBase & {
  kind: 'comment';
  body: string;
};

type IssueStatus = 'open' | 'doing' | 'done';

type IssueEntry = EntryBase & {
  kind: 'bug';
  title: string;
  body: string;
  status: IssueStatus;
  labels: string[];
};

type Entry = CommentEntry | IssueEntry;

type ReplyItem = {
  id: string;
  feedback_id: string;
  body: string;
  actor_username: string;
  actor_role: string;
  actor_avatar_url: string;
  created_at: string;
};

const props = defineProps<{
  projectName: string;
  initialTab?: CommentKind;
  variant?: 'public' | 'dev' | 'ops';
}>();

const router = useRouter();
const route = useRoute();
const { user, isAuthenticated, hasCapability } = useAuth();
const { apiFetch } = useApi();

const tab = ref<CommentKind>(props.initialTab ?? 'comment');
watch(() => props.initialTab, (v) => { if (v) tab.value = v; });

const md = new MarkdownIt({ breaks: true, linkify: true });
const renderMarkdown = (text: string) => {
  if (!text) return '';
  return DOMPurify.sanitize(md.render(text));
};

const mapFromApi = (item: any): Entry | null => {
  if (!item || typeof item !== 'object') return null;
  const kind: CommentKind = item.kind === 'bug' ? 'bug' : 'comment';
  const base: any = {
    id: String(item.id ?? ''),
    kind,
    project_name: String(item.project_name ?? props.projectName),
    author: String(item.actor_username ?? item.author ?? '用户'),
    author_avatar_url: String(item.actor_avatar_url ?? ''),
    created_at: String(item.created_at ?? new Date().toISOString())
  };
  if (item.moderation_status) {
    base.moderation_status = item.moderation_status;
    base.moderation_id = item.moderation_id;
  }
  if (!base.id) return null;

  if (kind === 'comment') {
    return { ...base, kind: 'comment', body: String(item.body ?? '') };
  }
  const status: IssueStatus = item.status === 'done' || item.status === 'doing' || item.status === 'open' ? item.status : 'open';
  return {
    ...base,
    kind: 'bug',
    title: String(item.title ?? ''),
    body: String(item.body ?? ''),
    status,
    labels: Array.isArray(item.labels) ? item.labels.map((x: any) => String(x).trim()).filter(Boolean) : []
  };
};

const entries = ref<Entry[]>([]);
const isLoadingEntries = ref(false);
const loadError = ref('');

const fetchEntries = async () => {
  isLoadingEntries.value = true;
  loadError.value = '';
  try {
    const url = `${API.feedback.list}?project_name=${encodeURIComponent(props.projectName)}`;
    const res = await apiFetch(url);
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error ?? 'load failed');
    const list = Array.isArray(json) ? json : Array.isArray(json?.items) ? json.items : [];
    entries.value = list.map(mapFromApi).filter((e: Entry | null): e is Entry => {
      if (!e) return false;
      if (e.project_name && e.project_name !== props.projectName) return false;
      return true;
    });
  } catch (e: any) {
    loadError.value = e?.message ?? '加载失败';
    entries.value = [];
  } finally {
    isLoadingEntries.value = false;
  }
};

onMounted(fetchEntries);
watch(() => props.projectName, () => { void fetchEntries(); });

// Permission: can manage issue status if ops/dev OR the original author
const canManageIssue = (issue: IssueEntry) => {
  if (props.variant === 'ops') return true;
  if (!isAuthenticated.value) return false;
  if (hasCapability('comment:manage')) return true;
  return user.value?.name === issue.author;
};

const comments = computed(() => entries.value.filter((e) => e.kind === 'comment') as CommentEntry[]);
const issuesAll = computed(() => entries.value.filter((e) => e.kind === 'bug') as IssueEntry[]);

const issueFilter = ref<'open' | 'closed'>('open');
const issues = computed(() => {
  return issueFilter.value === 'open'
    ? issuesAll.value.filter((i) => i.status !== 'done')
    : issuesAll.value.filter((i) => i.status === 'done');
});

const selectedIssueId = ref<string | null>(null);
const selectedIssue = computed(() => issuesAll.value.find((i) => i.id === selectedIssueId.value) ?? null);

const ISSUE_LABELS = [
  { id: 'type:bug', name: 'Bug', color: 'rose' },
  { id: 'type:feature', name: '功能建议', color: 'emerald' },
  { id: 'type:question', name: '疑问', color: 'sky' },
  { id: 'area:ui', name: 'UI', color: 'violet' },
  { id: 'area:perf', name: '性能', color: 'amber' }
] as const;

const labelColorClass = (color: (typeof ISSUE_LABELS)[number]['color']) => {
  if (color === 'rose') return 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-200/60 dark:border-rose-500/20';
  if (color === 'emerald') return 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200/60 dark:border-emerald-500/20';
  if (color === 'sky') return 'bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-200/60 dark:border-sky-500/20';
  if (color === 'violet') return 'bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-200/60 dark:border-violet-500/20';
  return 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200/60 dark:border-amber-500/20';
};

const selectedIssueLabels = ref<string[]>([]);
watch(selectedIssueId, () => {
  const s = selectedIssue.value;
  selectedIssueLabels.value = s ? s.labels.slice() : [];
});

const toggleIssueLabel = (labelId: string) => {
  if (!isAuthenticated.value) {
    router.push({ path: '/me', query: { redirect: route.fullPath } });
    return;
  }
  const set = new Set(selectedIssueLabels.value);
  if (set.has(labelId)) set.delete(labelId);
  else set.add(labelId);
  selectedIssueLabels.value = Array.from(set);
};

const setIssueLabels = async (id: string, labels: string[]) => {
  if (!requireLogin()) return;
  try {
    const res = await apiFetch(API.feedback.detail(id), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ labels })
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error ?? 'update failed');
    const updated = mapFromApi(json);
    if (!updated || updated.kind !== 'bug') return;
    const list = entries.value.slice();
    const idx = list.findIndex((e) => e.kind === 'bug' && e.id === id);
    if (idx === -1) return;
    list[idx] = updated;
    entries.value = list;
  } catch {}
};

const commentBody = ref('');
const issueTitle = ref('');
const issueBody = ref('');
const issueLabels = ref<string[]>([]);

const commentEl = ref<HTMLTextAreaElement | null>(null);
const issueEl = ref<HTMLTextAreaElement | null>(null);
const uploadEl = ref<HTMLInputElement | null>(null);
const uploadTarget = ref<'comment' | 'issue'>('comment');

const wrapSelection = (el: HTMLTextAreaElement, left: string, right: string) => {
  const start = el.selectionStart ?? 0;
  const end = el.selectionEnd ?? 0;
  const value = el.value ?? '';
  const selected = value.slice(start, end);
  const next = value.slice(0, start) + left + selected + right + value.slice(end);
  el.value = next;
  const cursor = start + left.length + selected.length + right.length;
  el.setSelectionRange(cursor, cursor);
  el.dispatchEvent(new Event('input'));
  el.focus();
};

const insertAtCursor = (el: HTMLTextAreaElement, text: string) => {
  const start = el.selectionStart ?? 0;
  const end = el.selectionEnd ?? 0;
  const value = el.value ?? '';
  const next = value.slice(0, start) + text + value.slice(end);
  el.value = next;
  const cursor = start + text.length;
  el.setSelectionRange(cursor, cursor);
  el.dispatchEvent(new Event('input'));
  el.focus();
};

const onBold = (target: 'comment' | 'issue') => {
  const el = target === 'comment' ? commentEl.value : issueEl.value;
  if (!el) return;
  wrapSelection(el, '**', '**');
};

const onItalic = (target: 'comment' | 'issue') => {
  const el = target === 'comment' ? commentEl.value : issueEl.value;
  if (!el) return;
  wrapSelection(el, '*', '*');
};

const onCode = (target: 'comment' | 'issue') => {
  const el = target === 'comment' ? commentEl.value : issueEl.value;
  if (!el) return;
  wrapSelection(el, '`', '`');
};

const onLink = (target: 'comment' | 'issue') => {
  const el = target === 'comment' ? commentEl.value : issueEl.value;
  if (!el) return;
  insertAtCursor(el, '[文本](https://)');
};

const onImage = (target: 'comment' | 'issue') => {
  if (!requireLogin()) return;
  uploadTarget.value = target;
  uploadEl.value?.click();
};

const uploadImage = async (file: File) => {
  const fd = new FormData();
  fd.append('image', file);
  const res = await apiFetch(API.upload.image, { method: 'POST', body: fd });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error ?? 'upload failed');
  return String(json?.url ?? '');
};

const onUploadChange = async (e: Event) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  try {
    const url = await uploadImage(file);
    const el = uploadTarget.value === 'comment' ? commentEl.value : issueEl.value;
    if (!el) return;
    insertAtCursor(el, `\n![图片](${url})\n`);
  } catch {}
};

const statusLabel = (s?: IssueStatus) => {
  if (s === 'done') return '已解决';
  if (s === 'doing') return '处理中';
  return '未处理';
};

const statusClass = (s?: IssueStatus) => {
  if (s === 'done') return 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200/60 dark:border-emerald-500/20';
  if (s === 'doing') return 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200/60 dark:border-amber-500/20';
  return 'bg-card text-foreground border-border';
};

const requireLogin = () => {
  if (!isAuthenticated.value) {
    router.push({ path: '/me', query: { redirect: route.fullPath } });
    return false;
  }
  return true;
};

const moderationMessage = ref('');

const submitComment = async () => {
  if (!requireLogin()) return;
  const body = commentBody.value.trim();
  if (!body) return;
  try {
    const res = await apiFetch(API.feedback.list, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_name: props.projectName,
        kind: 'comment',
        body,
        actor: { username: user.value?.name ?? '', role: user.value?.role ?? '' }
      })
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error ?? 'submit failed');
    if (json.status === 'pending') {
      moderationMessage.value = json.message || '评论已提交，等待审核';
      commentBody.value = '';
      setTimeout(() => { moderationMessage.value = ''; }, 5000);
      return;
    }
    const created = mapFromApi(json);
    if (!created || created.kind !== 'comment') return;
    entries.value = [created, ...entries.value];
    commentBody.value = '';
  } catch {}
};

const submitIssue = async () => {
  if (!requireLogin()) return;
  const title = issueTitle.value.trim();
  const body = issueBody.value.trim();
  if (!title || !body) return;
  try {
    const res = await apiFetch(API.feedback.list, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_name: props.projectName,
        kind: 'bug',
        title,
        body,
        labels: issueLabels.value.slice(),
        actor: { username: user.value?.name ?? '', role: user.value?.role ?? '' }
      })
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error ?? 'submit failed');
    if (json.status === 'pending') {
      moderationMessage.value = json.message || 'Bug反馈已提交，等待审核';
      issueTitle.value = '';
      issueBody.value = '';
      issueLabels.value = [];
      setTimeout(() => { moderationMessage.value = ''; }, 5000);
      return;
    }
    const created = mapFromApi(json);
    if (!created || created.kind !== 'bug') return;
    entries.value = [created, ...entries.value];
    issueTitle.value = '';
    issueBody.value = '';
    issueLabels.value = [];
  } catch {}
};

const openIssue = (id: string) => {
  selectedIssueId.value = id;
  void fetchReplies(id);
};

const setIssueStatus = async (id: string, status: IssueStatus) => {
  if (!requireLogin()) return;
  try {
    const res = await apiFetch(API.feedback.detail(id), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error ?? 'update failed');
    const updated = mapFromApi(json);
    if (!updated || updated.kind !== 'bug') return;
    const list = entries.value.slice();
    const idx = list.findIndex((e) => e.kind === 'bug' && e.id === id);
    if (idx === -1) return;
    list[idx] = updated;
    entries.value = list;
  } catch {}
};

const formatTime = (iso: string) => {
  try {
    return new Date(iso).toLocaleString('zh-CN');
  } catch {
    return iso;
  }
};

// Modal state - only for issue detail
const isModalOpen = ref(false);
const openModal = () => {
  isModalOpen.value = true;
  document.body.style.overflow = 'hidden';
};
const closeModal = () => {
  isModalOpen.value = false;
  selectedIssueId.value = null;
  replies.value = [];
  document.body.style.overflow = '';
};

// Close on Escape key
const onKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && isModalOpen.value) {
    closeModal();
  }
};

onMounted(() => {
  window.addEventListener('keydown', onKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown);
  document.body.style.overflow = '';
});

// Replies
const replies = ref<ReplyItem[]>([]);
const replyBody = ref('');
const isLoadingReplies = ref(false);
const replyError = ref('');

const fetchReplies = async (feedbackId: string) => {
  isLoadingReplies.value = true;
  replyError.value = '';
  try {
    const res = await apiFetch(API.feedback.replies(feedbackId));
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error ?? 'load failed');
    replies.value = Array.isArray(json) ? json : [];
  } catch (e: any) {
    replyError.value = e?.message ?? '加载回复失败';
    replies.value = [];
  } finally {
    isLoadingReplies.value = false;
  }
};

const submitReply = async () => {
  if (!requireLogin()) return;
  const body = replyBody.value.trim();
  if (!body || !selectedIssueId.value) return;
  replyError.value = '';
  try {
    const res = await apiFetch(API.feedback.replies(selectedIssueId.value), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        body,
        actor: { username: user.value?.name ?? '', role: user.value?.role ?? '' }
      })
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error ?? 'submit failed');
    replies.value = [json, ...replies.value];
    replyBody.value = '';
  } catch (e: any) {
    replyError.value = e?.message ?? '回复失败';
  }
};

const handleIssueClick = (id: string) => {
  openIssue(id);
  openModal();
};
</script>

<template>
  <div class="space-y-6">
    <!-- Tabs -->
    <div class="flex items-center gap-3">
      <button
        @click="tab = 'comment'"
        class="px-4 py-2 rounded-full font-extrabold transition-colors inline-flex items-center gap-2"
        :class="tab === 'comment' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'bg-secondary text-muted-foreground hover:bg-accent'"
      >
        <MessageSquare class="w-4 h-4" /> 评论
      </button>
      <button
        @click="tab = 'bug'"
        class="px-4 py-2 rounded-full font-extrabold transition-colors inline-flex items-center gap-2"
        :class="tab === 'bug' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'bg-secondary text-muted-foreground hover:bg-accent'"
      >
        <Bug class="w-4 h-4" /> Bug 反馈
      </button>
    </div>

    <!-- Comment Tab -->
    <div v-if="tab === 'comment'" class="space-y-6">
      <!-- Comment Form -->
      <div class="space-y-3">
        <textarea
          v-model="commentBody"
          ref="commentEl"
          rows="4"
          class="w-full px-4 py-3 rounded-2xl border border-border bg-card outline-none focus:border-emerald-500 resize-none"
          placeholder="支持 Markdown：例如 **加粗**、`代码`、- 列表、[链接](...)"
        ></textarea>

        <div class="flex flex-wrap items-center gap-2">
          <button type="button" @click="onBold('comment')" class="px-3 py-2 rounded-xl bg-secondary text-foreground font-extrabold hover:bg-accent transition-colors inline-flex items-center gap-2">
            <Bold class="w-4 h-4" /> 加粗
          </button>
          <button type="button" @click="onItalic('comment')" class="px-3 py-2 rounded-xl bg-secondary text-foreground font-extrabold hover:bg-accent transition-colors inline-flex items-center gap-2">
            <Italic class="w-4 h-4" /> 斜体
          </button>
          <button type="button" @click="onCode('comment')" class="px-3 py-2 rounded-xl bg-secondary text-foreground font-extrabold hover:bg-accent transition-colors inline-flex items-center gap-2">
            <Code class="w-4 h-4" /> 行内代码
          </button>
          <button type="button" @click="onLink('comment')" class="px-3 py-2 rounded-xl bg-secondary text-foreground font-extrabold hover:bg-accent transition-colors inline-flex items-center gap-2">
            <LinkIcon class="w-4 h-4" /> 链接
          </button>
          <button type="button" @click="onImage('comment')" class="px-3 py-2 rounded-xl bg-secondary text-foreground font-extrabold hover:bg-accent transition-colors inline-flex items-center gap-2">
            <ImageIcon class="w-4 h-4" /> 插入图片
          </button>
        </div>

        <div v-if="!isAuthenticated" class="p-4 rounded-2xl border border-border bg-card text-foreground">
          <div class="font-extrabold">需要登录</div>
          <div class="text-sm text-muted-foreground mt-1">使用智教联盟登录系统登录后即可发布。</div>
          <button
            @click="router.push({ path: '/me', query: { redirect: route.fullPath } })"
            class="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold transition-colors"
          >
            <LogIn class="w-4 h-4" />
            智教联盟登录
          </button>
        </div>

        <button
          v-if="isAuthenticated"
          @click="submitComment"
          class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold transition-colors"
        >
          <Send class="w-4 h-4" />
          发布评论
        </button>
      </div>

      <!-- Moderation Message -->
      <div v-if="moderationMessage" class="p-4 rounded-2xl border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 text-sm font-extrabold">
        {{ moderationMessage }}
      </div>

      <!-- Comments List -->
      <div class="space-y-3">
        <div v-if="comments.length === 0" class="text-center py-10 text-muted-foreground">暂无评论</div>
        <div v-for="e in comments" :key="e.id" class="p-5 rounded-2xl border" :class="e.moderation_status === 'pending' ? 'border-border bg-secondary opacity-70' : 'border-border bg-card'">
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-3 min-w-0">
              <router-link :to="'/u/' + encodeURIComponent(e.author)" class="shrink-0">
                <img v-if="e.author_avatar_url" :src="e.author_avatar_url" :alt="e.author" class="w-8 h-8 rounded-full object-cover" />
                <div v-else class="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-700 dark:text-emerald-300 text-sm font-extrabold">{{ e.author.charAt(0).toUpperCase() }}</div>
              </router-link>
              <div class="min-w-0">
                <router-link :to="'/u/' + encodeURIComponent(e.author)" class="font-extrabold text-foreground truncate hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">{{ e.author }}</router-link>
                <div class="text-xs text-muted-foreground">{{ formatTime(e.created_at) }}</div>
              </div>
            </div>
            <div v-if="e.moderation_status === 'pending'" class="shrink-0 px-2.5 py-1 rounded-full border text-xs font-extrabold bg-muted text-muted-foreground border-border">
              审核中
            </div>
            <div v-else-if="e.moderation_status === 'rejected'" class="shrink-0 px-2.5 py-1 rounded-full border text-xs font-extrabold bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-200/60 dark:border-rose-500/20">
              审核未通过
            </div>
          </div>
          <div class="mt-3 prose prose-sm prose-slate dark:prose-invert max-w-none" v-html="renderMarkdown(e.body)"></div>
          <div v-if="e.moderation_status === 'pending'" class="mt-2 text-xs text-muted-foreground">
            此评论正在审核中，仅您自己可见
          </div>
          <div v-else-if="e.moderation_status === 'rejected'" class="mt-2 text-xs text-rose-500 dark:text-rose-400">
            此评论审核未通过
          </div>
        </div>
      </div>
    </div>

    <!-- Bug Tab -->
    <div v-else-if="tab === 'bug'" class="space-y-6">
      <!-- Issue Form -->
      <div class="space-y-3">
        <div class="text-lg font-extrabold text-foreground">新建 Issue</div>
        <div class="text-sm text-muted-foreground">提交后默认"未解决"，之后可在详情里调整状态。</div>

        <input
          v-model="issueTitle"
          class="w-full px-4 py-3 rounded-2xl border border-border bg-card outline-none focus:border-emerald-500"
          placeholder="标题（例如：启动后白屏）"
        />
        <div>
          <div class="text-sm font-extrabold text-foreground mb-2">标签</div>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="l in ISSUE_LABELS"
              :key="l.id"
              type="button"
              @click="issueLabels.includes(l.id) ? issueLabels = issueLabels.filter(x => x !== l.id) : issueLabels = [...issueLabels, l.id]"
              class="px-3 py-1.5 rounded-full border text-sm font-extrabold transition-colors"
              :class="issueLabels.includes(l.id) ? labelColorClass(l.color) : 'bg-card text-foreground border-border hover:bg-accent'"
            >
              {{ l.name }}
            </button>
          </div>
        </div>
        <textarea
          v-model="issueBody"
          ref="issueEl"
          rows="5"
          class="w-full px-4 py-3 rounded-2xl border border-border bg-card outline-none focus:border-emerald-500 resize-none"
          placeholder="正文（支持 Markdown）：复现步骤、期望结果、实际结果、截图链接…"
        ></textarea>

        <div class="flex flex-wrap items-center gap-2">
          <button type="button" @click="onBold('issue')" class="px-3 py-2 rounded-xl bg-secondary text-foreground font-extrabold hover:bg-accent transition-colors inline-flex items-center gap-2">
            <Bold class="w-4 h-4" /> 加粗
          </button>
          <button type="button" @click="onItalic('issue')" class="px-3 py-2 rounded-xl bg-secondary text-foreground font-extrabold hover:bg-accent transition-colors inline-flex items-center gap-2">
            <Italic class="w-4 h-4" /> 斜体
          </button>
          <button type="button" @click="onCode('issue')" class="px-3 py-2 rounded-xl bg-secondary text-foreground font-extrabold hover:bg-accent transition-colors inline-flex items-center gap-2">
            <Code class="w-4 h-4" /> 行内代码
          </button>
          <button type="button" @click="onLink('issue')" class="px-3 py-2 rounded-xl bg-secondary text-foreground font-extrabold hover:bg-accent transition-colors inline-flex items-center gap-2">
            <LinkIcon class="w-4 h-4" /> 链接
          </button>
          <button type="button" @click="onImage('issue')" class="px-3 py-2 rounded-xl bg-secondary text-foreground font-extrabold hover:bg-accent transition-colors inline-flex items-center gap-2">
            <ImageIcon class="w-4 h-4" /> 插入图片
          </button>
        </div>

        <div v-if="!isAuthenticated" class="p-4 rounded-2xl border border-border bg-card text-foreground">
          <div class="font-extrabold">需要登录</div>
          <div class="text-sm text-muted-foreground mt-1">使用智教联盟登录系统登录后即可提交 Issue。</div>
          <button
            @click="router.push({ path: '/me', query: { redirect: route.fullPath } })"
            class="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold transition-colors"
          >
            <LogIn class="w-4 h-4" />
            智教联盟登录
          </button>
        </div>

        <button
          v-if="isAuthenticated"
          @click="submitIssue"
          class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold transition-colors"
        >
          <Send class="w-4 h-4" />
          提交 Issue
        </button>
      </div>

      <!-- Moderation Message -->
      <div v-if="moderationMessage" class="p-4 rounded-2xl border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 text-sm font-extrabold">
        {{ moderationMessage }}
      </div>

      <!-- Issue Filter -->
      <div class="flex items-center justify-between gap-3 pt-4 border-t border-border">
        <div class="text-sm font-extrabold text-foreground">筛选</div>
        <div class="flex items-center gap-2">
          <button
            @click="issueFilter = 'open'"
            class="px-3 py-1.5 rounded-full font-extrabold transition-colors border"
            :class="issueFilter === 'open' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white' : 'bg-card text-foreground border-border'"
          >
            未解决
          </button>
          <button
            @click="issueFilter = 'closed'"
            class="px-3 py-1.5 rounded-full font-extrabold transition-colors border"
            :class="issueFilter === 'closed' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white' : 'bg-card/40 text-foreground border-border'"
          >
            已解决
          </button>
        </div>
      </div>

      <!-- Issues List -->
      <div class="space-y-2">
        <div v-if="issues.length === 0" class="text-center py-10 text-slate-500">暂无 Issue</div>
        <button
          v-for="i in issues"
          :key="i.id"
          @click="i.moderation_status === 'pending' ? undefined : handleIssueClick(i.id)"
          class="w-full text-left p-4 rounded-2xl border transition-colors"
          :class="i.moderation_status === 'pending' ? 'border-border bg-secondary opacity-70 cursor-default' : 'border-border bg-card hover:bg-accent'"
        >
          <div class="flex items-start gap-3">
            <div class="mt-0.5">
              <CircleDot v-if="i.status !== 'done'" class="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <CheckCircle2 v-else class="w-5 h-5 text-slate-400" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="font-extrabold text-foreground truncate">{{ i.title }}</div>
              <div class="text-xs text-muted-foreground mt-1">
                <router-link :to="'/u/' + encodeURIComponent(i.author)" class="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">{{ i.author }}</router-link> · {{ formatTime(i.created_at) }}
              </div>
              <div v-if="i.labels?.length" class="mt-2 flex flex-wrap gap-1.5">
                <span v-for="lid in i.labels" :key="lid" class="px-2 py-0.5 rounded-full border text-xs font-extrabold"
                  :class="labelColorClass((ISSUE_LABELS.find(x => x.id === lid)?.color ?? 'amber') as any)"
                >
                  {{ ISSUE_LABELS.find(x => x.id === lid)?.name ?? lid }}
                </span>
              </div>
              <div v-if="i.moderation_status === 'pending'" class="mt-2 text-xs text-muted-foreground">
                此 Bug 反馈正在审核中，仅您自己可见
              </div>
              <div v-else-if="i.moderation_status === 'rejected'" class="mt-2 text-xs text-rose-500 dark:text-rose-400">
                此 Bug 反馈审核未通过
              </div>
            </div>
            <div class="shrink-0 flex flex-col items-end gap-1">
              <div class="px-2.5 py-1 rounded-full border text-xs font-extrabold" :class="statusClass(i.status)">
                {{ statusLabel(i.status) }}
              </div>
              <div v-if="i.moderation_status === 'pending'" class="px-2.5 py-1 rounded-full border text-xs font-extrabold bg-muted text-muted-foreground border-border">
                审核中
              </div>
              <div v-else-if="i.moderation_status === 'rejected'" class="px-2.5 py-1 rounded-full border text-xs font-extrabold bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-200/60 dark:border-rose-500/20">
                审核未通过
              </div>
            </div>
          </div>
        </button>
      </div>
    </div>

    <!-- Centered Modal for Issue Detail -->
    <Transition
      enter-active-class="transition-opacity duration-300 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-200 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isModalOpen"
        class="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
        @click="closeModal"
      >
        <Transition
          enter-active-class="transition-all duration-300 ease-out-expo"
          enter-from-class="opacity-0 scale-95"
          enter-to-class="opacity-100 scale-100"
          leave-active-class="transition-all duration-200 ease-in-expo"
          leave-from-class="opacity-100 scale-100"
          leave-to-class="opacity-0 scale-95"
        >
          <div
            v-if="isModalOpen"
            class="w-full max-w-2xl max-h-[85vh] bg-white dark:bg-[#0B1120] rounded-3xl shadow-2xl flex flex-col border border-border overflow-hidden"
            @click.stop
          >
            <!-- Modal Header -->
            <div class="flex items-center justify-between gap-4 px-6 py-4 border-b border-border shrink-0">
              <div class="font-extrabold text-foreground truncate max-w-xs">
                {{ selectedIssue?.title }}
              </div>
              <button
                @click="closeModal"
                class="p-2 rounded-xl hover:bg-accent transition-colors"
                aria-label="Close"
              >
                <X class="w-5 h-5" />
              </button>
            </div>

            <!-- Modal Content -->
            <div class="flex-1 overflow-y-auto p-6 space-y-6">
              <div v-if="selectedIssue" class="space-y-4">
                <!-- Issue Header Info -->
                <div class="flex items-start justify-between gap-4">
                  <div class="min-w-0 flex-1">
                    <div class="text-xl font-extrabold text-foreground">{{ selectedIssue.title }}</div>
                    <div class="text-sm text-muted-foreground mt-1">{{ selectedIssue.author }} · {{ formatTime(selectedIssue.created_at) }}</div>
                  </div>
                  <div class="px-3 py-1.5 rounded-full border text-sm font-extrabold shrink-0" :class="statusClass(selectedIssue.status)">
                    {{ statusLabel(selectedIssue.status) }}
                  </div>
                </div>

                <!-- Status Control -->
                <div v-if="canManageIssue(selectedIssue)" class="flex items-center gap-3">
                  <span class="text-sm font-extrabold text-muted-foreground">状态：</span>
                  <select
                    :value="selectedIssue.status"
                    @change="setIssueStatus(selectedIssue.id, ($event.target as HTMLSelectElement).value as any)"
                    class="px-3 py-2 rounded-xl border border-border bg-card text-foreground font-extrabold outline-none"
                  >
                    <option value="open">未处理</option>
                    <option value="doing">处理中</option>
                    <option value="done">已解决</option>
                  </select>
                </div>

                <!-- Labels -->
                <div class="space-y-2">
                  <div class="text-sm font-extrabold text-muted-foreground">标签</div>
                  <div class="flex flex-wrap gap-2">
                    <button
                      v-for="l in ISSUE_LABELS"
                      :key="l.id"
                      type="button"
                      :disabled="!canManageIssue(selectedIssue)"
                      @click="toggleIssueLabel(l.id)"
                      class="px-3 py-1.5 rounded-full border text-sm font-extrabold transition-colors disabled:opacity-50"
                      :class="selectedIssueLabels.includes(l.id) ? labelColorClass(l.color) : 'bg-card text-foreground border-border hover:bg-accent'"
                    >
                      {{ l.name }}
                    </button>
                  </div>
                  <button
                    v-if="canManageIssue(selectedIssue)"
                    @click="setIssueLabels(selectedIssue.id, selectedIssueLabels)"
                    class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-extrabold transition-colors"
                  >
                    保存标签
                  </button>
                </div>

                <!-- Body -->
                <div class="prose prose-slate dark:prose-invert max-w-none" v-html="renderMarkdown(selectedIssue.body)"></div>
              </div>

              <!-- Replies Section -->
              <div class="border-t border-border pt-6 space-y-4">
                <div class="text-lg font-extrabold text-foreground flex items-center gap-2">
                  <Reply class="w-5 h-5" />
                  回复
                </div>

                <!-- Reply Form -->
                <div v-if="isAuthenticated" class="space-y-3">
                  <textarea
                    v-model="replyBody"
                    rows="3"
                    class="w-full px-4 py-3 rounded-2xl border border-border bg-card outline-none focus:border-emerald-500 resize-none"
                    placeholder="写下你的回复..."
                  ></textarea>
                  <button
                    @click="submitReply"
                    :disabled="!replyBody.trim()"
                    class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold transition-colors"
                  >
                    <Send class="w-4 h-4" />
                    回复
                  </button>
                </div>
                <div v-else class="p-4 rounded-2xl border border-border bg-card/40 text-foreground">
                  <div class="font-extrabold">需要登录</div>
                  <div class="text-sm text-muted-foreground mt-1">登录后即可回复。</div>
                  <button
                    @click="router.push({ path: '/me', query: { redirect: route.fullPath } })"
                    class="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold transition-colors"
                  >
                    <LogIn class="w-4 h-4" />
                    智教联盟登录
                  </button>
                </div>

                <!-- Reply Error -->
                <div v-if="replyError" class="p-3 rounded-xl border border-rose-200 dark:border-rose-500/20 bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 text-sm font-extrabold">
                  {{ replyError }}
                </div>

                <!-- Replies List -->
                <div class="space-y-3">
                  <div v-if="isLoadingReplies" class="text-center py-4 text-slate-400">加载中...</div>
                  <div v-else-if="replies.length === 0" class="text-center py-6 text-slate-500">暂无回复</div>
                  <div
                    v-for="r in replies"
                    :key="r.id"
                    class="p-4 rounded-2xl border border-border bg-card/30"
                  >
                    <div class="flex items-center justify-between gap-3">
                      <div class="flex items-center gap-2.5">
                        <router-link :to="'/u/' + encodeURIComponent(r.actor_username)" class="shrink-0">
                          <img v-if="r.actor_avatar_url" :src="r.actor_avatar_url" :alt="r.actor_username" class="w-6 h-6 rounded-full object-cover" />
                          <div v-else class="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-700 dark:text-emerald-300 text-xs font-extrabold">{{ r.actor_username.charAt(0).toUpperCase() }}</div>
                        </router-link>
                        <router-link :to="'/u/' + encodeURIComponent(r.actor_username)" class="font-extrabold text-foreground hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">{{ r.actor_username }}</router-link>
                      </div>
                      <div class="text-xs text-muted-foreground">{{ formatTime(r.created_at) }}</div>
                    </div>
                    <div class="mt-2 prose prose-sm prose-slate dark:prose-invert max-w-none" v-html="renderMarkdown(r.body)"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>

    <input ref="uploadEl" type="file" accept="image/*" class="hidden" @change="onUploadChange" />
  </div>
</template>
