<script setup lang="ts">
import { computed } from 'vue';
import { renderArticleContent, type ArticleContentFormat } from '../../lib/renderArticleContent';
import 'katex/dist/katex.min.css';

const props = defineProps<{
  format: ArticleContentFormat;
  content: string;
  enableAnchors?: boolean;
}>();

const html = computed(() => renderArticleContent(props.format, props.content, props.enableAnchors ?? false));
</script>

<template>
  <div class="article-content prose prose-slate dark:prose-invert max-w-none" v-html="html" />
</template>

<style scoped>
:deep(.interview-block) {
  margin: 2rem 0;
}
:deep(.interview-q) {
  font-size: 1.125rem;
  font-weight: 700;
  margin-bottom: 0.75rem;
}
:deep(.interview-a blockquote) {
  border-left: 3px solid var(--color-brand-500, #10b981);
  padding-left: 1rem;
  margin: 0;
  color: var(--muted-foreground, #64748b);
}
:deep([data-anchor]) {
  position: relative;
  scroll-margin-top: 2rem;
}
</style>
