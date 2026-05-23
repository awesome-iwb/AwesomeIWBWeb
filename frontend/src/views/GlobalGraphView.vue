<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useProjects } from '../composables/useProjects';
import type { Project } from '../composables/useProjects';
import { Network } from 'lucide-vue-next';
import * as echarts from 'echarts/core';
import { GraphChart } from 'echarts/charts';
import { TitleComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import VChart from 'vue-echarts';

echarts.use([TitleComponent, TooltipComponent, LegendComponent, GraphChart, CanvasRenderer]);

const router = useRouter();
const { allProjects, fetchProjects, loading } = useProjects();

onMounted(async () => {
  await fetchProjects();
});

const sizeMetric = ref<'default' | 'stars' | 'connections'>('connections');

const graphData = computed(() => {
  if (allProjects.value.length === 0) return null;

  const nodes: any[] = [];
  const edges: any[] = [];
  const projectByUrl = new Map<string, Project>();
  const projectByName = new Map<string, Project>();
  const connectionsCount = new Map<string, number>();
  
  // Color palette for different categories/functions based on keywords
  const getCategoryColor = (keywords: string[]) => {
    const kws = keywords.join(' ').toLowerCase();
    if (kws.includes('白板') || kws.includes('画板') || kws.includes('canvas')) return { color: '#ec4899', borderColor: '#fbcfe8', shadow: 'rgba(236, 72, 153, 0.4)' }; // Pink
    if (kws.includes('点名') || kws.includes('工具') || kws.includes('课表')) return { color: '#3b82f6', borderColor: '#bfdbfe', shadow: 'rgba(59, 130, 246, 0.4)' }; // Blue
    if (kws.includes('浏览器') || kws.includes('代理') || kws.includes('美化')) return { color: '#10b981', borderColor: '#a7f3d0', shadow: 'rgba(16, 185, 129, 0.4)' }; // Green
    if (kws.includes('游戏') || kws.includes('娱乐') || kws.includes('摸鱼')) return { color: '#f59e0b', borderColor: '#fde68a', shadow: 'rgba(245, 158, 11, 0.4)' }; // Amber
    return { color: '#6366f1', borderColor: '#e0e7ff', shadow: 'rgba(99, 102, 241, 0.4)' }; // Default Indigo
  };

  allProjects.value.forEach(p => {
    projectByName.set(p.name, p);
    if (p.github_url) {
      projectByUrl.set(p.github_url.toLowerCase().replace(/\/$/, ''), p);
    }
  });

  const addEdge = (sourceName: string, targetName: string, type: string) => {
    edges.push({
      source: sourceName,
      target: targetName,
      label: { show: true, formatter: type, fontSize: 10 },
      lineStyle: {
        width: 2,
        curveness: 0.2,
        type: type === 'plugin' ? 'dashed' : 'solid',
        color: type === 'plugin' ? '#8b5cf6' : (type === 'fork' ? '#10b981' : '#64748b')
      }
    });
    
    // Track degree (connections count)
    connectionsCount.set(sourceName, (connectionsCount.get(sourceName) || 0) + 1);
    connectionsCount.set(targetName, (connectionsCount.get(targetName) || 0) + 1);
  };

  allProjects.value.forEach(p => {
    if (p.github_is_fork && p.github_parent_url) {
      const parentUrl = p.github_parent_url.toLowerCase().replace(/\/$/, '');
      const parent = projectByUrl.get(parentUrl);
      if (parent) {
        addEdge(parent.name, p.name, 'fork');
      }
    }
    
    if (p.relations) {
      p.relations.forEach(rel => {
        const target = projectByName.get(rel.target);
        if (target) {
          addEdge(target.name, p.name, rel.type);
        }
      });
    }
  });

  allProjects.value.forEach(proj => {
    const style = getCategoryColor(proj.keywords || []);
    
    let size = 35;
    if (sizeMetric.value === 'stars') {
      const stars = proj.stars || 0;
      size = 30 + Math.sqrt(stars) * 2;
      size = Math.min(Math.max(size, 30), 100);
    } else if (sizeMetric.value === 'connections') {
      const conns = connectionsCount.get(proj.name) || 0;
      size = 35 + conns * 10;
      size = Math.min(size, 90);
    }

    nodes.push({
        id: proj.name,
        name: proj.name,
        symbolSize: size,
        itemStyle: {
          color: style.color,
          borderColor: style.borderColor,
          borderWidth: 2,
          shadowBlur: 10,
          shadowColor: style.shadow
        },
        label: {
          show: true,
          position: 'bottom',
          color: typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? '#f8fafc' : '#0f172a'
        },
        projData: proj
      });
  });

  return { nodes, edges };
});

const option = computed(() => {
  if (!graphData.value) return {};
  
  return {
    tooltip: {
      formatter: (params: any) => {
        if (params.dataType === 'node') {
          return `<b>${params.data.name}</b><br/>${params.data.projData.description || ''}`;
        }
        return `${params.data.source} -> ${params.data.target} (${params.data.label.formatter})`;
      }
    },
    animationDurationUpdate: 1500,
    animationEasingUpdate: 'quinticInOut' as const,
    series: [
      {
        type: 'graph',
        layout: 'force',
        data: graphData.value.nodes,
        edges: graphData.value.edges,
        roam: true,
        label: {
          position: 'right',
          formatter: '{b}'
        },
        force: {
          repulsion: 300,
          edgeLength: 150,
          gravity: 0.1
        },
        lineStyle: {
          color: 'source',
          curveness: 0.3
        },
        emphasis: {
          focus: 'adjacency',
          lineStyle: {
            width: 4
          }
        }
      }
    ]
  };
});

const handleChartClick = (params: any) => {
  if (params.dataType === 'node') {
    router.push({ name: 'project-detail', params: { name: params.data.name } });
  }
};
</script>

<template>
  <div class="min-h-screen bg-[#F8FAFC] dark:bg-[#0B1120] text-foreground font-sans pb-20 flex flex-col">
    
    <main class="pt-24 px-4 sm:px-6 w-full flex-1 flex flex-col max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out-expo">
      
      <div class="text-center mb-10 shrink-0">
        <div class="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500 mb-6 shadow-inner border border-indigo-100 dark:border-indigo-500/20">
          <Network class="w-10 h-10" />
        </div>
        <h1 class="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground mb-4">全网生态关联图谱</h1>
        <p class="text-lg text-muted-foreground max-w-2xl mx-auto">以真正的网状图形式，展示开源项目间的 Fork 派生与插件依赖关系。支持自由拖拽缩放。</p>
      </div>

      <div v-if="loading" class="flex-1 w-full bg-white dark:bg-[#111827] rounded-3xl border border-border shadow-2xl shadow-slate-200/30 dark:shadow-none overflow-hidden relative min-h-[600px] flex items-center justify-center">
        <div class="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-20"></div>
        <div class="animate-pulse flex flex-col items-center gap-6">
          <div class="relative w-48 h-48">
            <div class="absolute inset-0 border-4 border-border rounded-full"></div>
            <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-muted rounded-full"></div>
            <div class="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-8 bg-muted rounded-full"></div>
            <div class="absolute bottom-0 left-1/2 -translate-x-1/2 w-10 h-10 bg-muted rounded-full"></div>
            <div class="absolute top-1/2 left-0 -translate-y-1/2 w-6 h-6 bg-muted rounded-full"></div>
            <div class="absolute top-1/2 right-0 -translate-y-1/2 w-14 h-14 bg-muted rounded-full"></div>
            <!-- Lines -->
            <div class="absolute top-1/4 left-1/2 w-px h-1/4 bg-muted origin-bottom transform rotate-45"></div>
            <div class="absolute top-1/2 left-1/4 w-1/4 h-px bg-muted"></div>
            <div class="absolute top-1/2 left-1/2 w-1/4 h-px bg-muted"></div>
          </div>
          <div class="h-4 bg-muted rounded w-32"></div>
        </div>
      </div>

      <div v-else-if="!graphData || graphData.nodes.length === 0" class="text-center py-20 text-muted-foreground shrink-0">
        暂未发现有任何连结关系的项目。
      </div>

      <div v-else class="flex-1 w-full bg-white dark:bg-[#111827] rounded-3xl border border-border shadow-2xl shadow-slate-200/30 dark:shadow-none overflow-hidden relative min-h-[600px]">
        <div class="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-50 z-10"></div>
        
        <!-- Controls -->
        <div class="absolute top-4 right-4 z-10 flex items-center gap-2 bg-card backdrop-blur px-4 py-2 rounded-xl border border-border shadow-sm">
          <span class="text-sm font-medium text-muted-foreground">节点大小取决于:</span>
          <select v-model="sizeMetric" class="bg-transparent text-sm font-bold text-indigo-600 dark:text-indigo-400 focus:outline-none cursor-pointer">
            <option value="connections">生态关联度 (默认)</option>
            <option value="stars">Star 数量</option>
            <option value="default">固定大小</option>
          </select>
        </div>

        <ClientOnly>
          <VChart class="w-full h-full absolute inset-0" :option="option" autoresize @click="handleChartClick" />
        </ClientOnly>
      </div>

    </main>
  </div>
</template>
