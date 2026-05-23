<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useHead } from '@unhead/vue';
import { useApi } from '../composables/useApi';
import ArticleCardHero from '../components/articles/ArticleCardHero.vue';
import ArticleCardInterview from '../components/articles/ArticleCardInterview.vue';
import ArticleCardAppSpotlight from '../components/articles/ArticleCardAppSpotlight.vue';
import type { ArticleContentFormat } from '../lib/renderArticleContent';

useHead({
  title: '精选推荐 - Awesome IWB',
  meta: [
    { name: 'description', content: 'Awesome IWB 精选推荐，发现最优质的交互式白板开源软件和专题故事。' },
    { property: 'og:title', content: '精选推荐 - Awesome IWB' },
    { property: 'og:description', content: '发现最优质的交互式白板开源软件和专题故事。' },
    { property: 'og:type', content: 'website' },
    { property: 'og:url', content: 'https://aiwb.stcn.moe/today' },
    { property: 'og:image', content: 'https://aiwb.stcn.moe/assets/brand/aiwb-icon.webp' },
    { name: 'twitter:card', content: 'summary' },
  ],
  link: [{ rel: 'canonical', href: 'https://aiwb.stcn.moe/today' }],
});

export interface TodayArticle {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  category: string;
  coverImage: string;
  date: string;
  projects: Array<{ name: string; icon?: string; slug?: string }>;
  theme: 'dark' | 'light';
  layout_type: 'hero' | 'interview' | 'app_spotlight';
  content_format: ArticleContentFormat;
  content: string;
}

const { apiFetch } = useApi();
const articles = ref<TodayArticle[]>([]);

onMounted(async () => {
  try {
    const res = await apiFetch('/api/articles', { cache: 'no-cache' });
    if (!res.ok) {
      const legacy = await apiFetch('/api/stories', { cache: 'no-cache' });
      if (legacy.ok) {
        const list = await legacy.json();
        articles.value = (Array.isArray(list) ? list : []).map(normalizeLegacy);
      }
      return;
    }
    const json = await res.json();
    const list = Array.isArray(json?.items) ? json.items : Array.isArray(json) ? json : [];
    articles.value = list.map(normalizeLegacy);
  } catch (e) {
    console.error('Failed to fetch articles', e);
  }
});

function normalizeLegacy(raw: Record<string, unknown>): TodayArticle {
  const slug = String(raw.slug ?? raw.id ?? '');
  return {
    id: slug,
    slug,
    title: String(raw.title ?? ''),
    subtitle: String(raw.subtitle ?? ''),
    category: String(raw.category ?? ''),
    coverImage: String(raw.coverImage ?? raw.cover_image ?? ''),
    date: String(raw.date ?? ''),
    projects: (raw.projects as TodayArticle['projects']) ?? [],
    theme: raw.theme === 'light' ? 'light' : 'dark',
    layout_type: (raw.layout_type as TodayArticle['layout_type']) ?? 'hero',
    content_format: (raw.content_format as ArticleContentFormat) ?? 'markdown',
    content: String(raw.content ?? ''),
  };
}
</script>

<template>
  <div class="min-h-screen bg-[#F8FAFC] dark:bg-[#0B1120] text-foreground font-sans selection:bg-emerald-200 selection:text-emerald-900">
    <main class="pt-24 px-6 max-w-4xl mx-auto pb-24 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out-expo">
      <header v-if="articles.length > 0" class="mb-10">
        <h1 class="text-4xl font-extrabold tracking-tight text-foreground mb-2">Today</h1>
        <p v-if="articles[0]?.date" class="text-lg text-muted-foreground font-medium">{{ articles[0].date }}</p>
      </header>

      <div v-if="articles.length > 0" class="grid gap-10">
        <template v-for="item in articles" :key="item.slug">
          <ArticleCardHero
            v-if="item.layout_type === 'hero' || !item.layout_type"
            :slug="item.slug"
            :title="item.title"
            :subtitle="item.subtitle"
            :category="item.category"
            :cover-image="item.coverImage"
            :theme="item.theme"
            :date="item.date"
          />
          <ArticleCardInterview
            v-else-if="item.layout_type === 'interview'"
            :slug="item.slug"
            :title="item.title"
            :category="item.category"
            :subtitle="item.subtitle"
          />
          <ArticleCardAppSpotlight
            v-else-if="item.layout_type === 'app_spotlight'"
            :slug="item.slug"
            :title="item.title"
            :projects="item.projects"
          />
        </template>
      </div>

      <p v-else class="text-muted-foreground text-center py-20">暂无推荐文章</p>
    </main>
  </div>
</template>

<style scoped>
.ease-out-expo {
  transition-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
}
</style>
