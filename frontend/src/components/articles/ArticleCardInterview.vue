<script setup lang="ts">
import { useRouter } from 'vue-router';

const props = defineProps<{
  slug: string;
  title: string;
  category?: string;
  subtitle?: string;
}>();

const router = useRouter();
const open = () => router.push({ name: 'article-detail', params: { slug: props.slug } });
</script>

<template>
  <article
    class="max-w-xl mx-auto w-full p-6 sm:p-8 rounded-2xl border border-border bg-card/80 cursor-pointer hover:border-emerald-500/40 transition-colors"
    @click="open"
  >
    <span v-if="category" class="text-xs font-bold tracking-widest uppercase text-emerald-600 dark:text-emerald-400">{{ category }}</span>
    <h2 class="text-2xl font-extrabold mt-2 leading-snug">{{ title }}</h2>
    <p v-if="subtitle" class="text-muted-foreground mt-2 line-clamp-2">{{ subtitle }}</p>
  </article>
</template>
