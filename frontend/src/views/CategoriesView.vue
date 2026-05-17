<template>
  <div class="max-w-5xl mx-auto px-4 pb-24 md:pb-8">
    <div class="mb-6">
      <h1 class="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white">浏览分类</h1>
      <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">按分类发现优质班级应用</p>
    </div>

    <div v-if="loading" class="grid grid-cols-2 gap-3">
      <div v-for="i in 6" :key="i" class="h-28 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse"></div>
    </div>

    <div v-else class="grid grid-cols-2 gap-3">
      <button
        v-for="cat in categories"
        :key="cat.id"
        @click="toggleCategory(cat.id)"
        class="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-4 text-left transition-all duration-200 active:scale-[0.98] hover:shadow-md hover:border-emerald-300 dark:hover:border-emerald-600"
        :class="expandedCategoryId === cat.id ? 'ring-2 ring-emerald-500 border-emerald-500' : ''"
      >
        <div class="flex items-center gap-2 mb-1">
          <span class="text-xl">{{ getCategoryEmoji(cat.name) }}</span>
          <span class="font-bold text-sm text-slate-900 dark:text-white truncate">{{ stripEmoji(cat.name) }}</span>
        </div>
        <div class="text-xs text-slate-500 dark:text-slate-400">{{ cat.projects.length }} 个应用</div>
      </button>
    </div>

    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 -translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-2"
    >
      <div v-if="expandedCategory" class="mt-4">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-lg font-bold text-slate-900 dark:text-white">{{ stripEmoji(expandedCategory.name) }}</h2>
          <button @click="expandedCategoryId = null" class="text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">收起</button>
        </div>
        <div class="space-y-2">
          <router-link
            v-for="project in expandedCategory.projects"
            :key="project.id || project.slug || project.name"
            :to="`/project/${project.slug || project.name}`"
            @click="trackClick(project.slug || project.name, 'click')"
            class="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-600 transition-colors"
          >
            <img v-if="project.icon" :src="project.icon" class="w-10 h-10 rounded-xl bg-white object-contain p-1 shrink-0" />
            <div v-else class="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-sm font-bold text-slate-400 shrink-0">{{ (project.name || '?').charAt(0) }}</div>
            <div class="flex-1 min-w-0">
              <div class="font-semibold text-sm text-slate-900 dark:text-white truncate">{{ project.name }}</div>
              <div class="text-xs text-slate-500 dark:text-slate-400 truncate">{{ project.developer }}</div>
            </div>
            <div v-if="project.stars" class="text-xs text-slate-400 shrink-0">⭐ {{ project.stars }}</div>
          </router-link>
          <div v-if="expandedCategory.projects.length === 0" class="text-center text-slate-400 py-8 text-sm">该分类暂无应用</div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useProjects } from '../composables/useProjects';
import { useAnalytics } from '../composables/useAnalytics'

const { categories, loading, fetchProjects } = useProjects();
const { trackClick } = useAnalytics()
const expandedCategoryId = ref<string | null>(null);

const expandedCategory = computed(() => {
  if (!expandedCategoryId.value) return null;
  return categories.value.find(c => c.id === expandedCategoryId.value) || null;
});

const toggleCategory = (id: string) => {
  expandedCategoryId.value = expandedCategoryId.value === id ? null : id;
};

const stripEmoji = (name: string) => {
  return name.replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}\s]+/u, '').trim() || name;
};

const getCategoryEmoji = (name: string) => {
  const match = name.match(/^([\p{Emoji_Presentation}\p{Extended_Pictographic}]+)/u);
  return match ? match[1] : '📁';
};

onMounted(() => {
  fetchProjects();
});
</script>
