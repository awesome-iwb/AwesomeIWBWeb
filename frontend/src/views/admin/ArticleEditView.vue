<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, defineAsyncComponent } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useMediaQuery } from '@vueuse/core';
import {
  ArrowLeft,
  Settings2,
  ExternalLink,
  Trash2,
  Loader2,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Terminal,
  List,
  ListOrdered,
  ListTodo,
  Link as LinkIcon,
  Image as ImageIcon,
  Table as TableIcon,
  Undo2,
  Redo2,
  Heading1,
  Heading2,
  Heading3,
  Users,
  Sigma,
  Vote,
} from 'lucide-vue-next';
import { adminFetch, formatAdminError, uploadFile } from '../../composables/useAdminFetch';
import { useArticleAutosave } from '../../composables/useArticleAutosave';
import { useArticlePresence } from '../../composables/useArticlePresence';
import { useAuth, getAvatarDisplaySrc } from '../../composables/useAuth';
import ArticleContent from '../../components/articles/ArticleContent.vue';
import ArticleEditorOutline from '../../components/articles/ArticleEditorOutline.vue';
import ArticleBacklinksPanel from '../../components/articles/ArticleBacklinksPanel.vue';
import ArticleRevisionPanel from '../../components/articles/ArticleRevisionPanel.vue';
import ArticleCommentPanel from '../../components/articles/ArticleCommentPanel.vue';
import ArticleAnnotationPanel from '../../components/articles/ArticleAnnotationPanel.vue';
import ArticleMetadataSheet, { type ArticleDraft } from '../../components/articles/ArticleMetadataSheet.vue';
import type { MarkdownHeading } from '../../lib/parseMarkdownHeadings';
import { API } from '../../api/endpoints';

const MarkdownEditor = defineAsyncComponent(() => import('../../components/articles/MarkdownEditor.vue'));

const route = useRoute();
const router = useRouter();
const isMobile = useMediaQuery('(max-width: 1023px)');

const articleId = computed(() => String(route.params.id ?? ''));
const loading = ref(true);
const loadError = ref('');
const draft = ref<ArticleDraft>({
  id: '',
  slug: '',
  title: '',
  subtitle: '',
  category: '',
  layout_type: 'hero',
  content_format: 'markdown',
  content: '',
  cover_image: '',
  theme: 'dark',
  projects: [],
  status: 'draft',
  sort_index: 0,
  version: 1,
});

const metadataOpen = ref(false);
const viewMode = ref<'edit' | 'split' | 'preview'>('split');
const mobileTab = ref<'edit' | 'preview' | 'outline' | 'backlinks' | 'revisions' | 'comments' | 'annotations'>('edit');
const sidebarOpen = ref(true);
const sidebarTab = ref<'outline' | 'backlinks' | 'revisions' | 'comments' | 'annotations'>('outline');
const imageUploading = ref(false);
const uploadError = ref('');
const imageInput = ref<HTMLInputElement | null>(null);
const editorRef = ref<InstanceType<typeof MarkdownEditor> | null>(null);
const backlinksRef = ref<InstanceType<typeof ArticleBacklinksPanel> | null>(null);
const annotationPanelRef = ref<InstanceType<typeof ArticleAnnotationPanel> | null>(null);
const previewRef = ref<HTMLDivElement | null>(null);
const annotationPopup = ref<{ x: number; y: number; anchorId: string; selectedText: string } | null>(null);

const activeScrollSource = ref<'editor' | 'preview' | null>(null);
let scrollTimeout: ReturnType<typeof setTimeout> | null = null;

function onEditorScroll(percent: number) {
  if (activeScrollSource.value === 'preview') return;
  activeScrollSource.value = 'editor';
  
  if (previewRef.value) {
    previewRef.value.scrollTop = percent * (previewRef.value.scrollHeight - previewRef.value.clientHeight);
  }
  
  if (scrollTimeout) clearTimeout(scrollTimeout);
  scrollTimeout = setTimeout(() => {
    activeScrollSource.value = null;
  }, 150);
}

function onPreviewScroll(e: Event) {
  if (activeScrollSource.value === 'editor') return;
  activeScrollSource.value = 'preview';
  
  const el = e.target as HTMLElement;
  const denominator = el.scrollHeight - el.clientHeight;
  if (denominator > 0) {
    const percent = el.scrollTop / denominator;
    editorRef.value?.setScrollPercent(percent);
  }
  
  if (scrollTimeout) clearTimeout(scrollTimeout);
  scrollTimeout = setTimeout(() => {
    activeScrollSource.value = null;
  }, 150);
}

