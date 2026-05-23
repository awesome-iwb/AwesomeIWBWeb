<script setup lang="ts">
import { useRouter } from 'vue-router';
import type { ArticleProjectRef } from './ArticleProjectsGrid.vue';

const props = defineProps<{
  slug: string;
  title: string;
  projects: ArticleProjectRef[];
}>();

const router = useRouter();
const open = () => router.push({ name: 'article-detail', params: { slug: props.slug } });
</script>

<template>
  <article
    class="p-5 rounded-2xl border border-border bg-card/80 cursor-pointer hover:bg-accent/50 transition-colors"
    @click="open"
  >
    <h2 class="text-lg font-bold mb-4">{{ title }}</h2>
    <ul class="space-y-3">
      <li v-for="p in projects" :key="p.slug || p.name" class="flex items-center gap-3">
        <img v-if="p.icon" :src="p.icon" :alt="p.name" class="w-10 h-10 rounded-lg object-cover shrink-0" />
        <span class="font-medium truncate">{{ p.name }}</span>
      </li>
    </ul>
  </article>
</template>
