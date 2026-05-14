<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-bold text-slate-900 dark:text-white">我的项目</h2>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-20">
      <div class="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
    </div>

    <div v-else-if="projects.length === 0" class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-10 text-center">
      <Package class="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
      <p class="text-slate-500 dark:text-slate-400 text-sm">暂无参与的项目</p>
      <p class="text-xs text-slate-400 mt-1">提交项目或申请认领后即可在此管理</p>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <router-link
        v-for="p in projects"
        :key="p.id"
        :to="`/dev/projects/${p.id}`"
        class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 hover:shadow-md transition-shadow flex flex-col gap-3"
      >
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 bg-slate-100 dark:bg-slate-700">
            <img v-if="p.icon" :src="p.icon" :alt="p.name" class="w-full h-full object-cover" loading="lazy" />
            <div v-else class="w-full h-full flex items-center justify-center text-slate-400 text-sm font-bold">{{ (p.name || '?')[0] }}</div>
          </div>
          <div class="flex-1 min-w-0">
            <div class="font-bold text-sm truncate text-slate-900 dark:text-white">{{ p.name }}</div>
            <div class="text-xs text-slate-400 truncate">{{ p.developer }}</div>
          </div>
        </div>
        <p class="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{{ p.description || '暂无简介' }}</p>
        <div class="flex items-center gap-2 mt-auto">
          <span v-if="p.language" class="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 font-mono">{{ p.language }}</span>
          <span v-if="p.stars" class="text-[10px] text-amber-500">⭐ {{ p.stars }}</span>
          <span v-if="p.status" class="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">{{ p.status }}</span>
        </div>
      </router-link>
    </div>

    <div v-if="totalPages > 1" class="flex items-center justify-between text-sm pt-2">
      <button @click="prevPage" :disabled="page <= 1" class="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed">上一页</button>
      <div class="text-slate-500 dark:text-slate-300">{{ page }} / {{ totalPages }}</div>
      <button @click="nextPage" :disabled="page >= totalPages" class="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed">下一页</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { adminFetch } from '../../composables/useAdminFetch';
import { API } from '../../api/endpoints';
import { Package } from 'lucide-vue-next';

const projects = ref<any[]>([]);
const page = ref(1);
const pageSize = ref(20);
const total = ref(0);
const loading = ref(true);

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)));

const fetchProjects = async () => {
  loading.value = true;
  try {
    const res = await adminFetch(`${API.dev.projects}?page=${page.value}&pageSize=${pageSize.value}`);
    if (res.ok) {
      const json = await res.json();
      projects.value = json.items ?? [];
      total.value = json.total ?? 0;
    }
  } catch (e) {
    console.error('Fetch dev projects error:', e);
  } finally {
    loading.value = false;
  }
};

const prevPage = () => { if (page.value > 1) { page.value--; fetchProjects(); } };
const nextPage = () => { if (page.value < totalPages.value) { page.value++; fetchProjects(); } };

onMounted(fetchProjects);
</script>