const { saveStatus, saveError, saveNow, syncSnapshot, resolveConflict } = useArticleAutosave(
  articleId,
  draft,
  API.admin.articleDetail,
);

const { activeEditors } = useArticlePresence(articleId);
const { user: currentUser } = useAuth();

const isRichEditor = computed(() => ['markdown', 'html', 'latex', 'flarum'].includes(draft.value.content_format));
const isDesktopSplit = computed(() => !isMobile.value && viewMode.value === 'split');
const publicPreviewUrl = computed(() =>
  draft.value.slug ? `/articles/${encodeURIComponent(draft.value.slug)}` : '',
);

const saveStatusLabel = computed(() => {
  switch (saveStatus.value) {
    case 'saving':
      return '保存中…';
    case 'saved':
      return '已保存';
    case 'error':
      return '保存失败';
    case 'dirty':
      return '未保存';
    case 'conflict':
      return '冲突';
    default:
      return '';
  }
});

async function loadArticle() {
  loading.value = true;
  loadError.value = '';
  try {
    const res = await adminFetch(API.admin.articleDetail(articleId.value));
    if (!res.ok) {
      throw new Error(formatAdminError(await res.json().catch(() => ({})), '加载失败', res.status));
    }
    draft.value = await res.json();
    syncSnapshot();
    if (isMobile.value) viewMode.value = 'edit';
  } catch (e: unknown) {
    loadError.value = e instanceof Error ? e.message : '加载失败';
  } finally {
    loading.value = false;
  }
}

async function togglePublish() {
  const publish = draft.value.status !== 'published';
  const res = await adminFetch(API.admin.articlePublish(articleId.value), {
    method: 'POST',
    body: JSON.stringify({ publish }),
  });
  if (!res.ok) {
    uploadError.value = formatAdminError(await res.json().catch(() => ({})), '操作失败', res.status);
    return;
  }
  draft.value = await res.json();
  syncSnapshot();
}

async function deleteArticle() {
  if (!confirm('确定删除这篇文章？')) return;
  const res = await adminFetch(API.admin.articleDetail(articleId.value), { method: 'DELETE' });
  if (!res.ok) {
    uploadError.value = formatAdminError(await res.json().catch(() => ({})), '删除失败', res.status);
    return;
  }
  void router.push({ name: 'admin-stories' });
}

function goBack() {
  void router.push({ name: 'admin-stories' });
}

function openPublicPreview() {
  if (!publicPreviewUrl.value) return;
  window.open(publicPreviewUrl.value, '_blank');
}

async function searchArticles(q: string) {
  const params = new URLSearchParams({ pageSize: '20' });
  if (q) params.set('q', q);
  const res = await adminFetch(`${API.admin.articles}?${params}`);
  if (!res.ok) return [];
  const json = await res.json();
  const items = json.items ?? [];
  return items
    .filter((item: { id: string }) => item.id !== articleId.value)
    .map((item: { slug: string; title: string }) => ({ slug: item.slug, title: item.title }));
}

function insertSnippet(text: string) {
  if (editorRef.value) {
    editorRef.value.insertAtCursor(text);
    return;
  }
  draft.value.content += text;
}

function onOutlineSelect(heading: MarkdownHeading) {
  if (editorRef.value) {
    editorRef.value.scrollToLine(heading.line);
  }
  mobileTab.value = 'edit';
}

const showImageModal = ref(false);
const imageTab = ref<'web' | 'local'>('web');
const webImageUrl = ref('');
const webImageAlt = ref('');

function triggerImageUpload() {
  imageInput.value?.click();
}

function handleImageButtonClick() {
  showImageModal.value = true;
}

function insertWebImage() {
  if (!webImageUrl.value) return;
  const altText = webImageAlt.value.trim() || '图片描述';
  const url = webImageUrl.value.trim();
  const snippet = draft.value.content_format === 'html'
    ? `<img src="${url}" alt="${altText}" />`
    : `![${altText}](${url})`;
  insertSnippet(snippet);
  webImageUrl.value = '';
  webImageAlt.value = '';
  showImageModal.value = false;
}

