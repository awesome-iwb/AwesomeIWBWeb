<template>
  <div class="grid grid-cols-1 lg:grid-cols-4 gap-4 lg:gap-8">
    <div
      class="lg:col-span-1 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col"
      :class="{ 'hidden lg:flex': isMobile && mobileView === 'detail' }"
      style="height: auto; min-height: 400px; max-height: 700px;"
    >
      <div class="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
        <h2 class="font-bold text-lg">媒体列表</h2>
      </div>
      <div class="p-4 border-b border-slate-100 dark:border-slate-700 space-y-3">
        <input
          v-model="mediaQuery.q"
          @keyup.enter="mediaQuery.page = 1; fetchMediaList()"
          type="text"
          class="w-full px-3 py-3 lg:py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-emerald-500 text-base lg:text-sm"
          placeholder="搜索 URL / MIME / 文件名"
        />
        <select
          v-model="mediaQuery.status"
          @change="mediaQuery.page = 1; fetchMediaList()"
          class="w-full px-3 py-3 lg:py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-emerald-500 text-base lg:text-sm"
        >
          <option value="all">全部状态</option>
          <option value="active">正常</option>
          <option value="deleted">已删除</option>
        </select>
        <select
          v-model="mediaQuery.mime"
          @change="mediaQuery.page = 1; fetchMediaList()"
          class="w-full px-3 py-3 lg:py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-emerald-500 text-base lg:text-sm"
        >
          <option value="">全部类型</option>
          <option value="image/png">image/png</option>
          <option value="image/jpeg">image/jpeg</option>
          <option value="image/webp">image/webp</option>
          <option value="image/gif">image/gif</option>
          <option value="image/svg+xml">image/svg+xml</option>
        </select>
        <div class="relative">
          <select
            v-model="mediaQuery.tag"
            @change="mediaQuery.page = 1; fetchMediaList()"
            class="w-full px-3 py-3 lg:py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-emerald-500 text-base lg:text-sm"
          >
            <option value="">全部标签</option>
            <option v-for="t in allTags" :key="t" :value="t">{{ t }}</option>
          </select>
        </div>
        <div class="flex gap-2">
          <button @click="mediaQuery.page = 1; fetchMediaList()" class="flex-1 px-3 py-3 lg:py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-base lg:text-sm font-bold transition-colors">搜索</button>
          <button @click="resetMediaQuery" class="px-3 py-3 lg:py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-base lg:text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">重置</button>
        </div>
      </div>
      <div class="p-3">
        <MediaBatchActions
          :selected-ids="selectedIds"
          @batch-tag="openBatchTagDialog"
          @batch-delete="handleBatchDelete"
          @clear-selection="clearSelection"
        />
      </div>
      <div class="flex-1 overflow-y-auto p-4 space-y-2">
        <div v-if="mediaLoading" class="text-sm text-slate-400 text-center py-10">加载中...</div>
        <div
          v-else
          v-for="m in mediaPage.items"
          :key="m.id"
          class="p-3 rounded-xl border cursor-pointer transition-all duration-200 flex items-center gap-3"
          :class="selectedMediaId === m.id ? 'bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-500/20' : 'bg-slate-50 dark:bg-slate-900/50 border-transparent hover:border-emerald-300'"
        >
          <input
            type="checkbox"
            :checked="selectedIds.includes(m.id)"
            @click.stop="toggleSelect(m.id)"
            class="w-4 h-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500 shrink-0"
          />
          <div @click="selectMedia(m); if (isMobile) openDetail()" class="flex items-center gap-3 flex-1 min-w-0">
            <img v-if="m.url" :src="m.url" class="w-10 h-10 lg:w-8 lg:h-8 rounded bg-white object-cover shrink-0" />
            <div v-else class="w-10 h-10 lg:w-8 lg:h-8 rounded bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-500 shrink-0">图</div>
            <div class="flex-1 min-w-0">
              <div class="font-medium truncate text-sm">{{ m.mime || '未知类型' }}</div>
              <div class="text-xs opacity-80 truncate">{{ m.url || '-' }}</div>
              <div v-if="m.tags?.length" class="flex flex-wrap gap-1 mt-1">
                <span
                  v-for="tag in m.tags.slice(0, 3)"
                  :key="tag"
                  class="px-1.5 py-0 rounded-full text-[10px] font-medium"
                  :class="selectedMediaId === m.id ? 'bg-emerald-400/30 text-white' : 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'"
                >{{ tag }}</span>
                <span v-if="m.tags.length > 3" class="text-[10px] opacity-60">+{{ m.tags.length - 3 }}</span>
              </div>
            </div>
            <span
              v-if="m._refCount !== undefined"
              class="text-[10px] px-1.5 py-0.5 rounded-full shrink-0"
              :class="selectedMediaId === m.id ? 'bg-white/20 text-white' : 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-300'"
            >{{ m._refCount }} 引用</span>
          </div>
        </div>
        <div v-if="!mediaLoading && mediaPage.items.length === 0" class="text-sm text-slate-400 text-center py-10">暂无数据</div>
      </div>
      <div class="p-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-sm">
        <button @click="prevMediaPage" :disabled="mediaPage.page <= 1 || mediaLoading" class="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed">上一页</button>
        <div class="text-slate-500 dark:text-slate-300">{{ mediaPage.page }} / {{ maxPage }}</div>
        <button @click="nextMediaPage" :disabled="mediaPage.page >= maxPage || mediaLoading" class="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed">下一页</button>
      </div>
    </div>

    <div
      class="lg:col-span-3 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden"
      :class="{ 'hidden': isMobile && mobileView === 'list' }"
      v-if="mediaDraft"
    >
      <div class="p-4 lg:p-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
        <div class="flex items-center gap-3">
          <button v-if="isMobile" @click="backToList" class="p-2 -ml-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
          </button>
          <div>
            <h2 class="text-lg lg:text-xl font-bold text-slate-800 dark:text-white">媒体详情</h2>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">{{ mediaDraft.id }}</p>
          </div>
        </div>
      </div>
      <div class="p-4 lg:p-6 space-y-4">
        <div v-if="mediaError" class="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-300 text-sm">{{ mediaError }}</div>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div class="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-4">
            <img v-if="mediaDraft.url" :src="mediaDraft.url" class="w-full h-56 object-contain rounded-xl bg-white dark:bg-slate-800" />
            <div v-else class="w-full h-56 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500">无预览</div>
          </div>
          <div class="space-y-3">
            <div class="text-sm"><span class="font-bold text-slate-700 dark:text-slate-300">URL：</span><a :href="mediaDraft.url" target="_blank" class="text-emerald-500 break-all hover:underline">{{ mediaDraft.url || '-' }}</a></div>
            <div class="text-sm"><span class="font-bold text-slate-700 dark:text-slate-300">MIME：</span>{{ mediaDraft.mime || '-' }}</div>
            <div class="text-sm"><span class="font-bold text-slate-700 dark:text-slate-300">大小：</span>{{ formatBytes(mediaDraft.size) }}</div>
            <div class="text-sm"><span class="font-bold text-slate-700 dark:text-slate-300">状态：</span>{{ mediaDraft.deleted_at ? '已删除' : '正常' }}</div>
            <div class="text-sm"><span class="font-bold text-slate-700 dark:text-slate-300">创建时间：</span>{{ formatDateTime(mediaDraft.created_at) }}</div>
            <div class="text-sm">
              <span class="font-bold text-slate-700 dark:text-slate-300">标签：</span>
              <div class="mt-1">
                <MediaTagInput v-model="mediaDraftTags" @update:model-value="saveMediaTags" />
              </div>
            </div>
            <div class="text-sm">
              <span class="font-bold text-slate-700 dark:text-slate-300">引用：</span>
              <button @click="toggleInlineRefs" class="ml-2 text-emerald-500 hover:underline text-xs">
                {{ showInlineRefs ? '收起引用' : `查看引用 (${inlineRefCount})` }}
              </button>
            </div>
            <div v-if="showInlineRefs" class="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-3 max-h-48 overflow-y-auto space-y-2">
              <div v-if="inlineRefLoading" class="text-xs text-slate-400 text-center py-4">加载中...</div>
              <div v-else-if="inlineRefs.length === 0" class="text-xs text-slate-400 text-center py-4">暂无引用</div>
              <div v-else v-for="(refItem, idx) in inlineRefs" :key="idx" class="p-2 rounded-lg border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950">
                <pre class="text-[10px] whitespace-pre-wrap break-words text-slate-700 dark:text-slate-200">{{ JSON.stringify(refItem, null, 2) }}</pre>
              </div>
            </div>
            <div class="flex flex-wrap gap-2 pt-2">
              <button v-if="!mediaDraft.deleted_at" @click="softDeleteMedia(mediaDraft.id)" :disabled="mediaActionLoading" class="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold transition-colors">{{ mediaActionLoading ? '处理中...' : '软删除' }}</button>
              <button v-else @click="restoreMedia(mediaDraft.id)" :disabled="mediaActionLoading" class="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold transition-colors">{{ mediaActionLoading ? '处理中...' : '恢复' }}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div
      v-else
      class="lg:col-span-3 flex items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl min-h-[300px] lg:min-h-[700px]"
      :class="{ 'hidden': isMobile && mobileView === 'list' }"
    >
      <p class="text-slate-400">请在左侧选择一个媒体文件</p>
    </div>

    <div v-if="showBatchTagDialog" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div class="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden">
        <div class="p-6 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <div class="text-xl font-extrabold text-slate-900 dark:text-white">批量打标签</div>
          <button @click="showBatchTagDialog = false" class="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold">关闭</button>
        </div>
        <div class="p-6 space-y-4">
          <div>
            <label class="text-sm font-bold text-slate-700 dark:text-slate-300 block mb-1">添加标签</label>
            <MediaTagInput v-model="batchTagsToAdd" />
          </div>
          <div>
            <label class="text-sm font-bold text-slate-700 dark:text-slate-300 block mb-1">移除标签</label>
            <MediaTagInput v-model="batchTagsToRemove" />
          </div>
          <div v-if="batchTagError" class="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-300 text-sm">{{ batchTagError }}</div>
          <button @click="handleBatchTag" :disabled="batchTagLoading" class="w-full px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold transition-colors">
            {{ batchTagLoading ? '处理中...' : `确认（${selectedIds.length} 项）` }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { adminFetch, formatAdminError, formatBytes, formatDateTime } from '../../composables/useAdminFetch';
import MediaTagInput from '../../components/admin/MediaTagInput.vue';
import MediaBatchActions from '../../components/admin/MediaBatchActions.vue';

const isMobile = ref(false);
const updateIsMobile = () => {
  if (typeof window !== 'undefined') {
    isMobile.value = window.innerWidth < 1024;
  }
};
onMounted(() => {
  updateIsMobile();
  window.addEventListener('resize', updateIsMobile);
  fetchMediaList();
});
onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', updateIsMobile);
  }
});

