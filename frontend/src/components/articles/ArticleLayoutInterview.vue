<script setup lang="ts">
import ArticleContent from './ArticleContent.vue';
import ArticleProjectsGrid from './ArticleProjectsGrid.vue';
import type { ArticleContentFormat } from '../../lib/renderArticleContent';
import type { ArticleProjectRef } from './ArticleProjectsGrid.vue';

defineProps<{
  title: string;
  category?: string;
  contentFormat: ArticleContentFormat;
  content: string;
  projects?: ArticleProjectRef[];
}>();
</script>

<template>
  <article class="max-w-2xl mx-auto">
    <header class="mb-8 border-b border-border pb-6">
      <span v-if="category" class="text-xs font-bold tracking-widest uppercase text-emerald-600 dark:text-emerald-400">{{ category }}</span>
      <h1 class="text-3xl sm:text-4xl font-extrabold mt-2 leading-tight">{{ title }}</h1>
    </header>
    <ArticleContent :format="contentFormat" :content="content" />
    <ArticleProjectsGrid :projects="projects ?? []" />
  </article>
</template>
