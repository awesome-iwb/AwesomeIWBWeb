<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { adminFetch, formatAdminError } from '../../composables/useAdminFetch';
import { API } from '../../api/endpoints';

interface BacklinkItem {
  id: string;
  slug: string;
  title: string;
  status: string;
  updated_at: string;
}

const props = defineProps<{
  articleId: string;
}>();

const router = useRouter();
const items = ref<BacklinkItem[]>([]);
const loading = ref(false);
const error = ref('');

async function fetchBacklinks() {
  if (!props.articleId) return;
  loading.value = true;
  error.value = '';
  try {
    const res = await adminFetch(API.admin.articleBacklinks(props.articleId));
    if (!res.ok) {
      throw new Error(formatAdminError(await res.json().catch(() => ({})), '加载反向链接失败', res.status));
    }
    const json = await res.json();
    items.value = json.items ?? [];
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : '加载失败';
    items.value = [];
  } finally {
    loading.value = false;
  }
}

function openArticle(id: string) {
  void router.push({ name: 'admin-article-edit', params: { id } });
}

watch(() => props.articleId, fetchBacklinks, { immediate: true });

defineExpose({ refresh: fetchBacklinks });
</script>

<template>
  <div class="flex flex-col min-h-0">
    <div class="px-3 py-2 text-xs font-bold text-muted-foreground uppercase tracking-wide border-b border-border">
      反向链接
    </div>
    <div class="flex-1 min-h-0 overflow-y-auto p-2">
      <p v-if="loading" class="text-xs text-muted-foreground px-2 py-2">加载中…</p>
      <p v-else-if="error" class="text-xs text-rose-500 px-2 py-2">{{ error }}</p>
      <p v-else-if="items.length === 0" class="text-xs text-muted-foreground px-2 py-4">
        暂无其他文章链接到本篇
      </p>
      <button
        v-for="item in items"
        :key="item.id"
        type="button"
        class="w-full text-left px-2 py-2 rounded-lg hover:bg-accent transition-colors"
        @click="openArticle(item.id)"
      >
        <div class="text-sm font-medium truncate">{{ item.title || '未命名' }}</div>
        <div class="text-xs text-muted-foreground truncate">
          {{ item.status === 'published' ? '已发布' : '草稿' }} · {{ item.slug }}
        </div>
      </button>
    </div>
  </div>
</template>
