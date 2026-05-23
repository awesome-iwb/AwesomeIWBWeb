<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useHead } from '@unhead/vue';
import { useProjects } from '../composables/useProjects';
import type { Project } from '../composables/useProjects';
import { Scale, Star, ShieldCheck, Code2, MessageCircle, Github, Tag } from 'lucide-vue-next';

useHead({
  title: '横向对比 - Awesome IWB',
  meta: [
    { name: 'description', content: '对比 Awesome IWB 中收录的交互式白板软件，从星级、下载量、语言等维度进行横向比较。' },
    { property: 'og:title', content: '横向对比 - Awesome IWB' },
    { property: 'og:description', content: '对比交互式白板软件，从星级、下载量等维度横向比较。' },
    { property: 'og:type', content: 'website' },
    { property: 'og:url', content: 'https://aiwb.stcn.moe/compare' },
    { property: 'og:image', content: 'https://aiwb.stcn.moe/assets/brand/aiwb-icon.webp' },
    { name: 'twitter:card', content: 'summary' },
  ],
  link: [
    { rel: 'canonical', href: 'https://aiwb.stcn.moe/compare' }
  ]
})

const route = useRoute();
const router = useRouter();
const { allProjects, fetchProjects, loading } = useProjects();

onMounted(async () => {
  await fetchProjects();
});

const projectsToCompare = computed(() => {
  const query = route.query.projects as string;
  if (!query) return [];
  
  const names = query.split(',').map(n => decodeURIComponent(n));
  return names
    .map(name => allProjects.value.find(p => p.name === name))
    .filter(Boolean) as Project[];
});

