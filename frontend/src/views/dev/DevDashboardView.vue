<template>
  <div class="space-y-4 lg:space-y-6 max-w-full overflow-x-hidden">
    <div v-if="loading" class="flex items-center justify-center py-20">
      <div class="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
    </div>

    <template v-else>
      <div class="flex gap-2 overflow-x-auto pb-1 -webkit-overflow-scrolling-touch lg:hidden max-w-full">
        <div class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex-shrink-0">
          <Building2 class="w-3.5 h-3.5" /><span class="text-xs font-bold">{{ stats.organizations ?? 0 }}</span><span class="text-[10px]">组织</span>
        </div>
        <div class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex-shrink-0">
          <Package class="w-3.5 h-3.5" /><span class="text-xs font-bold">{{ stats.projects ?? 0 }}</span><span class="text-[10px]">项目</span>
        </div>
        <div class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 flex-shrink-0">
          <Bug class="w-3.5 h-3.5" /><span class="text-xs font-bold">{{ stats.openBugs ?? 0 }}</span><span class="text-[10px]">待处理Bug</span>
        </div>
        <div class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 flex-shrink-0">
          <MessageSquare class="w-3.5 h-3.5" /><span class="text-xs font-bold">{{ stats.totalComments ?? 0 }}</span><span class="text-[10px]">评论</span>
        </div>
      </div>

      <div class="hidden lg:grid lg:grid-cols-4 gap-4">
        <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 flex items-center gap-4">
          <div class="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center flex-shrink-0">
            <Building2 class="w-6 h-6 text-blue-500" />
          </div>
          <div>
            <div class="text-2xl font-extrabold text-slate-900 dark:text-white">{{ stats.organizations ?? 0 }}</div>
            <div class="text-xs text-slate-500 dark:text-slate-400">我的组织</div>
          </div>
        </div>
        <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 flex items-center gap-4">
          <div class="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
            <Package class="w-6 h-6 text-emerald-500" />
          </div>
          <div>
            <div class="text-2xl font-extrabold text-slate-900 dark:text-white">{{ stats.projects ?? 0 }}</div>
            <div class="text-xs text-slate-500 dark:text-slate-400">参与项目</div>
          </div>
        </div>
        <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 flex items-center gap-4">
          <div class="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center flex-shrink-0">
            <Bug class="w-6 h-6 text-rose-500" />
          </div>
          <div>
            <div class="text-2xl font-extrabold text-slate-900 dark:text-white">{{ stats.openBugs ?? 0 }}</div>
            <div class="text-xs text-slate-500 dark:text-slate-400">待处理 Bug</div>
          </div>
        </div>
        <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 flex items-center gap-4">
          <div class="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center flex-shrink-0">
            <MessageSquare class="w-6 h-6 text-purple-500" />
          </div>
          <div>
            <div class="text-2xl font-extrabold text-slate-900 dark:text-white">{{ stats.totalComments ?? 0 }}</div>
            <div class="text-xs text-slate-500 dark:text-slate-400">总评论数</div>
          </div>
        </div>
      </div>

      <div v-if="recentProjects.length > 0" class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div class="px-4 lg:px-5 py-3 lg:py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <h3 class="font-bold text-sm lg:text-base flex items-center gap-2"><Package class="w-4 h-4 text-emerald-500" />我的项目</h3>
          <router-link to="/dev/projects" class="text-xs text-blue-600 dark:text-blue-400 font-medium">全部 →</router-link>
        </div>
        <div class="divide-y divide-slate-100 dark:divide-slate-700">
          <router-link v-for="p in recentProjects" :key="p.id" :to="`/dev/projects/${p.id}`" class="flex items-center gap-3 px-4 lg:px-5 py-3 active:bg-slate-100 dark:active:bg-slate-700 transition-colors">
            <div class="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 bg-slate-100 dark:bg-slate-700">
              <img v-if="p.icon" :src="p.icon" :alt="p.name" class="w-full h-full object-cover" loading="lazy" decoding="async" />
              <div v-else class="w-full h-full flex items-center justify-center text-slate-400"><Package class="w-4 h-4" /></div>
            </div>
            <div class="flex-1 min-w-0">
              <div class="font-semibold text-sm truncate text-slate-900 dark:text-white">{{ p.name }}</div>
              <div class="text-xs text-slate-400 mt-0.5 truncate">{{ p.description || p.developer }}</div>
            </div>
            <span v-if="p.language" class="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 font-mono flex-shrink-0">{{ p.language }}</span>
          </router-link>
        </div>
      </div>

      <div v-if="recentProjects.length === 0 && !loading" class="text-center py-20 text-slate-400">
        <LayoutDashboard class="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p class="text-sm">暂无参与的项目</p>
        <p class="text-xs mt-1">提交项目或申请认领后即可在此管理</p>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { adminFetch } from '../../composables/useAdminFetch';
import { API } from '../../api/endpoints';
import { Building2, Package, Bug, MessageSquare, LayoutDashboard } from 'lucide-vue-next';

const stats = ref<{ projects: number; totalBugs: number; openBugs: number; totalComments: number; organizations?: number }>({
  projects: 0, totalBugs: 0, openBugs: 0, totalComments: 0, organizations: 0,
});
const recentProjects = ref<any[]>([]);
const loading = ref(true);

onMounted(async () => {
  try {
    const [statsRes, projectsRes, orgsRes] = await Promise.all([
      adminFetch(API.dev.stats),
      adminFetch(`${API.dev.projects}?pageSize=5`),
      adminFetch(API.dev.organizations),
    ]);
    if (statsRes.ok) stats.value = await statsRes.json();
    if (projectsRes.ok) {
      const json = await projectsRes.json();
      recentProjects.value = json.items ?? [];
    }
    if (orgsRes.ok) {
      const orgs = await orgsRes.json();
      stats.value.organizations = Array.isArray(orgs) ? orgs.length : 0;
    }
  } catch (e) {
    console.error('DevDashboard fetch error:', e);
  } finally {
    loading.value = false;
  }
});
</script>
