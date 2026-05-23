<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { GitMerge } from 'lucide-vue-next';
import type { Project } from '../composables/useProjects';
import * as echarts from 'echarts/core';
import { GraphChart } from 'echarts/charts';
import { TitleComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import VChart from 'vue-echarts';

echarts.use([TitleComponent, TooltipComponent, LegendComponent, GraphChart, CanvasRenderer]);

const props = defineProps<{
  currentProjectName: string;
  allProjects: Project[];
}>();

const router = useRouter();

// Build network edges based on github_parent_url AND manual relations
const getGraphData = () => {
  const edges: any[] = [];
  
  const projectByUrl = new Map<string, Project>();
  const projectByName = new Map<string, Project>();
  
  props.allProjects.forEach(p => {
    projectByName.set(p.name, p);
    if (p.github_url) {
      projectByUrl.set(p.github_url.toLowerCase().replace(/\/$/, ''), p);
    }
  });

  const addEdge = (sourceName: string, targetName: string, type: string) => {
    edges.push({
      source: sourceName,
      target: targetName,
      label: {
        show: true,
        formatter: type,
        fontSize: 10,
      },
      lineStyle: {
        width: 2,
        curveness: 0.2,
        type: type === 'plugin' ? 'dashed' : 'solid',
        color: type === 'plugin' ? '#8b5cf6' : (type === 'fork' ? '#10b981' : '#64748b')
      }
    });
  };

  props.allProjects.forEach(p => {
    // 1. Process GitHub Fork API relation
    if (p.github_is_fork && p.github_parent_url) {
      const parentUrl = p.github_parent_url.toLowerCase().replace(/\/$/, '');
      const parent = projectByUrl.get(parentUrl);
      if (parent) {
        addEdge(parent.name, p.name, 'fork');
      }
    }
    
    // 2. Process Manual Relations
    if (p.relations) {
      p.relations.forEach(rel => {
        const target = projectByName.get(rel.target);
        if (target) {
          // If relation type is plugin, usually target is the host (e.g. IslandCaller target ClassIsland)
          // Direction: Target -> Project
          addEdge(target.name, p.name, rel.type);
        }
      });
    }
  });

  // Find connected component for currentProjectName
  const adjList = new Map<string, string[]>();
  edges.forEach(e => {
    if (!adjList.has(e.source)) adjList.set(e.source, []);
    if (!adjList.has(e.target)) adjList.set(e.target, []);
    adjList.get(e.source)!.push(e.target);
    adjList.get(e.target)!.push(e.source);
  });

  const connectedComponent = new Set<string>();
  const queue = [props.currentProjectName];
  connectedComponent.add(props.currentProjectName);
  
  while (queue.length > 0) {
    const curr = queue.shift()!;
    const neighbors = adjList.get(curr) || [];
    for (const n of neighbors) {
      if (!connectedComponent.has(n)) {
        connectedComponent.add(n);
        queue.push(n);
      }
    }
  }

  // If there are no connections, return null
  if (connectedComponent.size <= 1) return null;

  // Build nodes for the connected component
  const nodes: any[] = [];
  const filteredEdges = edges.filter(e => connectedComponent.has(e.source) && connectedComponent.has(e.target));

  connectedComponent.forEach(name => {
    const proj = projectByName.get(name);
    if (!proj) return;
    
    const isCurrent = name === props.currentProjectName;
    nodes.push({
      id: name,
      name: name,
      symbolSize: isCurrent ? 60 : 45,
      itemStyle: {
        color: isCurrent ? '#10b981' : '#64748b',
        borderColor: isCurrent ? '#a7f3d0' : '#e2e8f0',
        borderWidth: 3,
        shadowBlur: isCurrent ? 10 : 0,
        shadowColor: '#10b981'
      },
      label: {
        show: true,
        position: 'bottom',
        color: typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? '#f8fafc' : '#0f172a',
        fontWeight: isCurrent ? 'bold' : 'normal'
      },
      projData: proj // store for click event
    });
  });

  return { nodes, edges: filteredEdges };
};

const graphData = computed(() => getGraphData());

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
          edgeLength: 100
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
  if (params.dataType === 'node' && params.data.name !== props.currentProjectName) {
    router.push({ name: 'project-detail', params: { name: params.data.name } });
    window.scrollTo(0, 0);
  }
};
</script>

<template>
  <section v-if="graphData" class="mt-12 pt-10 border-t border-border">
    <h2 class="text-2xl font-bold text-foreground mb-2 flex items-center gap-2">
      <GitMerge class="w-6 h-6 text-emerald-500" /> 生态网状图
    </h2>
    <p class="text-muted-foreground mb-8">基于真实的 GitHub 派生关系以及插件生态。你可以拖拽节点，或点击其他节点跳转。</p>
    
    <div class="bg-white dark:bg-[#111827] rounded-3xl p-4 sm:p-8 border border-border shadow-sm">
      <div class="w-full h-[400px]">
        <ClientOnly>
          <VChart class="w-full h-full" :option="option" autoresize @click="handleChartClick" />
        </ClientOnly>
      </div>
    </div>
  </section>
</template>