const getFallbackImage = (name: string) => {
  const initial = name ? name.charAt(0).toUpperCase() : '?';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect fill="#cbd5e1" width="100" height="100" rx="24"/><text fill="#475569" font-family="sans-serif" font-size="40" font-weight="bold" x="50%" y="50%" dominant-baseline="middle" text-anchor="middle">${initial}</text></svg>`;
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
};

const getOrg = (project: any) => project?.organization || project?.extra?.feishu?.organization || '';
</script>

<template>
  <div class="min-h-screen bg-[#F8FAFC] dark:bg-[#0B1120] text-foreground font-sans pb-20">

    <main class="pt-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out-expo">
      
      <div class="text-center mb-12">
        <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 mb-4 shadow-inner border border-indigo-100 dark:border-indigo-500/20">
          <Scale class="w-8 h-8" />
        </div>
        <h1 class="text-3xl md:text-4xl font-extrabold tracking-tight mb-2">应用横向对比</h1>
        <p class="text-muted-foreground">详细对比各项核心指标，帮助你做出最佳选择。</p>
      </div>

      <div v-if="loading" class="w-full bg-white dark:bg-[#111827] rounded-3xl border border-border p-8 shadow-xl">
        <div class="animate-pulse space-y-8">
          <div class="flex gap-6">
            <div class="w-1/4 h-12 bg-muted rounded-xl"></div>
            <div class="flex-1 h-32 bg-muted rounded-2xl"></div>
            <div class="flex-1 h-32 bg-muted rounded-2xl"></div>
          </div>
          <div class="space-y-4">
            <div class="h-16 bg-muted rounded-xl w-full"></div>
            <div class="h-16 bg-muted rounded-xl w-full"></div>
            <div class="h-16 bg-muted rounded-xl w-full"></div>
          </div>
        </div>
      </div>

      <div v-else-if="projectsToCompare.length < 2" class="text-center py-20">
        <p class="text-slate-500 mb-6">请至少选择 2 款应用进行对比。</p>
        <button @click="router.push('/')" class="px-6 py-2 rounded-xl bg-indigo-600 text-white font-bold">返回应用商场</button>
      </div>

      <div v-else class="bg-white dark:bg-[#111827] rounded-3xl border border-border shadow-xl shadow-slate-200/30 dark:shadow-none overflow-x-auto">
        <table class="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr>
              <th class="w-1/4 p-6 border-b border-r border-border bg-card align-bottom">
                <span class="text-sm font-bold text-muted-foreground uppercase tracking-wider">对比维度 / 软件名称</span>
              </th>
              
              <th v-for="project in projectsToCompare" :key="project.name" class="w-1/4 p-6 border-b border-r last:border-r-0 border-border align-top relative group">
                <button @click="router.push('/project/' + encodeURIComponent(project.name))" class="absolute top-4 right-4 p-2 text-muted-foreground hover:text-indigo-600 bg-card hover:bg-indigo-50 dark:hover:bg-indigo-500/20 rounded-xl transition-colors opacity-0 group-hover:opacity-100">
                  <ExternalLink class="w-4 h-4" />
                </button>
                <div class="flex flex-col items-center text-center">
                  <div class="w-20 h-20 mb-4 flex items-center justify-center shrink-0 drop-shadow-md">
                    <img loading="lazy" :src="project.icon || project.avatar" :alt="project.name" class="w-full h-full object-contain" @error="(e) => { (e.target as HTMLImageElement).src = getFallbackImage(project.name) }" />
                  </div>
                  <h3 class="text-xl font-bold text-foreground mb-1">{{ project.name }}</h3>
                  <div class="flex flex-wrap items-center justify-center gap-2 mb-3">
                    <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-secondary border border-border text-foreground max-w-[220px] truncate">
                      {{ project.developer }}
                    </span>
                    <span v-if="getOrg(project)" class="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-secondary border border-border text-foreground max-w-[260px] truncate">
                      {{ getOrg(project) }}
                    </span>
                  </div>
                  <a :href="project.github_url" target="_blank" class="px-4 py-1.5 bg-slate-900 dark:bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-slate-800 dark:hover:bg-emerald-500 transition-colors inline-flex items-center gap-1.5">
                    <Github class="w-3.5 h-3.5" /> 获取
                  </a>
                </div>
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            
            <!-- GitHub Stars -->
            <tr class="hover:bg-accent transition-colors">
              <td class="p-6 border-r border-border font-bold text-foreground flex items-center gap-2">
                <Star class="w-5 h-5 text-amber-500" /> GitHub Stars
              </td>
              <td v-for="project in projectsToCompare" :key="project.name" class="p-6 border-r last:border-r-0 border-border text-center font-bold text-lg text-foreground">
                {{ project.stars ? project.stars.toLocaleString() : '-' }}
              </td>
            </tr>

            <!-- Status -->
            <tr class="hover:bg-accent transition-colors">
              <td class="p-6 border-r border-border font-bold text-foreground flex items-center gap-2">
                <ShieldCheck class="w-5 h-5 text-emerald-500" /> 活跃状态
              </td>
              <td v-for="project in projectsToCompare" :key="project.name" class="p-6 border-r last:border-r-0 border-border text-center">
                <span class="inline-flex items-center justify-center px-3 py-1 rounded-md text-sm font-bold border" :class="project.status === '活跃' ? 'bg-emerald-50 text-emerald-600 border-emerald-200/50 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20' : 'bg-card text-muted-foreground border-border'">
                  {{ project.status }}
                </span>
              </td>
            </tr>

            <!-- Language -->
            <tr class="hover:bg-accent transition-colors">
              <td class="p-6 border-r border-border font-bold text-foreground flex items-center gap-2">
                <Code2 class="w-5 h-5 text-indigo-500" /> 技术栈
              </td>
              <td v-for="project in projectsToCompare" :key="project.name" class="p-6 border-r last:border-r-0 border-border text-center">
                <span v-if="project.language" class="inline-flex items-center justify-center gap-1.5 px-3 py-1 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 rounded-lg text-sm font-bold text-indigo-600 dark:text-indigo-400">
                  <Code2 class="w-3.5 h-3.5" /> {{ project.language }}
                </span>
                <span v-else class="text-muted-foreground">-</span>
              </td>
            </tr>

            <!-- Version -->
            <tr class="hover:bg-accent transition-colors">
              <td class="p-6 border-r border-border font-bold text-foreground flex items-center gap-2">
                <Tag class="w-5 h-5 text-blue-500" /> 最新版本
              </td>
              <td v-for="project in projectsToCompare" :key="project.name" class="p-6 border-r last:border-r-0 border-border text-center font-mono text-sm text-muted-foreground">
                {{ project.version || 'No Release' }}
              </td>
            </tr>

            <!-- Last Update -->
            <tr class="hover:bg-accent transition-colors">
              <td class="p-6 border-r border-border font-bold text-foreground flex items-center gap-2">
                <svg class="w-5 h-5 text-orange-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> 最近更新
              </td>
              <td v-for="project in projectsToCompare" :key="project.name" class="p-6 border-r last:border-r-0 border-border text-center text-sm text-muted-foreground">
                {{ project.last_update ? new Date(project.last_update).toLocaleDateString('zh-CN') : '未知' }}
              </td>
            </tr>

            <!-- Status -->
            <tr class="hover:bg-accent transition-colors">
              <td class="p-6 border-r border-border font-bold text-foreground flex items-center gap-2">
                <MessageCircle class="w-5 h-5 text-rose-500" /> 活跃状态
              </td>
              <td v-for="project in projectsToCompare" :key="project.name" class="p-6 border-r last:border-r-0 border-border text-center text-sm font-medium text-muted-foreground">
                {{ project.status || '—' }}
              </td>
            </tr>

          </tbody>
        </table>
      </div>

    </main>
  </div>
</template>
