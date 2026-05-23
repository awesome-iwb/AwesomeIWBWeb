<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { adminFetch } from '../../composables/useAdminFetch';
import { API } from '../../api/endpoints';

const props = defineProps<{
  articleId: string;
}>();

interface Annotation {
  id: string;
  anchor_id: string;
  selected_text: string;
  body: string;
  author_user_id: string | null;
  author_username: string;
  resolved: boolean;
  created_at: string;
  avatar_url?: string;
}

const annotations = ref<Annotation[]>([]);
const loading = ref(false);
const showResolved = ref(false);
const newBody = ref('');
const newAnchorId = ref('');
const newSelectedText = ref('');
const submitting = ref(false);

async function loadAnnotations() {
  loading.value = true;
  try {
    const res = await adminFetch(
      `${API.admin.articleAnnotations(props.articleId)}?resolved=${showResolved.value ? 'true' : 'false'}`,
    );
    if (res.ok) {
      const data = await res.json();
      annotations.value = data.items ?? [];
    }
  } finally {
    loading.value = false;
  }
}

async function createAnnotation() {
  if (!newBody.value.trim() || !newAnchorId.value) return;
  submitting.value = true;
  try {
    const res = await adminFetch(API.admin.articleAnnotations(props.articleId), {
      method: 'POST',
      body: JSON.stringify({
        anchor_id: newAnchorId.value,
        selected_text: newSelectedText.value,
        body: newBody.value,
      }),
    });
    if (res.ok) {
      newBody.value = '';
      newAnchorId.value = '';
      newSelectedText.value = '';
      await loadAnnotations();
    }
  } finally {
    submitting.value = false;
  }
}

async function resolveAnnotation(id: string) {
  const res = await adminFetch(API.admin.articleAnnotationDetail(id), {
    method: 'PATCH',
    body: JSON.stringify({ resolved: true }),
  });
  if (res.ok) await loadAnnotations();
}

async function deleteAnnotation(id: string) {
  if (!window.confirm('确定删除此批注？')) return;
  const res = await adminFetch(API.admin.articleAnnotationDetail(id), { method: 'DELETE' });
  if (res.ok) await loadAnnotations();
}

function scrollToAnchor(anchorId: string) {
  const el = document.getElementById(anchorId);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
    setTimeout(() => el.classList.remove('ring-2', 'ring-primary', 'ring-offset-2'), 2000);
  }
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function startAnnotation(anchorId: string, selectedText: string) {
  newAnchorId.value = anchorId;
  newSelectedText.value = selectedText;
}

defineExpose({ startAnnotation, refresh: loadAnnotations });

onMounted(loadAnnotations);
watch(() => props.articleId, loadAnnotations);
</script>

<template>
  <div class="flex flex-col h-full min-h-0">
    <div class="px-3 py-2 text-xs font-bold text-muted-foreground uppercase tracking-wide border-b border-border flex items-center justify-between">
      <span>批注</span>
      <label class="flex items-center gap-1 cursor-pointer">
        <input v-model="showResolved" type="checkbox" class="w-3 h-3" @change="loadAnnotations" />
        <span class="text-xs">已解决</span>
      </label>
    </div>

    <div v-if="newAnchorId" class="shrink-0 p-2 border-b border-border bg-amber-50 dark:bg-amber-900/20">
      <p class="text-xs text-amber-700 dark:text-amber-300 mb-1">批注位置：{{ newAnchorId }}</p>
      <p v-if="newSelectedText" class="text-xs text-muted-foreground italic mb-1">"{{ newSelectedText.slice(0, 60) }}"</p>
      <textarea
        v-model="newBody"
        class="w-full text-xs p-2 rounded border border-input bg-background resize-none"
        rows="2"
        placeholder="写下批注…"
      />
      <div class="flex gap-1 mt-1">
        <button type="button" class="px-2 py-1 text-xs rounded bg-primary text-primary-foreground disabled:opacity-50" :disabled="submitting || !newBody.trim()" @click="createAnnotation">提交</button>
        <button type="button" class="px-2 py-1 text-xs rounded bg-secondary" @click="newAnchorId = ''; newSelectedText = ''">取消</button>
      </div>
    </div>

    <div v-if="loading" class="flex-1 flex items-center justify-center">
      <span class="text-xs text-muted-foreground">加载中…</span>
    </div>
    <div v-else-if="annotations.length === 0" class="flex-1 flex items-center justify-center">
      <span class="text-xs text-muted-foreground">暂无批注</span>
    </div>
    <div v-else class="flex-1 min-h-0 overflow-y-auto p-2 space-y-2">
      <div
        v-for="ann in annotations"
        :key="ann.id"
        class="p-2 rounded-lg border border-border text-sm"
        :class="{ 'opacity-60': ann.resolved }"
      >
        <div class="flex items-center gap-2 mb-1">
          <img v-if="ann.avatar_url" :src="ann.avatar_url" class="w-5 h-5 rounded-full" />
          <span class="text-xs font-bold">{{ ann.author_username }}</span>
          <span class="text-xs text-muted-foreground">{{ formatTime(ann.created_at) }}</span>
        </div>
        <button type="button" class="text-xs text-primary hover:underline mb-1" @click="scrollToAnchor(ann.anchor_id)">
          📍 {{ ann.anchor_id }}
        </button>
        <p v-if="ann.selected_text" class="text-xs text-muted-foreground italic mb-1">"{{ ann.selected_text.slice(0, 80) }}"</p>
        <p class="text-xs whitespace-pre-wrap">{{ ann.body }}</p>
        <div class="flex gap-2 mt-1">
          <button v-if="!ann.resolved" type="button" class="text-xs text-emerald-600 hover:underline" @click="resolveAnnotation(ann.id)">已解决</button>
          <button type="button" class="text-xs text-rose-500 hover:underline" @click="deleteAnnotation(ann.id)">删除</button>
        </div>
      </div>
    </div>
  </div>
</template>