const mobileView = ref<'list' | 'detail'>('list');
const openDetail = () => { mobileView.value = 'detail'; };
const backToList = () => { mobileView.value = 'list'; };

const mediaPage = ref<{ items: any[]; page: number; pageSize: number; total: number }>({
  items: [],
  page: 1,
  pageSize: 20,
  total: 0
});
const mediaQuery = ref<{ status: 'all' | 'active' | 'deleted'; q: string; page: number; pageSize: number; mime: string; tag: string }>({
  status: 'all',
  q: '',
  page: 1,
  pageSize: 20,
  mime: '',
  tag: ''
});
const mediaLoading = ref(false);
const mediaError = ref('');
const selectedMediaId = ref<string | null>(null);
const mediaDraft = ref<any | null>(null);
const mediaActionLoading = ref(false);

const allTags = ref<string[]>([]);

const selectedIds = ref<string[]>([]);

const showBatchTagDialog = ref(false);
const batchTagsToAdd = ref<string[]>([]);
const batchTagsToRemove = ref<string[]>([]);
const batchTagLoading = ref(false);
const batchTagError = ref('');

const showInlineRefs = ref(false);
const inlineRefs = ref<any[]>([]);
const inlineRefLoading = ref(false);
const inlineRefCount = ref(0);

const mediaDraftTags = ref<string[]>([]);

