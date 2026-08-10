<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { Images, ChevronUp, ChevronDown, Trash2, Loader2 } from 'lucide-vue-next';
import { API } from '../../api/endpoints';
import { adminFetch, formatAdminError, uploadFile } from '../../composables/useAdminFetch';
import type { GalleryItem } from '../../composables/useProjects';

const props = withDefaults(
  defineProps<{ projectId: string; mode?: 'dev' | 'admin' }>(),
  { mode: 'dev' }
);

const items = ref<GalleryItem[]>([]);
const loading = ref(false);
const busy = ref(false);
const error = ref('');
const fileInput = ref<HTMLInputElement | null>(null);
const MAX = 24;

const listUrl = () =>
  props.mode === 'dev'
    ? API.dev.projectGallery(props.projectId)
    : API.admin.projectGalleryByProject(props.projectId);

const createUrl = () =>
  props.mode === 'dev' ? API.dev.projectGallery(props.projectId) : API.admin.projectGallery;

const deleteUrl = (id: string) =>
  props.mode === 'dev'
    ? API.dev.projectGalleryItem(props.projectId, id)
    : API.admin.projectGalleryItem(id);

const reorderUrl = () =>
  props.mode === 'dev' ? API.dev.projectGalleryReorder(props.projectId) : API.admin.projectGalleryReorder;

const reorderBody = (orders: Array<{ id: string; sort_index: number }>) =>
  props.mode === 'dev' ? { orders } : { project_id: props.projectId, orders };

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const res = await adminFetch(listUrl());
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      error.value = formatAdminError(payload, '加载详情图失败', res.status);
      items.value = [];
    } else {
      items.value = Array.isArray(payload?.items) ? payload.items : [];
    }
  } catch {
    error.value = '网络错误，加载详情图失败';
  } finally {
    loading.value = false;
  }
}

async function onPick(e: Event) {
  const input = e.target as HTMLInputElement;
  const files = Array.from(input.files ?? []);
  input.value = '';
  if (!files.length) return;
  if (items.value.length + files.length > MAX) {
    error.value = `每个项目最多 ${MAX} 张详情图`;
    return;
  }
  busy.value = true;
  error.value = '';
  try {
    for (const file of files) {
      const url = await uploadFile(file);
      const body =
        props.mode === 'dev'
          ? { media_type: 'image', image_url: url, is_enabled: true }
          : { project_id: props.projectId, media_type: 'image', image_url: url, is_enabled: true };
      const res = await adminFetch(createUrl(), {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const p = await res.json().catch(() => ({}));
        error.value = formatAdminError(p, '添加详情图失败', res.status);
        break;
      }
    }
    await load();
  } catch (err: unknown) {
    error.value = err instanceof Error ? err.message : '上传失败，请重试';
  } finally {
    busy.value = false;
  }
}

async function remove(item: GalleryItem) {
  if (!confirm(`确定删除这张详情图？此操作不可撤销。`)) return;
  busy.value = true;
  error.value = '';
  try {
    const res = await adminFetch(deleteUrl(item.id), { method: 'DELETE' });
    if (!res.ok) {
      const p = await res.json().catch(() => ({}));
      error.value = formatAdminError(p, '删除失败', res.status);
    } else {
      items.value = items.value.filter((i) => i.id !== item.id);
    }
  } catch {
    error.value = '网络错误，删除失败';
  } finally {
    busy.value = false;
  }
}

async function move(index: number, dir: -1 | 1) {
  const target = index + dir;
  if (target < 0 || target >= items.value.length) return;
  const next = [...items.value];
  [next[index], next[target]] = [next[target], next[index]];
  items.value = next;
  const orders = next.map((it, i) => ({ id: it.id, sort_index: i }));
  busy.value = true;
  try {
    const res = await adminFetch(reorderUrl(), {
      method: 'POST',
      body: JSON.stringify(reorderBody(orders)),
    });
    if (!res.ok) {
      const p = await res.json().catch(() => ({}));
      error.value = formatAdminError(p, '排序失败', res.status);
      await load();
    }
  } catch {
    error.value = '网络错误，排序失败';
    await load();
  } finally {
    busy.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="p-4 lg:p-6 rounded-2xl bg-card border border-border">
    <div class="flex items-center justify-between mb-4">
      <label class="block text-sm font-bold text-foreground flex items-center gap-2">
        <Images class="w-4 h-4 text-blue-500" />
        详情图 (Detail Images)
      </label>
      <span
        class="text-blue-500 text-xs cursor-pointer hover:underline flex items-center gap-1"
        :class="{ 'opacity-50 pointer-events-none': busy || items.length >= MAX }"
        @click="fileInput?.click()"
      >
        <Loader2 v-if="busy" class="w-3 h-3 animate-spin" />
        上传图片…
      </span>
      <input
        ref="fileInput"
        type="file"
        accept="image/*"
        multiple
        class="hidden"
        @change="onPick"
      />
    </div>

    <p class="text-xs text-muted-foreground mb-3">
      应用商城式多图展示：支持上传多张、拖拽排序、删除。前台项目详情页会按此顺序轮播。
    </p>

    <div v-if="loading" class="text-sm text-muted-foreground py-6 text-center">加载中…</div>

    <div
      v-else-if="items.length"
      class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3"
    >
      <div
        v-for="(item, index) in items"
        :key="item.id"
        class="relative group rounded-xl border border-border overflow-hidden bg-card"
      >
        <img
          :src="item.image_url"
          :alt="item.title || '详情图'"
          class="w-full h-28 object-cover"
        />
        <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
          <button
            type="button"
            :disabled="index === 0 || busy"
            class="p-1.5 rounded-lg bg-white/90 text-slate-800 disabled:opacity-30"
            title="上移"
            @click="move(index, -1)"
          >
            <ChevronUp class="w-4 h-4" />
          </button>
          <button
            type="button"
            :disabled="index === items.length - 1 || busy"
            class="p-1.5 rounded-lg bg-white/90 text-slate-800 disabled:opacity-30"
            title="下移"
            @click="move(index, 1)"
          >
            <ChevronDown class="w-4 h-4" />
          </button>
          <button
            type="button"
            :disabled="busy"
            class="p-1.5 rounded-lg bg-rose-500 text-white disabled:opacity-30"
            title="删除"
            @click="remove(item)"
          >
            <Trash2 class="w-4 h-4" />
          </button>
        </div>
        <span class="absolute top-1 left-1 text-[10px] font-bold text-white bg-black/50 rounded px-1">
          {{ index + 1 }}
        </span>
      </div>
    </div>

    <div
      v-else
      class="border border-dashed border-border rounded-xl py-8 text-center text-sm text-muted-foreground cursor-pointer hover:border-blue-400"
      @click="fileInput?.click()"
    >
      暂无详情图，点击「上传图片」添加（最多 {{ MAX }} 张）
    </div>

    <p v-if="error" class="text-xs text-rose-500 mt-2">{{ error }}</p>
  </div>
</template>
