<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Bug, MessageSquare, Send, LogIn, X, CircleDot, CheckCircle2, Bold, Italic, Code, Link as LinkIcon, Image as ImageIcon } from 'lucide-vue-next';
import { useAuth } from '../composables/useAuth';
import MarkdownIt from 'markdown-it';
import DOMPurify from 'dompurify';

type CommentKind = 'comment' | 'bug';

type EntryBase = {
  id: string;
  kind: CommentKind;
  project_name: string;
  author: string;
  created_at: string;
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

const props = defineProps<{
  projectName: string;
  initialTab?: CommentKind;
  variant?: 'public' | 'dev' | 'ops';
}>();

const router = useRouter();
const route = useRoute();
const { user, isAuthenticated } = useAuth();

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
    created_at: String(item.created_at ?? new Date().toISOString())
  };
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
    const url = `/api/feedback?project_name=${encodeURIComponent(props.projectName)}`;
    const res = await fetch(url);
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error ?? 'load failed');
    const list = Array.isArray(json) ? json : Array.isArray(json?.items) ? json.items : [];
    entries.value = list.map(mapFromApi).filter(Boolean) as Entry[];
  } catch (e: any) {
    loadError.value = e?.message ?? '加载失败';
    entries.value = [];
  } finally {
    isLoadingEntries.value = false;
  }
};

onMounted(fetchEntries);
watch(() => props.projectName, () => { void fetchEntries(); });