watch(mediaDraft, (draft) => {
  mediaDraftTags.value = Array.isArray(draft?.tags) ? [...draft.tags] : [];
  showInlineRefs.value = false;
  inlineRefs.value = [];
  inlineRefCount.value = 0;
}, { immediate: true });

const maxPage = computed(() => Math.max(1, Math.ceil(mediaPage.value.total / mediaPage.value.pageSize)));

const normalizeMediaPage = (json: any) => {
  const items = Array.isArray(json?.items)
    ? json.items
    : Array.isArray(json)
      ? json
      : [];
  const page = Number(json?.page ?? mediaQuery.value.page ?? 1);
  const pageSize = Number(json?.pageSize ?? mediaQuery.value.pageSize ?? 20);
  const total = Number(json?.total ?? items.length ?? 0);
  return {
    items,
    page: Number.isFinite(page) && page > 0 ? page : 1,
    pageSize: Number.isFinite(pageSize) && pageSize > 0 ? pageSize : 20,
    total: Number.isFinite(total) && total >= 0 ? total : items.length
  };
};

const fetchMediaList = async () => {
  mediaLoading.value = true;
  mediaError.value = '';
  try {
    const qs = new URLSearchParams();
    if (mediaQuery.value.status && mediaQuery.value.status !== 'all') qs.set('status', mediaQuery.value.status);
    if (mediaQuery.value.q.trim()) qs.set('q', mediaQuery.value.q.trim());
    if (mediaQuery.value.mime) qs.set('mime', mediaQuery.value.mime);
    if (mediaQuery.value.tag) qs.set('tag', mediaQuery.value.tag);
    qs.set('page', String(mediaQuery.value.page));
    qs.set('pageSize', String(mediaQuery.value.pageSize));
    const res = await adminFetch(`/api/admin/media?${qs.toString()}`);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(formatAdminError(json, `获取媒体列表失败（${res.status}）`, res.status));
    }
    mediaPage.value = normalizeMediaPage(json);
    collectAllTags(mediaPage.value.items);
    await fetchRefCountBatch(mediaPage.value.items);
  } catch (err: unknown) {
    mediaPage.value = { items: [], page: mediaQuery.value.page, pageSize: mediaQuery.value.pageSize, total: 0 };
    mediaError.value = formatAdminError({ message: err instanceof Error ? err.message : '' }, '获取媒体列表失败');
  } finally {
    mediaLoading.value = false;
  }
};