async function uploadImage(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  imageUploading.value = true;
  uploadError.value = '';
  try {
    const url = await uploadFile(file);
    const altText = file.name.replace(/\.[^.]+$/, '');
    const snippet = draft.value.content_format === 'html'
      ? `<img src="${url}" alt="${altText}" />`
      : `![${altText}](${url})`;
    insertSnippet(snippet);
    showImageModal.value = false;
  } catch (err: unknown) {
    uploadError.value = err instanceof Error ? err.message : '上传失败';
  } finally {
    imageUploading.value = false;
    if (imageInput.value) imageInput.value.value = '';
  }
}

function insertPollTemplate() {
  const template = draft.value.content_format === 'html'
    ? `\n<div class="poll-card-wrapper">\n  <div class="poll-header">\n    <h4>这里写投票标题</h4>\n  </div>\n  <div class="poll-options">\n    <div class="poll-option-item">\n      <div class="poll-option-progress" style="width: 50%"></div>\n      <div class="poll-option-content">\n        <span>选项 1</span>\n        <span>50 票 (50%)</span>\n      </div>\n    </div>\n    <div class="poll-option-item">\n      <div class="poll-option-progress" style="width: 30%"></div>\n      <div class="poll-option-content">\n        <span>选项 2</span>\n        <span>30 票 (30%)</span>\n      </div>\n    </div>\n  </div>\n  <div class="poll-footer">\n    <span>🗳 投票组件</span>\n    <span>共计 80 人参与</span>\n  </div>\n</div>\n`
    : `\n[poll name="你最喜欢的电子白板"]\n- Ink Canvas\n- ClassIsland\n- Class Widgets\n[/poll]\n`;
  insertSnippet(template);
}

function onEditorUploadError(message: string) {
  uploadError.value = message;
}

async function onManualSave(e?: Event) {
  e?.preventDefault();
  const ok = await saveNow();
  if (ok) backlinksRef.value?.refresh();
}

async function onRollback() {
  const res = await adminFetch(API.admin.articleDetail(articleId.value));
  if (res.ok) {
    const data = await res.json();
    Object.assign(draft.value, data);
    syncSnapshot();
  }
}

function onKeyDown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
    e.preventDefault();
    void onManualSave();
  }
}

function onPreviewMouseUp() {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !sel.rangeCount) {
    annotationPopup.value = null;
    return;
  }
  const text = sel.toString().trim();
  if (!text) {
    annotationPopup.value = null;
    return;
  }
  const range = sel.getRangeAt(0);
  let node: Node | null = range.startContainer;
  let anchorId = '';
  while (node) {
    if (node instanceof HTMLElement && node.hasAttribute('data-anchor')) {
      anchorId = node.id || node.getAttribute('id') || '';
      break;
    }
    node = node.parentNode;
  }
  if (!anchorId) {
    annotationPopup.value = null;
    return;
  }
  const rect = range.getBoundingClientRect();
  const container = previewRef.value?.getBoundingClientRect();
  annotationPopup.value = {
    x: rect.left + rect.width / 2 - (container?.left ?? 0),
    y: rect.top - (container?.top ?? 0) - 36,
    anchorId,
    selectedText: text,
  };
}

function createAnnotationFromSelection() {
  if (!annotationPopup.value) return;
  const { anchorId, selectedText } = annotationPopup.value;
  annotationPanelRef.value?.startAnnotation(anchorId, selectedText);
  sidebarTab.value = 'annotations';
  annotationPopup.value = null;
  window.getSelection()?.removeAllRanges();
}

onMounted(() => {
  void loadArticle();
  window.addEventListener('keydown', onKeyDown);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown);
});
</script>