const canManageIssueStatus = computed(() => {
  if (props.variant === 'ops') return true;
  if (!isAuthenticated.value) return false;
  const role = user.value?.role;
  return role === 'dev' || role === 'ops';
});

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
    const res = await fetch(`/api/feedback/${encodeURIComponent(id)}`, {
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
  const res = await fetch('/api/upload', { method: 'POST', body: fd });
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
  return 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200/60 dark:border-slate-700';
};

const requireLogin = () => {
  if (!isAuthenticated.value) {
    router.push({ path: '/me', query: { redirect: route.fullPath } });
    return false;
  }
  return true;
};

const submitComment = async () => {
  if (!requireLogin()) return;
  const body = commentBody.value.trim();
  if (!body) return;
  try {
    const res = await fetch('/api/feedback', {
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
    const res = await fetch('/api/feedback', {
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
};

const closeIssue = () => {
  selectedIssueId.value = null;
};

const setIssueStatus = async (id: string, status: IssueStatus) => {
  if (!requireLogin()) return;
  try {
    const res = await fetch(`/api/feedback/${encodeURIComponent(id)}`, {
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
</script>

<template>
  <section class="mt-16 pt-10 border-t border-slate-200 dark:border-slate-800">
    <div class="flex items-end justify-between gap-4 mb-6">
      <div>
        <h2 class="text-2xl font-bold text-slate-900 dark:text-white">评论与反馈</h2>
        <p class="text-slate-500 mt-1">发表评论或提交 Bug 反馈时必须登录。</p>
      </div>
      <div class="hidden sm:flex items-center gap-2">
        <button
          @click="tab = 'comment'"
          class="px-4 py-2 rounded-full font-extrabold transition-colors inline-flex items-center gap-2"
          :class="tab === 'comment' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'bg-white/70 dark:bg-slate-900/30 border border-slate-200/70 dark:border-slate-800/70 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-900/50'"
        >
          <MessageSquare class="w-4 h-4" /> 评论
        </button>
        <button
          @click="tab = 'bug'"
          class="px-4 py-2 rounded-full font-extrabold transition-colors inline-flex items-center gap-2"
          :class="tab === 'bug' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'bg-white/70 dark:bg-slate-900/30 border border-slate-200/70 dark:border-slate-800/70 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-900/50'"
        >
          <Bug class="w-4 h-4" /> Bug 反馈
        </button>
      </div>
    </div>

    <div class="sm:hidden flex gap-2 mb-6">
      <button
        @click="tab = 'comment'"
        class="flex-1 px-4 py-2 rounded-2xl font-extrabold transition-colors"
        :class="tab === 'comment' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'bg-white/70 dark:bg-slate-900/30 border border-slate-200/70 dark:border-slate-800/70 text-slate-600 dark:text-slate-300'"
      >
        评论
      </button>
      <button
        @click="tab = 'bug'"
        class="flex-1 px-4 py-2 rounded-2xl font-extrabold transition-colors"
        :class="tab === 'bug' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'bg-white/70 dark:bg-slate-900/30 border border-slate-200/70 dark:border-slate-800/70 text-slate-600 dark:text-slate-300'"
      >
        Bug
      </button>
    </div>

    <div v-if="tab === 'comment'" class="bg-white dark:bg-[#111827] rounded-3xl p-6 sm:p-8 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
      <div class="space-y-3">
        <textarea
          v-model="commentBody"
          ref="commentEl"
          rows="4"
          class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 outline-none focus:border-emerald-500 resize-none"
          placeholder="支持 Markdown：例如 **加粗**、`代码`、- 列表、[链接](...)"
        ></textarea>

        <div class="flex flex-wrap items-center gap-2">
          <button type="button" @click="onBold('comment')" class="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-extrabold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors inline-flex items-center gap-2">
            <Bold class="w-4 h-4" /> 加粗
          </button>
          <button type="button" @click="onItalic('comment')" class="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-extrabold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors inline-flex items-center gap-2">
            <Italic class="w-4 h-4" /> 斜体
          </button>
          <button type="button" @click="onCode('comment')" class="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-extrabold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors inline-flex items-center gap-2">
            <Code class="w-4 h-4" /> 行内代码
          </button>
          <button type="button" @click="onLink('comment')" class="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-extrabold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors inline-flex items-center gap-2">
            <LinkIcon class="w-4 h-4" /> 链接
          </button>
          <button type="button" @click="onImage('comment')" class="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-extrabold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors inline-flex items-center gap-2">
            <ImageIcon class="w-4 h-4" /> 插入图片
          </button>
        </div>

        <div v-if="!isAuthenticated" class="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 text-slate-700 dark:text-slate-200">
          <div class="font-extrabold">需要登录</div>
          <div class="text-sm text-slate-600 dark:text-slate-300 mt-1">使用智教联盟登录系统登录后即可发布。</div>
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

      <div class="mt-8 space-y-3">
        <div v-if="comments.length === 0" class="text-center py-10 text-slate-500">暂无评论</div>
        <div v-for="e in comments" :key="e.id" class="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30">
          <div class="flex items-center justify-between gap-3">
            <div class="min-w-0">
              <div class="font-extrabold text-slate-900 dark:text-white truncate">{{ e.author }}</div>
              <div class="text-xs text-slate-500 dark:text-slate-400">{{ formatTime(e.created_at) }}</div>
            </div>
          </div>
          <div class="mt-3 prose prose-sm prose-slate dark:prose-invert max-w-none" v-html="renderMarkdown(e.body)"></div>
        </div>
      </div>
    </div>

    <div v-else class="bg-white dark:bg-[#111827] rounded-3xl p-6 sm:p-8 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
      <div class="flex items-end justify-between gap-4">
        <div>
          <div class="text-lg font-extrabold text-slate-900 dark:text-white">新建 Issue</div>
          <div class="text-sm text-slate-500 mt-1">提交后默认“未解决”，之后可在详情里调整状态。</div>
        </div>
      </div>

      <div class="mt-6 space-y-3">
        <input
          v-model="issueTitle"
          class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 outline-none focus:border-emerald-500"
          placeholder="标题（例如：启动后白屏）"
        />
        <div>
          <div class="text-sm font-extrabold text-slate-700 dark:text-slate-300 mb-2">标签</div>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="l in ISSUE_LABELS"
              :key="l.id"
              type="button"
              @click="issueLabels.includes(l.id) ? issueLabels = issueLabels.filter(x => x !== l.id) : issueLabels = [...issueLabels, l.id]"
              class="px-3 py-1.5 rounded-full border text-sm font-extrabold transition-colors"
              :class="issueLabels.includes(l.id) ? labelColorClass(l.color) : 'bg-white/70 dark:bg-slate-900/40 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900/60'"
            >
              {{ l.name }}
            </button>
          </div>
        </div>
        <textarea
          v-model="issueBody"
          ref="issueEl"
          rows="5"
          class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 outline-none focus:border-emerald-500 resize-none"
          placeholder="正文（支持 Markdown）：复现步骤、期望结果、实际结果、截图链接…"
        ></textarea>

        <div class="flex flex-wrap items-center gap-2">
          <button type="button" @click="onBold('issue')" class="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-extrabold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors inline-flex items-center gap-2">
            <Bold class="w-4 h-4" /> 加粗
          </button>
          <button type="button" @click="onItalic('issue')" class="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-extrabold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors inline-flex items-center gap-2">
            <Italic class="w-4 h-4" /> 斜体
          </button>
          <button type="button" @click="onCode('issue')" class="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-extrabold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors inline-flex items-center gap-2">
            <Code class="w-4 h-4" /> 行内代码
          </button>
          <button type="button" @click="onLink('issue')" class="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-extrabold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors inline-flex items-center gap-2">
            <LinkIcon class="w-4 h-4" /> 链接
          </button>
          <button type="button" @click="onImage('issue')" class="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-extrabold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors inline-flex items-center gap-2">
            <ImageIcon class="w-4 h-4" /> 插入图片
          </button>
        </div>

        <div v-if="!isAuthenticated" class="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 text-slate-700 dark:text-slate-200">
          <div class="font-extrabold">需要登录</div>
          <div class="text-sm text-slate-600 dark:text-slate-300 mt-1">使用智教联盟登录系统登录后即可提交 Issue。</div>
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

      <div class="mt-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div class="text-sm font-extrabold text-slate-700 dark:text-slate-300">筛选</div>
        <div class="flex items-center gap-2">
          <button
            @click="issueFilter = 'open'"
            class="px-3 py-1.5 rounded-full font-extrabold transition-colors border"
            :class="issueFilter === 'open' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white' : 'bg-slate-50 dark:bg-slate-900/40 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'"
          >
            未解决
          </button>
          <button
            @click="issueFilter = 'closed'"
            class="px-3 py-1.5 rounded-full font-extrabold transition-colors border"
            :class="issueFilter === 'closed' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white' : 'bg-slate-50 dark:bg-slate-900/40 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'"
          >
            已解决
          </button>
        </div>
      </div>

      <div class="mt-4 space-y-2">
        <div v-if="issues.length === 0" class="text-center py-10 text-slate-500">暂无 Issue</div>
        <button
          v-for="i in issues"
          :key="i.id"
          @click="openIssue(i.id)"
          class="w-full text-left p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30 hover:bg-white dark:hover:bg-slate-900/50 transition-colors"
        >
          <div class="flex items-start gap-3">
            <div class="mt-0.5">
              <CircleDot v-if="i.status !== 'done'" class="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <CheckCircle2 v-else class="w-5 h-5 text-slate-400" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="font-extrabold text-slate-900 dark:text-white truncate">{{ i.title }}</div>
              <div class="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {{ i.author }} · {{ formatTime(i.created_at) }}
              </div>
              <div v-if="i.labels?.length" class="mt-2 flex flex-wrap gap-1.5">
                <span v-for="lid in i.labels" :key="lid" class="px-2 py-0.5 rounded-full border text-xs font-extrabold"
                  :class="labelColorClass((ISSUE_LABELS.find(x => x.id === lid)?.color ?? 'amber') as any)"
                >
                  {{ ISSUE_LABELS.find(x => x.id === lid)?.name ?? lid }}
                </span>
              </div>
            </div>
            <div class="shrink-0 px-2.5 py-1 rounded-full border text-xs font-extrabold" :class="statusClass(i.status)">
              {{ statusLabel(i.status) }}
            </div>
          </div>
        </button>
      </div>
    </div>

    <div v-if="selectedIssue" class="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm" @click.self="closeIssue">
      <div class="w-full max-w-xl h-full bg-white dark:bg-[#0B1120] border-l border-slate-200 dark:border-slate-800 shadow-2xl overflow-y-auto">
        <div class="p-6 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-4">
          <div class="min-w-0">
            <div class="text-xl font-extrabold text-slate-900 dark:text-white truncate">{{ selectedIssue.title }}</div>
            <div class="text-sm text-slate-500 mt-1">{{ selectedIssue.author }} · {{ formatTime(selectedIssue.created_at) }}</div>
          </div>
          <button class="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors" @click="closeIssue" aria-label="Close">
            <X class="w-5 h-5" />
          </button>
        </div>

        <div class="p-6 space-y-4">
          <div class="flex items-center justify-between gap-3">
            <div class="px-3 py-1.5 rounded-full border text-sm font-extrabold" :class="statusClass(selectedIssue.status)">
              {{ statusLabel(selectedIssue.status) }}
            </div>
            <select
              v-if="canManageIssueStatus"
              :value="selectedIssue.status"
              @change="setIssueStatus(selectedIssue.id, ($event.target as HTMLSelectElement).value as any)"
              class="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 font-extrabold outline-none"
            >
              <option value="open">未处理</option>
              <option value="doing">处理中</option>
              <option value="done">已解决</option>
            </select>
          </div>

          <div class="space-y-2">
            <div class="text-sm font-extrabold text-slate-700 dark:text-slate-300">标签</div>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="l in ISSUE_LABELS"
                :key="l.id"
                type="button"
                :disabled="!isAuthenticated && !canManageIssueStatus"
                @click="toggleIssueLabel(l.id)"
                class="px-3 py-1.5 rounded-full border text-sm font-extrabold transition-colors disabled:opacity-50"
                :class="selectedIssueLabels.includes(l.id) ? labelColorClass(l.color) : 'bg-white/70 dark:bg-slate-900/40 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900/60'"
              >
                {{ l.name }}
              </button>
            </div>
            <button
              v-if="isAuthenticated"
              @click="setIssueLabels(selectedIssue.id, selectedIssueLabels)"
              class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-extrabold transition-colors"
            >
              保存标签
            </button>
          </div>

          <div class="prose prose-slate dark:prose-invert max-w-none" v-html="renderMarkdown(selectedIssue.body)"></div>
        </div>
      </div>
    </div>

    <input ref="uploadEl" type="file" accept="image/*" class="hidden" @change="onUploadChange" />
  </section>
</template>
