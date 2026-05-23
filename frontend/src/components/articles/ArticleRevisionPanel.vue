<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { adminFetch } from '../../composables/useAdminFetch';
import { API } from '../../api/endpoints';

const props = defineProps<{
  articleId: string;
}>();

const emit = defineEmits<{
  rollback: [];
}>();

interface RevisionItem {
  id: string;
  title: string;
  version: number;
  edited_by: string | null;
  created_at: string;
}

const revisions = ref<RevisionItem[]>([]);
const loading = ref(false);
const previewRevision = ref<any>(null);
const previewLoading = ref(false);
const showDiff = ref(false);
const diffLeftId = ref<string | null>(null);
const diffRightId = ref<string | null>(null);
const diffContent = ref<{ left: string; right: string } | null>(null);

async function loadRevisions() {
  loading.value = true;
  try {
    const res = await adminFetch(API.admin.articleRevisions(props.articleId));
    if (res.ok) {
      const data = await res.json();
      revisions.value = data.items ?? [];
    }
  } finally {
    loading.value = false;
  }
}

async function loadRevisionDetail(revId: string) {
  previewLoading.value = true;
  previewRevision.value = null;
  try {
    const res = await adminFetch(API.admin.articleRevisionDetail(props.articleId, revId));
    if (res.ok) {
      previewRevision.value = await res.json();
    }
  } finally {
    previewLoading.value = false;
  }
}

async function doRollback(revId: string) {
  if (!window.confirm('确定回滚到此版本？当前内容将被替换。')) return;
  const res = await adminFetch(API.admin.articleRevisionRollback(props.articleId, revId), { method: 'POST' });
  if (res.ok) {
    emit('rollback');
    await loadRevisions();
  } else {
    alert('回滚失败');
  }
}

async function loadDiff() {
  if (!diffLeftId.value || !diffRightId.value) return;
  const [leftRes, rightRes] = await Promise.all([
    adminFetch(API.admin.articleRevisionDetail(props.articleId, diffLeftId.value)),
    adminFetch(API.admin.articleRevisionDetail(props.articleId, diffRightId.value)),
  ]);
  if (leftRes.ok && rightRes.ok) {
    const [left, right] = await Promise.all([leftRes.json(), rightRes.json()]);
    diffContent.value = { left: left.content ?? '', right: right.content ?? '' };
  }
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

onMounted(loadRevisions);
watch(() => props.articleId, loadRevisions);
</script>

<template>
  <div class="flex flex-col h-full min-h-0">
    <div class="px-3 py-2 text-xs font-bold text-muted-foreground uppercase tracking-wide border-b border-border flex items-center justify-between">
      <span>版本历史</span>
      <button
        type="button"
        class="text-xs text-primary hover:underline"
        @click="showDiff = !showDiff"
      >
        {{ showDiff ? '列表' : '对比' }}
      </button>
    </div>

    <div v-if="showDiff" class="flex-1 min-h-0 overflow-y-auto p-2 space-y-2">
      <p class="text-xs text-muted-foreground">选择两个版本进行对比：</p>
      <select v-model="diffLeftId" class="w-full text-xs p-1.5 rounded border border-input bg-background">
        <option :value="null" disabled>旧版本</option>
        <option v-for="r in revisions" :key="r.id" :value="r.id">v{{ r.version }} - {{ formatTime(r.created_at) }}</option>
      </select>
      <select v-model="diffRightId" class="w-full text-xs p-1.5 rounded border border-input bg-background">
        <option :value="null" disabled>新版本</option>
        <option v-for="r in revisions" :key="r.id" :value="r.id">v{{ r.version }} - {{ formatTime(r.created_at) }}</option>
      </select>
      <button
        type="button"
        class="w-full text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
        :disabled="!diffLeftId || !diffRightId"
        @click="loadDiff"
      >
        对比
      </button>
      <div v-if="diffContent" class="mt-2 text-xs font-mono whitespace-pre-wrap border border-border rounded-lg p-2 overflow-auto max-h-96">
        <div
          v-for="(line, i) in diffContent.right.split('\n')"
          :key="i"
          class="leading-5"
          :class="{
            'bg-emerald-50 dark:bg-emerald-900/20': diffContent.left.split('\n')[i] === undefined,
            'bg-rose-50 dark:bg-rose-900/20': !diffContent.left.split('\n').includes(line) && diffContent.left.split('\n')[i] !== line,
          }"
        >{{ line }}</div>
      </div>
    </div>

    <template v-else>
      <div v-if="loading" class="flex-1 flex items-center justify-center">
        <span class="text-xs text-muted-foreground">加载中…</span>
      </div>
      <div v-else-if="revisions.length === 0" class="flex-1 flex items-center justify-center">
        <span class="text-xs text-muted-foreground">暂无版本记录</span>
      </div>
      <div v-else class="flex-1 min-h-0 overflow-y-auto p-2 space-y-1">
        <button
          v-for="r in revisions"
          :key="r.id"
          type="button"
          class="w-full text-left text-sm py-2 px-2 rounded-lg hover:bg-accent transition-colors"
          @click="loadRevisionDetail(r.id)"
        >
          <div class="flex items-center justify-between">
            <span class="font-mono text-xs text-primary">v{{ r.version }}</span>
            <span class="text-xs text-muted-foreground">{{ formatTime(r.created_at) }}</span>
          </div>
          <div class="text-xs text-muted-foreground truncate mt-0.5">{{ r.title || '无标题' }}</div>
        </button>
      </div>

      <div v-if="previewRevision" class="border-t border-border p-2 space-y-2 max-h-64 overflow-y-auto">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold">v{{ previewRevision.version }} 预览</span>
          <div class="flex gap-1">
            <button
              type="button"
              class="text-xs px-2 py-1 rounded bg-primary text-primary-foreground"
              @click="doRollback(previewRevision.id)"
            >
              回滚
            </button>
            <button type="button" class="text-xs px-2 py-1 rounded bg-secondary" @click="previewRevision = null">关闭</button>
          </div>
        </div>
        <div class="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-20">{{ previewRevision.content }}</div>
      </div>
    </template>
  </div>
</template>
