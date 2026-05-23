<template>
  <div class="h-full min-h-0 flex flex-col">
    <div class="shrink-0 px-4 pt-4 pb-3 border-b border-border space-y-3">
      <div class="flex items-center justify-between gap-3">
        <h2 class="text-sm font-bold text-foreground">文章列表</h2>
        <button
          type="button"
          class="w-11 h-11 sm:w-8 sm:h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center hover:bg-emerald-200 transition-colors"
          :disabled="creating"
          @click="createArticle"
        >
          <Plus class="w-5 h-5 sm:w-4 sm:h-4" />
        </button>
      </div>
      <div class="relative">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          v-model="searchQ"
          placeholder="搜索标题或 slug"
          class="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-card text-sm outline-none focus:border-[var(--color-brand-500)] transition-colors placeholder:text-muted-foreground"
          @input="onSearch"
        />
      </div>
    </div>

    <div class="flex-1 min-h-0 overflow-y-auto px-4 py-4">
      <div v-if="loading" class="text-muted-foreground text-sm">加载中…</div>
      <div v-else class="space-y-1.5">
        <button
          v-for="item in items"
          :key="item.id"
          type="button"
          class="w-full p-3 rounded-xl border cursor-pointer transition-all duration-200 flex items-center gap-3 min-h-[48px] text-left bg-card/50 border-transparent hover:bg-accent/80"
          @click="openEdit(item.id)"
        >
          <FileText class="w-5 h-5 text-slate-400 shrink-0" />
          <div class="flex-1 min-w-0">
            <h3 class="font-medium text-sm truncate">{{ item.title || '未命名' }}</h3>
            <p class="text-xs text-muted-foreground truncate">
              {{ layoutLabel(item.layout_type) }} · {{ item.status === 'published' ? '已发布' : '草稿' }}
            </p>
          </div>
        </button>
      </div>
    </div>

    <div v-if="total > 0" class="shrink-0 px-4 pb-4 pt-1 flex items-center justify-between text-xs text-muted-foreground">
      <span>共 {{ total }} 篇</span>
      <div class="flex gap-2">
        <button type="button" class="px-2 py-1 rounded-lg bg-secondary disabled:opacity-50" :disabled="page <= 1" @click="changePage(page - 1)">
          上一页
        </button>
        <span>{{ page }}</span>
        <button
          type="button"
          class="px-2 py-1 rounded-lg bg-secondary disabled:opacity-50"
          :disabled="page * pageSize >= total"
          @click="changePage(page + 1)"
        >
          下一页
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { Plus, FileText, Search } from 'lucide-vue-next';
import { adminFetch, formatAdminError } from '../../composables/useAdminFetch';
import { API } from '../../api/endpoints';
import type { ArticleContentFormat } from '../../lib/renderArticleContent';

type LayoutType = 'hero' | 'interview' | 'app_spotlight';

interface ArticleListItem {
  id: string;
  slug: string;
  title: string;
  layout_type: LayoutType;
  content_format: ArticleContentFormat;
  status: 'draft' | 'published';
}

const router = useRouter();
const items = ref<ArticleListItem[]>([]);
const loading = ref(false);
const creating = ref(false);
const searchQ = ref('');
const page = ref(1);
const pageSize = ref(30);
const total = ref(0);

function layoutLabel(t: LayoutType) {
  if (t === 'interview') return '访谈';
  if (t === 'app_spotlight') return '应用列';
  return 'Hero';
}

async function fetchList() {
  loading.value = true;
  try {
    const params = new URLSearchParams({
      page: String(page.value),
      pageSize: String(pageSize.value),
    });
    if (searchQ.value) params.set('q', searchQ.value);
    const res = await adminFetch(`${API.admin.articles}?${params}`);
    if (!res.ok) throw new Error(formatAdminError(await res.json().catch(() => ({})), '加载失败', res.status));
    const json = await res.json();
    items.value = json.items ?? [];
    total.value = json.total ?? items.value.length;
  } catch (e: unknown) {
    alert(e instanceof Error ? e.message : '加载失败');
  } finally {
    loading.value = false;
  }
}

function openEdit(id: string) {
  void router.push({ name: 'admin-article-edit', params: { id } });
}

async function createArticle() {
  creating.value = true;
  try {
    const res = await adminFetch(API.admin.articles, {
      method: 'POST',
      body: JSON.stringify({
        title: '新文章',
        slug: `article-${Date.now()}`,
        layout_type: 'hero',
        content_format: 'markdown',
        content: '# 标题\n\n',
        status: 'draft',
      }),
    });
    if (!res.ok) {
      alert(formatAdminError(await res.json().catch(() => ({})), '创建失败', res.status));
      return;
    }
    const created = await res.json();
    void router.push({ name: 'admin-article-edit', params: { id: created.id } });
  } finally {
    creating.value = false;
  }
}

function onSearch() {
  page.value = 1;
  void fetchList();
}

function changePage(p: number) {
  page.value = p;
  void fetchList();
}

onMounted(fetchList);
</script>
