<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-bold text-slate-900 dark:text-white">我的项目</h2>
    </div>

    <ui-LoadingSpinner v-if="loading" brand="dev" />

    <div v-else-if="projects.length === 0" class="bg-white/72 dark:bg-slate-900/62 backdrop-blur-lg rounded-3xl border border-white/70 dark:border-slate-700/70 shadow-xl shadow-slate-900/8 dark:shadow-black/30">
      <ui-EmptyState :icon="Package" title="暂无参与的项目" description="提交项目或申请认领后即可在此管理" containerClass="p-10" />
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <router-link
        v-for="p in projects"
        :key="p.id"
        :to="`/dev/projects/${p.id}`"
        class="bg-white/72 dark:bg-slate-900/62 backdrop-blur-lg rounded-3xl border border-white/70 dark:border-slate-700/70 shadow-xl shadow-slate-900/8 dark:shadow-black/30 p-5 hover:shadow-2xl transition-shadow flex flex-col gap-3"
      >
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 bg-slate-100 dark:bg-slate-700">
            <img v-if="p.icon" :src="p.icon" :alt="p.name" class="w-full h-full object-cover" loading="lazy" />
            <div v-else class="w-full h-full flex items-center justify-center text-slate-400 text-sm font-bold">{{ (p.name || '?')[0] }}</div>
          </div>
          <div class="flex-1 min-w-0">
            <div class="font-bold text-sm truncate text-slate-900 dark:text-white">{{ p.name }}</div>
            <div class="text-xs text-slate-400 truncate">{{ p.developer }}<span v-if="p.organization_name" class="text-slate-300 dark:text-slate-600"> · </span><span v-if="p.organization_name" class="text-blue-400">{{ p.organization_name }}</span></div>
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

    <ui-Pagination v-model:page="page" :total="total" :page-size="20" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { adminFetch } from '../../composables/useAdminFetch';
import { API } from '../../api/endpoints';
import { Package } from 'lucide-vue-next';
import { Pagination as uiPagination, LoadingSpinner as uiLoadingSpinner, EmptyState as uiEmptyState } from '../../components/ui';

const projects = ref<any[]>([]);
const page = ref(1);
const pageSize = ref(20);
const total = ref(0);
const loading = ref(true);

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

watch(page, fetchProjects);

onMounted(fetchProjects);
</script>
