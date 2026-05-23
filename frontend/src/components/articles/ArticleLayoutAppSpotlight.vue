<script setup lang="ts">
import ArticleContent from './ArticleContent.vue';
import ArticleProjectsGrid from './ArticleProjectsGrid.vue';
import type { ArticleContentFormat } from '../../lib/renderArticleContent';
import type { ArticleProjectRef } from './ArticleProjectsGrid.vue';

defineProps<{
  title: string;
  subtitle?: string;
  category?: string;
  contentFormat: ArticleContentFormat;
  content: string;
  projects?: ArticleProjectRef[];
}>();
</script>

<template>
  <article>
    <header class="mb-6">
      <span v-if="category" class="text-xs font-bold tracking-widest uppercase text-muted-foreground">{{ category }}</span>
      <h1 class="text-2xl sm:text-3xl font-extrabold mt-1">{{ title }}</h1>
      <p v-if="subtitle" class="text-muted-foreground mt-1">{{ subtitle }}</p>
    </header>
    <ArticleProjectsGrid :projects="projects ?? []" />
    <div v-if="content?.trim()" class="mt-8">
      <ArticleContent :format="contentFormat" :content="content" />
    </div>
  </article>
</template>
