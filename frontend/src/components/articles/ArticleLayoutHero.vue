<script setup lang="ts">
import ArticleContent from './ArticleContent.vue';
import ArticleProjectsGrid from './ArticleProjectsGrid.vue';
import type { ArticleContentFormat } from '../../lib/renderArticleContent';
import type { ArticleProjectRef } from './ArticleProjectsGrid.vue';

defineProps<{
  title: string;
  subtitle?: string;
  category?: string;
  coverImage: string;
  theme?: 'dark' | 'light';
  contentFormat: ArticleContentFormat;
  content: string;
  projects?: ArticleProjectRef[];
}>();
</script>

<template>
  <article>
    <div
      v-if="coverImage"
      class="relative w-full min-h-[16rem] sm:min-h-[22rem] rounded-3xl overflow-hidden mb-8"
    >
      <img :src="coverImage" :alt="title" class="absolute inset-0 w-full h-full object-cover" />
      <div
        v-if="theme === 'light'"
        class="absolute inset-0 bg-gradient-to-b from-white/70 via-white/30 to-white/90"
      />
      <div v-else class="absolute inset-0 bg-gradient-to-b from-black/60 via-black/20 to-black/80" />
      <div
        class="relative p-8 sm:p-10 flex flex-col justify-end min-h-[16rem] sm:min-h-[22rem]"
        :class="theme === 'light' ? 'text-slate-900' : 'text-white'"
      >
        <span v-if="category" class="text-xs font-bold tracking-widest uppercase opacity-80 mb-2">{{ category }}</span>
        <h1 class="text-3xl sm:text-5xl font-extrabold leading-tight">{{ title }}</h1>
        <p v-if="subtitle" class="mt-2 text-lg opacity-90 max-w-2xl">{{ subtitle }}</p>
      </div>
    </div>
    <header v-else class="mb-8">
      <span v-if="category" class="text-xs font-bold tracking-widest uppercase text-muted-foreground">{{ category }}</span>
      <h1 class="text-3xl font-extrabold mt-2">{{ title }}</h1>
      <p v-if="subtitle" class="mt-2 text-lg text-muted-foreground">{{ subtitle }}</p>
    </header>
    <ArticleContent :format="contentFormat" :content="content" />
    <ArticleProjectsGrid :projects="projects ?? []" />
  </article>
</template>