const collectAllTags = (items: any[]) => {
  const tagSet = new Set<string>();
  for (const item of items) {
    if (Array.isArray(item.tags)) {
      for (const t of item.tags) {
        if (typeof t === 'string' && t.trim()) tagSet.add(t.trim());
      }
    }
  }
  const existing = new Set(allTags.value);
  for (const t of tagSet) existing.add(t);
  allTags.value = Array.from(existing).sort();
};

const fetchRefCountBatch = async (items: any[]) => {
  const promises = items.map(async (item) => {
    try {
      const res = await adminFetch(`/api/admin/media/${item.id}/references`);
      if (res.ok) {
        const json = await res.json().catch(() => ({}));
        const refs = Array.isArray(json?.items) ? json.items : Array.isArray(json) ? json : [];
        item._refCount = refs.length;
      } else {
        item._refCount = 0;
      }
    } catch {
      item._refCount = 0;
    }
  });
  await Promise.allSettled(promises);
};

const selectMedia = (media: any) => {
  selectedMediaId.value = media?.id ?? null;
  mediaDraft.value = media ? { ...media } : null;
  mediaError.value = '';
};

const prevMediaPage = async () => {
  if (mediaPage.value.page <= 1 || mediaLoading.value) return;
  mediaQuery.value.page -= 1;
  await fetchMediaList();
};

const nextMediaPage = async () => {
  if (mediaLoading.value) return;
  if (mediaPage.value.page >= maxPage.value) return;
  mediaQuery.value.page += 1;
  await fetchMediaList();
};

const resetMediaQuery = async () => {
  mediaQuery.value = { status: 'all', q: '', page: 1, pageSize: 20, mime: '', tag: '' };
  await fetchMediaList();
};

const saveMediaTags = async (tags: string[]) => {
  if (!mediaDraft.value?.id) return;
  mediaError.value = '';
  try {
    const res = await adminFetch(`/api/admin/media/${mediaDraft.value.id}/tags`, {
      method: 'PATCH',
      body: JSON.stringify({ tags })
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(formatAdminError(json, `标签更新失败（${res.status}）`, res.status));
    }
    if (mediaDraft.value) {
      mediaDraft.value = { ...mediaDraft.value, tags: [...tags] };
    }
    const idx = mediaPage.value.items.findIndex((m: any) => m.id === mediaDraft.value?.id);
    if (idx !== -1) {
      mediaPage.value.items[idx] = { ...mediaPage.value.items[idx], tags: [...tags] };
    }
    collectAllTags(mediaPage.value.items);
  } catch (err: unknown) {
    mediaError.value = formatAdminError({ message: err instanceof Error ? err.message : '' }, '标签更新失败');
  }
};

const toggleInlineRefs = async () => {
  if (showInlineRefs.value) {
    showInlineRefs.value = false;
    return;
  }
  showInlineRefs.value = true;
  if (!mediaDraft.value?.id) return;
  inlineRefLoading.value = true;
  try {
    const res = await adminFetch(`/api/admin/media/${mediaDraft.value.id}/references`);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      inlineRefs.value = [];
      inlineRefCount.value = 0;
      return;
    }
    inlineRefs.value = Array.isArray(json?.items) ? json.items : Array.isArray(json) ? json : [];
    inlineRefCount.value = inlineRefs.value.length;
  } catch {
    inlineRefs.value = [];
    inlineRefCount.value = 0;
  } finally {
    inlineRefLoading.value = false;
  }
};