<template>
  <div class="h-full min-h-0 flex flex-col bg-background">
    <header class="shrink-0 px-3 sm:px-4 py-2 border-b border-border flex items-center gap-2 flex-wrap">
      <button
        type="button"
        class="w-10 h-10 rounded-xl hover:bg-accent flex items-center justify-center"
        title="返回列表"
        @click="goBack"
      >
        <ArrowLeft class="w-5 h-5" />
      </button>

      <input
        v-model="draft.title"
        type="text"
        class="flex-1 min-w-[140px] px-3 py-2 rounded-xl border border-border bg-card text-sm font-bold"
        placeholder="文章标题"
      />

      <span
        class="text-xs px-2 py-1 rounded-lg"
        :class="{
          'bg-muted text-muted-foreground': saveStatus === 'idle' || saveStatus === 'saved',
          'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300': saveStatus === 'dirty' || saveStatus === 'saving',
          'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400': saveStatus === 'error',
          'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300': saveStatus === 'conflict',
        }"
      >
        <Loader2 v-if="saveStatus === 'saving'" class="w-3 h-3 inline animate-spin mr-1" />
        {{ saveStatusLabel }}
      </span>

      <div v-if="activeEditors.length" class="flex items-center gap-1.5 ml-2 px-2 py-1 rounded-lg bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-700/40">
        <Users class="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
        <div class="flex items-center -space-x-1.5">
          <img
            v-for="editor in activeEditors.slice(0, 4)"
            :key="editor.user_id"
            :src="editor.user_avatar_url || '/assets/people/placeholder.svg'"
            :alt="editor.user_name"
            :title="editor.user_name + ' 正在编辑'"
            class="w-5 h-5 rounded-full border-2 border-background object-cover ring-2 ring-brand-300 dark:ring-brand-600"
          />
        </div>
        <span v-if="activeEditors.length > 4" class="text-[10px] font-bold text-brand-600 dark:text-brand-400">
          +{{ activeEditors.length - 4 }}
        </span>
        <span class="text-[10px] font-medium text-brand-600 dark:text-brand-400">协作中</span>
      </div>

      <div class="hidden lg:flex items-center gap-1 bg-muted p-1 rounded-xl">
        <button
          type="button"
          class="px-2 py-1 text-xs rounded-lg"
          :class="viewMode === 'edit' ? 'bg-card shadow' : ''"
          @click="viewMode = 'edit'"
        >
          编辑
        </button>
        <button
          type="button"
          class="px-2 py-1 text-xs rounded-lg"
          :class="viewMode === 'split' ? 'bg-card shadow' : ''"
          @click="viewMode = 'split'"
        >
          双栏
        </button>
        <button
          type="button"
          class="px-2 py-1 text-xs rounded-lg"
          :class="viewMode === 'preview' ? 'bg-card shadow' : ''"
          @click="viewMode = 'preview'"
        >
          预览
        </button>
      </div>

      <div class="flex items-center gap-1 ml-auto">
        <div v-if="currentUser" class="flex items-center gap-1.5 mr-1 px-2 py-1 rounded-lg bg-muted">
          <img
            :src="getAvatarDisplaySrc(currentUser)"
            :alt="currentUser.name"
            class="w-5 h-5 rounded-full object-cover"
          />
          <span class="text-xs text-muted-foreground max-w-[80px] truncate">{{ currentUser.name }}</span>
          <span class="text-[10px] px-1 py-0.5 rounded bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 font-bold">你</span>
        </div>
        <button
          type="button"
          class="h-8 px-2 sm:px-3 rounded-xl text-xs font-bold bg-secondary hover:bg-accent"
          @click="metadataOpen = true"
        >
          <Settings2 class="w-4 h-4 sm:mr-1 inline" />
          <span class="hidden sm:inline">设置</span>
        </button>
        <button
          type="button"
          class="h-8 px-2 sm:px-3 rounded-xl text-xs font-bold bg-secondary hover:bg-accent"
          :disabled="!draft.slug || draft.status !== 'published'"
          @click="openPublicPreview"
        >
          <ExternalLink class="w-4 h-4 sm:mr-1 inline" />
          <span class="hidden sm:inline">预览</span>
        </button>
        <button
          type="button"
          class="h-8 px-3 rounded-xl text-xs font-bold"
          :class="draft.status === 'published' ? 'bg-secondary hover:bg-accent' : 'bg-[var(--color-brand-500)] text-white'"
          @click="togglePublish"
        >
          {{ draft.status === 'published' ? '取消发布' : '发布' }}
        </button>
        <button
          type="button"
          class="h-8 px-3 rounded-xl bg-rose-100 text-rose-600 text-xs font-bold"
          @click="deleteArticle"
        >
          <Trash2 class="w-4 h-4" />
        </button>
      </div>
    </header>

    <div v-if="activeEditors.length" class="shrink-0 px-4 py-1.5 bg-brand-50/80 dark:bg-brand-900/15 border-b border-brand-200 dark:border-brand-700/30 flex items-center gap-2 text-xs text-brand-700 dark:text-brand-300">
      <span class="relative flex h-2 w-2">
        <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75"></span>
        <span class="relative inline-flex rounded-full h-2 w-2 bg-brand-500"></span>
      </span>
      <span>{{ activeEditors.map(e => e.user_name).join('、') }} 正在编辑</span>
    </div>

    <div v-if="loading" class="flex-1 flex items-center justify-center text-muted-foreground text-sm">加载中…</div>
    <div v-else-if="loadError" class="flex-1 flex items-center justify-center text-rose-500 text-sm px-4">{{ loadError }}</div>

    <template v-else>
      <div class="lg:hidden shrink-0 flex border-b border-border overflow-x-auto">
        <button
          v-for="tab in ['edit', 'preview', 'outline', 'comments', 'annotations', 'revisions', 'backlinks'] as const"
          :key="tab"
          type="button"
          class="shrink-0 px-4 py-2 text-xs font-bold whitespace-nowrap"
          :class="mobileTab === tab ? 'text-[var(--color-brand-500)] border-b-2 border-[var(--color-brand-500)]' : 'text-muted-foreground'"
          @click="mobileTab = tab"
        >
          {{ tab === 'edit' ? '编辑' : tab === 'preview' ? '预览' : tab === 'outline' ? '大纲' : tab === 'comments' ? '评论' : tab === 'annotations' ? '批注' : tab === 'revisions' ? '版本' : '链接' }}
        </button>
      </div>

      <div class="flex-1 min-h-0 flex overflow-hidden">
        <aside
          v-show="sidebarOpen"
          class="hidden lg:flex w-56 xl:w-64 shrink-0 flex-col border-r border-border bg-card/40 min-h-0"
        >
          <div class="shrink-0 flex border-b border-border">
            <button
              v-for="tab in (['outline', 'backlinks', 'revisions', 'comments', 'annotations'] as const)"
              :key="tab"
              type="button"
              class="flex-1 py-2 text-xs font-bold"
              :class="sidebarTab === tab ? 'text-[var(--color-brand-500)] border-b-2 border-[var(--color-brand-500)]' : 'text-muted-foreground'"
              @click="sidebarTab = tab"
            >
              {{ tab === 'outline' ? '大纲' : tab === 'backlinks' ? '链接' : tab === 'revisions' ? '版本' : tab === 'comments' ? '评论' : '批注' }}
            </button>
          </div>
          <div class="flex-1 min-h-0 overflow-hidden">
            <ArticleEditorOutline v-show="sidebarTab === 'outline'" :content="draft.content" @select="onOutlineSelect" />
            <ArticleBacklinksPanel v-show="sidebarTab === 'backlinks'" ref="backlinksRef" :article-id="draft.id" />
            <ArticleRevisionPanel v-show="sidebarTab === 'revisions'" :article-id="draft.id" @rollback="onRollback" />
            <div v-show="sidebarTab === 'comments'" class="h-full overflow-y-auto p-2">
              <ArticleCommentPanel v-if="draft.slug" :article-slug="draft.slug" admin-mode />
            </div>
            <ArticleAnnotationPanel v-show="sidebarTab === 'annotations'" ref="annotationPanelRef" :article-id="draft.id" />
          </div>
        </aside>

        <div class="flex-1 min-h-0 flex flex-col overflow-hidden">
          <div
            v-if="isRichEditor"
            class="editor-toolbar shrink-0 flex items-center gap-1.5 px-4 py-2 border-b border-border overflow-x-auto bg-card/60 backdrop-blur-md select-none"
          >
            <!-- Group 1: History -->
            <div class="flex items-center gap-0.5 border-r border-border/80 pr-1.5 mr-1">
              <button type="button" class="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-all active:scale-95 cursor-pointer" title="撤销 (Ctrl+Z)" @click="editorRef?.undo()">
                <Undo2 class="w-4 h-4" />
              </button>
              <button type="button" class="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-all active:scale-95 cursor-pointer" title="重做 (Ctrl+Y)" @click="editorRef?.redo()">
                <Redo2 class="w-4 h-4" />
              </button>
            </div>

            <!-- Group 2: Headings -->
            <div class="flex items-center gap-0.5 border-r border-border/80 pr-1.5 mr-1">
              <button type="button" class="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground font-bold transition-all active:scale-95 cursor-pointer" title="一级标题" @click="editorRef?.toggleHeading(1)">
                <Heading1 class="w-4 h-4" />
              </button>
              <button type="button" class="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground font-bold transition-all active:scale-95 cursor-pointer" title="二级标题" @click="editorRef?.toggleHeading(2)">
                <Heading2 class="w-4 h-4" />
              </button>
              <button type="button" class="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground font-bold transition-all active:scale-95 cursor-pointer" title="三级标题" @click="editorRef?.toggleHeading(3)">
                <Heading3 class="w-4 h-4" />
              </button>
            </div>

            <!-- Group 3: Formatting -->
            <div class="flex items-center gap-0.5 border-r border-border/80 pr-1.5 mr-1">
              <button type="button" class="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-all active:scale-95 cursor-pointer" title="加粗 (Ctrl+B)" @click="editorRef?.toggleBold()">
                <Bold class="w-4 h-4" />
              </button>
              <button type="button" class="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-all active:scale-95 cursor-pointer" title="斜体 (Ctrl+I)" @click="editorRef?.toggleItalic()">
                <Italic class="w-4 h-4" />
              </button>
              <button type="button" class="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-all active:scale-95 cursor-pointer" title="下划线" @click="editorRef?.toggleUnderline()">
                <Underline class="w-4 h-4" />
              </button>
              <button type="button" class="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-all active:scale-95 cursor-pointer" title="删除线" @click="editorRef?.toggleStrikethrough()">
                <Strikethrough class="w-4 h-4" />
              </button>
              <button type="button" class="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-all active:scale-95 cursor-pointer" title="行内代码" @click="editorRef?.toggleCodeInline()">
                <Code class="w-4 h-4" />
              </button>
              <button type="button" class="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-all active:scale-95 cursor-pointer" title="代码块" @click="editorRef?.toggleCodeBlock()">
                <Terminal class="w-4 h-4" />
              </button>
            </div>

            <!-- Group 4: Lists -->
            <div class="flex items-center gap-0.5 border-r border-border/80 pr-1.5 mr-1">
              <button type="button" class="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-all active:scale-95 cursor-pointer" title="无序列表" @click="editorRef?.toggleBulletList()">
                <List class="w-4 h-4" />
              </button>
              <button type="button" class="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-all active:scale-95 cursor-pointer" title="有序列表" @click="editorRef?.toggleOrderedList()">
                <ListOrdered class="w-4 h-4" />
              </button>
              <button type="button" class="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-all active:scale-95 cursor-pointer" title="任务列表" @click="editorRef?.toggleTaskList()">
                <ListTodo class="w-4 h-4" />
              </button>
            </div>

            <!-- Group 5: Inserts -->
            <div class="flex items-center gap-0.5 border-r border-border/80 pr-1.5 mr-1">
              <button type="button" class="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-all active:scale-95 cursor-pointer" title="插入超链接 (Ctrl+K)" @click="editorRef?.insertLink()">
                <LinkIcon class="w-4 h-4" />
              </button>
              <button type="button" class="p-1.5 rounded-lg hover:bg-accent text-emerald-600 hover:text-emerald-700 transition-all active:scale-95 cursor-pointer" title="上传/插入图片" :disabled="imageUploading" @click="handleImageButtonClick">
                <ImageIcon class="w-4 h-4" />
              </button>
              <button type="button" class="p-1.5 rounded-lg hover:bg-accent text-emerald-600 hover:text-emerald-700 transition-all active:scale-95 cursor-pointer" title="插入投票组件" @click="insertPollTemplate">
                <Vote class="w-4 h-4" />
              </button>
              <button type="button" class="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-all active:scale-95 cursor-pointer" title="插入表格" @click="editorRef?.insertTable()">
                <TableIcon class="w-4 h-4" />
              </button>
              <button type="button" class="p-1.5 rounded-lg hover:bg-accent text-purple-600 hover:text-purple-700 transition-all active:scale-95 cursor-pointer" title="插入 LaTeX 公式块" @click="editorRef?.toggleWrapSelection('\n$$\n', '\n$$\n', '公式')">
                <Sigma class="w-4 h-4" />
              </button>
              <input ref="imageInput" type="file" class="hidden" accept="image/*" @change="uploadImage" />
              <span v-if="imageUploading" class="text-xs text-muted-foreground ml-2 animate-pulse">上传中…</span>
            </div>

            <!-- Group 6: Callouts -->
            <div class="flex items-center gap-1.5 pl-0.5">
              <span class="text-xs text-muted-foreground font-semibold">提示盒:</span>
              <button type="button" class="w-5 h-5 rounded-full bg-blue-500 hover:scale-110 active:scale-95 transition-all border border-white/20 shadow-sm cursor-pointer" title="信息卡片 (Note)" @click="editorRef?.insertCallout('note')" />
              <button type="button" class="w-5 h-5 rounded-full bg-emerald-500 hover:scale-110 active:scale-95 transition-all border border-white/20 shadow-sm cursor-pointer" title="成功卡片 (Tip)" @click="editorRef?.insertCallout('tip')" />
              <button type="button" class="w-5 h-5 rounded-full bg-amber-500 hover:scale-110 active:scale-95 transition-all border border-white/20 shadow-sm cursor-pointer" title="警告卡片 (Warning)" @click="editorRef?.insertCallout('warning')" />
              <button type="button" class="w-5 h-5 rounded-full bg-rose-500 hover:scale-110 active:scale-95 transition-all border border-white/20 shadow-sm cursor-pointer" title="错误卡片 (Error)" @click="editorRef?.insertCallout('error')" />
            </div>
          </div>

          <div class="flex-1 min-h-0 flex overflow-hidden">
            <div
              v-show="(!isMobile && viewMode !== 'preview') || (isMobile && mobileTab === 'edit')"
              class="flex-1 min-h-0 overflow-hidden"
              :style="!isMobile && isDesktopSplit ? { flex: '1 1 50%' } : undefined"
            >
              <MarkdownEditor
                v-if="isRichEditor"
                ref="editorRef"
                v-model="draft.content"
                :format="draft.content_format"
                :article-search="searchArticles"
                class="h-full w-full"
                @uploading="imageUploading = $event"
                @upload-error="onEditorUploadError"
                @scroll="onEditorScroll"
              />
              <textarea
                v-else
                ref="fallbackEditorRef"
                v-model="draft.content"
                class="w-full h-full p-4 font-mono text-sm resize-none outline-none"
                placeholder="正文内容…"
              />
            </div>

            <div
              ref="previewRef"
              v-show="(!isMobile && viewMode !== 'edit') || (isMobile && mobileTab === 'preview')"
              class="flex-1 min-h-0 overflow-y-auto p-4 bg-accent/30 border-l border-border relative"
              :style="!isMobile && isDesktopSplit ? { flex: '1 1 50%' } : undefined"
              @mouseup="onPreviewMouseUp"
              @scroll="onPreviewScroll"
            >
              <ArticleContent :format="draft.content_format" :content="draft.content" :enable-anchors="true" />
              <button
                v-if="annotationPopup"
                type="button"
                class="absolute z-50 px-2.5 py-1.5 text-xs font-bold rounded-lg bg-amber-500 text-white shadow-lg shadow-amber-500/25 hover:bg-amber-600 transition-colors whitespace-nowrap"
                :style="{ left: `${annotationPopup.x}px`, top: `${annotationPopup.y}px`, transform: 'translateX(-50%)' }"
                @click="createAnnotationFromSelection"
              >
                📝 添加批注
              </button>
            </div>

            <div
              v-if="isMobile && ['outline', 'backlinks', 'revisions', 'comments', 'annotations'].includes(mobileTab)"
              class="flex-1 min-h-0 overflow-y-auto border-l border-border bg-card/40"
            >
              <ArticleEditorOutline v-show="mobileTab === 'outline'" :content="draft.content" @select="onOutlineSelect" />
              <ArticleBacklinksPanel v-show="mobileTab === 'backlinks'" ref="backlinksRef" :article-id="draft.id" />
              <ArticleRevisionPanel v-show="mobileTab === 'revisions'" :article-id="draft.id" @rollback="onRollback" />
              <div v-show="mobileTab === 'comments'" class="h-full overflow-y-auto p-2">
                <ArticleCommentPanel v-if="draft.slug" :article-slug="draft.slug" admin-mode />
              </div>
              <ArticleAnnotationPanel v-show="mobileTab === 'annotations'" ref="annotationPanelRef" :article-id="draft.id" />
            </div>
          </div>
        </div>
      </div>

      <p v-if="saveError || uploadError" class="shrink-0 px-4 py-2 text-xs text-rose-500 border-t border-border">
        {{ saveError || uploadError }}
        <button v-if="saveStatus === 'error'" type="button" class="ml-2 underline" @click="onManualSave">重试</button>
      </p>

      <div v-if="saveStatus === 'conflict'" class="shrink-0 px-4 py-3 bg-orange-50 dark:bg-orange-900/20 border-t border-orange-200 dark:border-orange-500/20">
        <p class="text-sm font-bold text-orange-700 dark:text-orange-300 mb-2">⚠ 内容冲突</p>
        <p class="text-xs text-orange-600 dark:text-orange-400 mb-3">文章已被他人修改，请选择操作：</p>
        <div class="flex gap-2">
          <button
            type="button"
            class="px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
            @click="resolveConflict('overwrite')"
          >
            用我的版本覆盖
          </button>
          <button
            type="button"
            class="px-3 py-1.5 text-xs font-bold rounded-lg bg-secondary hover:bg-accent"
            @click="resolveConflict('discard')"
          >
            放弃我的修改
          </button>
        </div>
      </div>
    </template>

    <ArticleMetadataSheet v-model:open="metadataOpen" v-model:draft="draft" />

    <!-- Image insert modal dialog -->
    <div v-if="showImageModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-all">
      <div class="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl relative">
        <h3 class="text-base font-bold text-foreground mb-4">插入图片</h3>
        
        <!-- Tab headers -->
        <div class="flex border-b border-border mb-4">
          <button 
            type="button" 
            class="flex-1 pb-2 text-sm font-bold text-center" 
            :class="imageTab === 'web' ? 'text-[var(--color-brand-500)] border-b-2 border-[var(--color-brand-500)]' : 'text-muted-foreground'"
            @click="imageTab = 'web'"
          >
            网络图片
          </button>
          <button 
            type="button" 
            class="flex-1 pb-2 text-sm font-bold text-center" 
            :class="imageTab === 'local' ? 'text-[var(--color-brand-500)] border-b-2 border-[var(--color-brand-500)]' : 'text-muted-foreground'"
            @click="imageTab = 'local'"
          >
            本地上传
          </button>
        </div>
        
        <!-- Web Image Tab Content -->
        <div v-if="imageTab === 'web'" class="space-y-4">
          <div>
            <label class="block text-xs font-bold text-muted-foreground mb-1.5">图片链接 (URL)</label>
            <input 
              v-model="webImageUrl" 
              type="text" 
              class="w-full px-3 py-2 text-sm rounded-xl border border-border bg-card text-foreground"
              placeholder="https://example.com/image.jpg"
              required
            />
          </div>
          <div>
            <label class="block text-xs font-bold text-muted-foreground mb-1.5">图片描述 (Alt Text)</label>
            <input 
              v-model="webImageAlt" 
              type="text" 
              class="w-full px-3 py-2 text-sm rounded-xl border border-border bg-card text-foreground"
              placeholder="图片描述，将显示为图题（可选）"
            />
          </div>
          <div class="flex gap-2 justify-end pt-2">
            <button 
              type="button" 
              class="px-4 py-2 text-xs font-bold rounded-xl bg-secondary hover:bg-accent" 
              @click="showImageModal = false"
            >
              取消
            </button>
            <button 
              type="button" 
              class="px-4 py-2 text-xs font-bold rounded-xl bg-[var(--color-brand-500)] text-white hover:opacity-95" 
              :disabled="!webImageUrl" 
              @click="insertWebImage"
            >
              确认插入
            </button>
          </div>
        </div>
        
        <!-- Local Upload Tab Content -->
        <div v-else class="space-y-4">
          <div 
            class="border-2 border-dashed border-border/85 hover:border-[var(--color-brand-500)] transition-colors rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer select-none"
            @click="triggerImageUpload"
          >
            <Loader2 v-if="imageUploading" class="w-8 h-8 text-[var(--color-brand-500)] animate-spin mb-2" />
            <ImageIcon v-else class="w-8 h-8 text-muted-foreground mb-2" />
            <p class="text-sm font-bold text-foreground">
              {{ imageUploading ? '正在上传...' : '点击选择图片' }}
            </p>
            <p class="text-xs text-muted-foreground mt-1">支持 PNG, JPG, GIF 等格式</p>
          </div>
          <div class="flex justify-end">
            <button 
              type="button" 
              class="px-4 py-2 text-xs font-bold rounded-xl bg-secondary hover:bg-accent" 
              @click="showImageModal = false"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
