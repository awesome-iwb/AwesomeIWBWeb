<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useHead } from '@unhead/vue';
import { ArrowLeft } from 'lucide-vue-next';
import { useApi } from '../composables/useApi';
import ArticleLayoutHero from '../components/articles/ArticleLayoutHero.vue';
import ArticleLayoutInterview from '../components/articles/ArticleLayoutInterview.vue';
import ArticleLayoutAppSpotlight from '../components/articles/ArticleLayoutAppSpotlight.vue';
import ArticleCommentPanel from '../components/articles/ArticleCommentPanel.vue';
import type { ArticleContentFormat } from '../lib/renderArticleContent';

interface ArticlePayload {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  category: string;
  coverImage: string;
  cover_image?: string;
  layout_type: 'hero' | 'interview' | 'app_spotlight';
  content_format: ArticleContentFormat;
  content: string;
  theme: 'dark' | 'light';
  projects: Array<{ name: string; icon?: string; slug?: string }>;
  date?: string;
}

const route = useRoute();
const router = useRouter();
const { apiFetch } = useApi();
const article = ref<ArticlePayload | null>(null);
const loading = ref(true);
const error = ref('');

const slug = computed(() => String(route.params.slug ?? ''));

const fetchArticle = async () => {
  loading.value = true;
  error.value = '';
  try {
    const res = await apiFetch(`/api/articles/${encodeURIComponent(slug.value)}`, { cache: 'no-cache' });
    if (!res.ok) {
      error.value = res.status === 404 ? '文章不存在或未发布' : '加载失败';
      article.value = null;
      return;
    }
    const data = await res.json();
    article.value = {
      ...data,
      coverImage: data.coverImage ?? data.cover_image ?? '',
    };
  } catch {
    error.value = '网络错误';
    article.value = null;
  } finally {
    loading.value = false;
  }
};

onMounted(fetchArticle);
watch(slug, fetchArticle);

useHead(() => {
  const a = article.value;
  if (!a) return { title: '文章 - Awesome IWB' };
  return {
    title: `${a.title} - Awesome IWB`,
    meta: [
      { name: 'description', content: a.subtitle || a.title },
      { property: 'og:title', content: a.title },
      { property: 'og:description', content: a.subtitle || a.title },
      { property: 'og:image', content: a.coverImage || undefined },
    ],
    link: [{ rel: 'canonical', href: `https://aiwb.stcn.moe/articles/${a.slug || slug.value}` }],
  };
});
</script>

<template>
  <div class="min-h-screen bg-[#F8FAFC] dark:bg-[#0B1120] text-foreground font-sans">
    <main class="pt-24 px-6 max-w-4xl mx-auto pb-24">
      <button
        type="button"
        class="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        @click="router.push({ name: 'today' })"
      >
        <ArrowLeft class="w-4 h-4" />
        返回 Today
      </button>

      <p v-if="loading" class="text-muted-foreground">加载中…</p>
      <p v-else-if="error" class="text-rose-500">{{ error }}</p>

      <template v-else-if="article">
        <ArticleLayoutHero
          v-if="article.layout_type === 'hero' || !article.layout_type"
          :title="article.title"
          :subtitle="article.subtitle"
          :category="article.category"
          :cover-image="article.coverImage"
          :theme="article.theme"
          :content-format="article.content_format || 'markdown'"
          :content="article.content"
          :projects="article.projects"
        />
        <ArticleLayoutInterview
          v-else-if="article.layout_type === 'interview'"
          :title="article.title"
          :category="article.category"
          :content-format="article.content_format || 'markdown'"
          :content="article.content"
          :projects="article.projects"
        />
        <ArticleLayoutAppSpotlight
          v-else-if="article.layout_type === 'app_spotlight'"
          :title="article.title"
          :subtitle="article.subtitle"
          :category="article.category"
          :content-format="article.content_format || 'markdown'"
          :content="article.content"
          :projects="article.projects"
        />

        <div class="mt-12 border-t border-border pt-8">
          <ArticleCommentPanel v-if="article.slug" :article-slug="article.slug" />
        </div>
      </template>
    </main>
  </div>
</template>
