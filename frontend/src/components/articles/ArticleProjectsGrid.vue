<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useAnalytics } from '../../composables/useAnalytics';

export interface ArticleProjectRef {
  name: string;
  icon?: string;
  slug?: string;
}

const props = defineProps<{
  projects: ArticleProjectRef[];
}>();

const router = useRouter();
const { trackClick } = useAnalytics();

const goProject = (name: string) => {
  trackClick(name, 'click');
  router.push({ name: 'project-detail', params: { name } });
};
</script>

<template>
  <div v-if="projects?.length" class="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-10">
    <button
      v-for="p in projects"
      :key="p.slug || p.name"
      type="button"
      class="flex flex-col items-center gap-2 p-4 rounded-2xl border border-border bg-card/60 hover:bg-accent transition-colors"
      @click="goProject(p.slug || p.name)"
    >
      <img v-if="p.icon" :src="p.icon" :alt="p.name" class="w-14 h-14 rounded-xl object-cover" />
      <span class="text-sm font-semibold text-center">{{ p.name }}</span>
    </button>
  </div>
</template>