const softDeleteMedia = async (id: string) => {
  if (!id) return;
  const ok = confirm('确认软删除该媒体文件？');
  if (!ok) return;
  mediaActionLoading.value = true;
  mediaError.value = '';
  try {
    const res = await adminFetch(`/api/admin/media/${id}`, { method: 'DELETE' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(formatAdminError(json, `软删除失败（${res.status}）`, res.status));
    }
    if (mediaDraft.value?.id === id) {
      mediaDraft.value = { ...mediaDraft.value, deleted_at: json?.deleted_at ?? new Date().toISOString() };
    }
    await fetchMediaList();
    alert('软删除成功');
  } catch (err: unknown) {
    mediaError.value = formatAdminError({ message: err instanceof Error ? err.message : '' }, '软删除失败');
    alert(mediaError.value);
  } finally {
    mediaActionLoading.value = false;
  }
};

const restoreMedia = async (id: string) => {
  if (!id) return;
  mediaActionLoading.value = true;
  mediaError.value = '';
  try {
    const res = await adminFetch(`/api/admin/media/${id}/restore`, { method: 'POST' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(formatAdminError(json, `恢复失败（${res.status}）`, res.status));
    }
    if (mediaDraft.value?.id === id) {
      mediaDraft.value = { ...mediaDraft.value, deleted_at: null };
    }
    await fetchMediaList();
    alert('恢复成功');
  } catch (err: unknown) {
    mediaError.value = formatAdminError({ message: err instanceof Error ? err.message : '' }, '恢复失败');
    alert(mediaError.value);
  } finally {
    mediaActionLoading.value = false;
  }
};

const toggleSelect = (id: string) => {
  const idx = selectedIds.value.indexOf(id);
  if (idx === -1) {
    selectedIds.value.push(id);
  } else {
    selectedIds.value.splice(idx, 1);
  }
};

const clearSelection = () => {
  selectedIds.value = [];
};

const openBatchTagDialog = () => {
  batchTagsToAdd.value = [];
  batchTagsToRemove.value = [];
  batchTagError.value = '';
  showBatchTagDialog.value = true;
};

const handleBatchTag = async () => {
  if (selectedIds.value.length === 0) return;
  if (batchTagsToAdd.value.length === 0 && batchTagsToRemove.value.length === 0) {
    batchTagError.value = '请至少添加或移除一个标签';
    return;
  }
  batchTagLoading.value = true;
  batchTagError.value = '';
  try {
    const res = await adminFetch('/api/admin/media/batch-tag', {
      method: 'POST',
      body: JSON.stringify({
        mediaIds: selectedIds.value,
        tagsToAdd: batchTagsToAdd.value,
        tagsToRemove: batchTagsToRemove.value
      })
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(formatAdminError(json, `批量打标签失败（${res.status}）`, res.status));
    }
    showBatchTagDialog.value = false;
    selectedIds.value = [];
    await fetchMediaList();
    alert('批量打标签成功');
  } catch (err: unknown) {
    batchTagError.value = formatAdminError({ message: err instanceof Error ? err.message : '' }, '批量打标签失败');
  } finally {
    batchTagLoading.value = false;
  }
};

const handleBatchDelete = async () => {
  if (selectedIds.value.length === 0) return;
  const ok = confirm(`确认批量删除 ${selectedIds.value.length} 个媒体文件？`);
  if (!ok) return;
  try {
    const res = await adminFetch('/api/admin/media/batch-delete', {
      method: 'POST',
      body: JSON.stringify({ mediaIds: selectedIds.value })
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(formatAdminError(json, `批量删除失败（${res.status}）`, res.status));
    }
    selectedIds.value = [];
    if (mediaDraft.value && selectedIds.value.includes(mediaDraft.value.id)) {
      mediaDraft.value = null;
      selectedMediaId.value = null;
    }
    await fetchMediaList();
    alert('批量删除成功');
  } catch (err: unknown) {
    alert(formatAdminError({ message: err instanceof Error ? err.message : '' }, '批量删除失败'));
  }
};
</script>
