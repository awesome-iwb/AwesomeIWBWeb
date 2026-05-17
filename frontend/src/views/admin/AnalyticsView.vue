<template>
  <div class="space-y-4 lg:space-y-6 max-w-full overflow-x-hidden">
    <div class="flex items-center justify-between">
      <h2 class="font-bold text-lg lg:text-xl text-slate-900 dark:text-white">数据分析</h2>
      <div class="flex gap-1 bg-slate-100 dark:bg-slate-700 rounded-lg p-0.5">
        <button v-for="d in [7, 30, 90]" :key="d" @click="days = d" class="px-3 py-1 rounded-md text-xs font-medium transition-colors" :class="days === d ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'">{{ d }}天</button>
      </div>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-20">
      <div class="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
    </div>

    <template v-else-if="data">
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
          <div class="text-xs text-slate-500 dark:text-slate-400 mb-1">页面浏览</div>
          <div class="text-2xl font-bold text-slate-900 dark:text-white">{{ formatNum(data.pv.total) }}</div>
          <div class="text-[10px] text-slate-400 mt-1">今日 {{ formatNum(data.pv.today) }} · 本周 {{ formatNum(data.pv.thisWeek) }}</div>
        </div>
        <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
          <div class="text-xs text-slate-500 dark:text-slate-400 mb-1">独立访客</div>
          <div class="text-2xl font-bold text-slate-900 dark:text-white">{{ formatNum(data.uv.total) }}</div>
          <div class="text-[10px] text-slate-400 mt-1">今日 {{ formatNum(data.uv.today) }} · 本周 {{ formatNum(data.uv.thisWeek) }}</div>
        </div>
        <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
          <div class="text-xs text-slate-500 dark:text-slate-400 mb-1">项目点击</div>
          <div class="text-2xl font-bold text-slate-900 dark:text-white">{{ formatNum(data.clicks.total) }}</div>
          <div class="text-[10px] text-slate-400 mt-1">今日 {{ formatNum(data.clicks.today) }}</div>
        </div>
        <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
          <div class="text-xs text-slate-500 dark:text-slate-400 mb-1">搜索次数</div>
          <div class="text-2xl font-bold text-slate-900 dark:text-white">{{ formatNum(data.searches.total) }}</div>
          <div class="text-[10px] text-slate-400 mt-1">今日 {{ formatNum(data.searches.today) }}</div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 lg:p-5">
          <h3 class="font-bold text-sm lg:text-base mb-3 text-slate-900 dark:text-white">浏览趋势</h3>
          <div class="h-64 lg:h-72">
            <VChart :option="pvTrendOption" autoresize class="w-full h-full" />
          </div>
        </div>
        <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 lg:p-5">
          <h3 class="font-bold text-sm lg:text-base mb-3 text-slate-900 dark:text-white">时段活跃度</h3>
          <div class="h-64 lg:h-72">
            <VChart :option="hourlyOption" autoresize class="w-full h-full" />
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 lg:p-5">
          <h3 class="font-bold text-sm lg:text-base mb-3 text-slate-900 dark:text-white">页面热力图</h3>
          <div class="h-64 lg:h-72">
            <VChart :option="heatmapOption" autoresize class="w-full h-full" />
          </div>
        </div>
        <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 lg:p-5">
          <h3 class="font-bold text-sm lg:text-base mb-3 text-slate-900 dark:text-white">搜索词云</h3>
          <div class="h-64 lg:h-72">
            <VChart v-if="data.topSearches.length" :option="wordCloudOption" autoresize class="w-full h-full" />
            <div v-else class="flex items-center justify-center h-full text-slate-400 text-sm">暂无数据</div>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 lg:p-5">
          <h3 class="font-bold text-sm lg:text-base mb-3 text-slate-900 dark:text-white">热门项目</h3>
          <div class="h-64 lg:h-72">
            <VChart v-if="data.topProjects.length" :option="topProjectsOption" autoresize class="w-full h-full" />
            <div v-else class="flex items-center justify-center h-full text-slate-400 text-sm">暂无数据</div>
          </div>
        </div>
        <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 lg:p-5">
          <h3 class="font-bold text-sm lg:text-base mb-3 text-slate-900 dark:text-white">周活跃度</h3>
          <div class="h-64 lg:h-72">
            <VChart :option="weeklyRadarOption" autoresize class="w-full h-full" />
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 lg:p-5">
          <h3 class="font-bold text-sm lg:text-base mb-3 text-slate-900 dark:text-white">分类浏览占比</h3>
          <div class="h-64 lg:h-72">
            <VChart v-if="data.categoryDistribution.length" :option="categoryOption" autoresize class="w-full h-full" />
            <div v-else class="flex items-center justify-center h-full text-slate-400 text-sm">暂无数据</div>
          </div>
        </div>
        <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 lg:p-5">
          <h3 class="font-bold text-sm lg:text-base mb-3 text-slate-900 dark:text-white">热门页面</h3>
          <div class="space-y-1.5 max-h-72 overflow-y-auto">
            <div v-for="(page, i) in data.topPages.slice(0, 15)" :key="page.path" class="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50">
              <span class="text-xs font-mono w-5 text-right" :class="i < 3 ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-400'">{{ i + 1 }}</span>
              <span class="text-sm text-slate-700 dark:text-slate-300 truncate flex-1">{{ page.displayName }}</span>
              <span class="text-xs font-bold text-emerald-600 dark:text-emerald-400">{{ formatNum(page.count) }}</span>
            </div>
            <div v-if="!data.topPages.length" class="text-center py-8 text-slate-400 text-sm">暂无数据</div>
          </div>
        </div>
      </div>
    </template>

    <div v-else class="text-center py-20 text-slate-400">
      <p class="text-sm">暂无分析数据</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import * as echarts from 'echarts/core';
import { LineChart, BarChart, PieChart, TreemapChart, RadarChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent, VisualMapComponent, RadarComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import VChart from 'vue-echarts';
if (typeof window !== 'undefined') {
  await import('echarts-wordcloud/dist/echarts-wordcloud.js');
}
import { adminFetch } from '../../composables/useAdminFetch';

echarts.use([LineChart, BarChart, PieChart, TreemapChart, RadarChart, GridComponent, TooltipComponent, LegendComponent, VisualMapComponent, RadarComponent, CanvasRenderer]);

type AnalyticsData = {
  pv: { total: number; today: number; thisWeek: number };
  uv: { total: number; today: number; thisWeek: number };
  clicks: { total: number; today: number };
  searches: { total: number; today: number };
  dailyPvTrend: Array<{ date: string; pv: number; uv: number }>;
  hourlyDistribution: Array<{ hour: number; pv: number; uv: number }>;
  weeklyDistribution: Array<{ weekday: number; pv: number }>;
  topPages: Array<{ path: string; displayName: string; count: number }>;
  topProjects: Array<{ slug: string; name: string; clicks: number; downloads: number }>;
  topSearches: Array<{ query: string; count: number; avgResults: number }>;
  categoryDistribution: Array<{ category: string; count: number }>;
};

const days = ref(7);
const data = ref<AnalyticsData | null>(null);
const loading = ref(true);

const formatNum = (n: number) => {
  if (n >= 10000) return (n / 10000).toFixed(1) + 'w';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
};

const isDark = computed(() => {
  if (typeof window === 'undefined') return false;
  return document.documentElement.classList.contains('dark');
});

const axisLabelColor = computed(() => isDark.value ? '#94a3b8' : '#64748b');
const splitLineColor = computed(() => isDark.value ? '#334155' : '#e2e8f0');
const cardBg = computed(() => isDark.value ? '#1e293b' : '#fff');
const textColor = computed(() => isDark.value ? '#e2e8f0' : '#334155');

const pvTrendOption = computed(() => ({
  tooltip: { trigger: 'axis' as const, backgroundColor: cardBg.value, borderColor: splitLineColor.value, textStyle: { color: textColor.value } },
  legend: { data: ['PV', 'UV'], textStyle: { color: axisLabelColor.value }, top: 0 },
  grid: { left: 48, right: 16, top: 36, bottom: 24 },
  xAxis: { type: 'category' as const, data: data.value?.dailyPvTrend.map(d => d.date.slice(5)) ?? [], axisLabel: { color: axisLabelColor.value, fontSize: 10 }, axisLine: { lineStyle: { color: splitLineColor.value } } },
  yAxis: { type: 'value' as const, axisLabel: { color: axisLabelColor.value, fontSize: 10 }, splitLine: { lineStyle: { color: splitLineColor.value } } },
  series: [
    { name: 'PV', type: 'line' as const, data: data.value?.dailyPvTrend.map(d => d.pv) ?? [], smooth: true, areaStyle: { opacity: 0.2, color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: '#10b981' }, { offset: 1, color: 'rgba(16,185,129,0.02)' }]) }, itemStyle: { color: '#10b981' }, lineStyle: { width: 2 } },
    { name: 'UV', type: 'line' as const, data: data.value?.dailyPvTrend.map(d => d.uv) ?? [], smooth: true, areaStyle: { opacity: 0.15, color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: '#6366f1' }, { offset: 1, color: 'rgba(99,102,241,0.02)' }]) }, itemStyle: { color: '#6366f1' }, lineStyle: { width: 2 } }
  ]
}));

const hourlyOption = computed(() => {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const pvByHour = new Map(data.value?.hourlyDistribution.map(h => [h.hour, h.pv]) ?? []);
  const uvByHour = new Map(data.value?.hourlyDistribution.map(h => [h.hour, h.uv]) ?? []);
  return {
    tooltip: { trigger: 'axis' as const, backgroundColor: cardBg.value, borderColor: splitLineColor.value, textStyle: { color: textColor.value } },
    legend: { data: ['PV', 'UV'], textStyle: { color: axisLabelColor.value }, top: 0 },
    grid: { left: 48, right: 16, top: 36, bottom: 24 },
    xAxis: { type: 'category' as const, data: hours.map(h => `${h}:00`), axisLabel: { color: axisLabelColor.value, fontSize: 9, interval: 2 }, axisLine: { lineStyle: { color: splitLineColor.value } } },
    yAxis: { type: 'value' as const, axisLabel: { color: axisLabelColor.value, fontSize: 10 }, splitLine: { lineStyle: { color: splitLineColor.value } } },
    series: [
      { name: 'PV', type: 'bar' as const, data: hours.map(h => pvByHour.get(h) ?? 0), itemStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: '#10b981' }, { offset: 1, color: '#6ee7b7' }]), borderRadius: [3, 3, 0, 0] }, barWidth: '40%' },
      { name: 'UV', type: 'bar' as const, data: hours.map(h => uvByHour.get(h) ?? 0), itemStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: '#6366f1' }, { offset: 1, color: '#a5b4fc' }]), borderRadius: [3, 3, 0, 0] }, barWidth: '40%' }
    ]
  };
});

const heatmapOption = computed(() => {
  const pages = data.value?.topPages ?? [];
  const maxVal = Math.max(...pages.map(p => p.count), 1);
  return {
    tooltip: { formatter: (info: any) => `${info.name}<br/>浏览量: ${info.value}` },
    series: [{
      type: 'treemap' as const,
      data: pages.map(p => ({ name: p.displayName, value: p.count })),
      roam: false,
      nodeClick: false,
      breadcrumb: { show: false },
      label: { show: true, formatter: (info: any) => info.name.length > 14 ? info.name.slice(0, 14) + '…' : info.name, fontSize: 10, color: '#fff' },
      itemStyle: { borderColor: isDark.value ? '#1e293b' : '#fff', borderWidth: 2, gapWidth: 2 },
      visualMin: 0,
      visualMax: maxVal,
      colorMappingBy: 'value' as const
    }],
    visualMap: {
      show: false,
      min: 0,
      max: maxVal,
      inRange: { color: ['#818cf8', '#6366f1', '#4f46e5', '#4338ca'] }
    }
  };
});

const wordCloudOption = computed(() => {
  const searches = data.value?.topSearches ?? [];
  if (!searches.length) return {};
  const maxCount = Math.max(...searches.map(s => s.count), 1);
  return {
    tooltip: { show: true, formatter: (info: any) => `${info.name}: ${info.value}次` },
    series: [{
      type: 'wordCloud' as any,
      shape: 'circle' as const,
      left: 'center',
      top: 'center',
      width: '90%',
      height: '90%',
      sizeRange: [12, 48],
      rotationRange: [-30, 30],
      rotationStep: 15,
      gridSize: 8,
      drawOutOfBound: false,
      textStyle: {
        fontFamily: 'sans-serif',
        fontWeight: 'bold',
        color: () => {
          const colors = ['#10b981', '#6366f1', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'];
          return colors[Math.floor(Math.random() * colors.length)];
        }
      },
      emphasis: { textStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.15)' } },
      data: searches.map(s => ({ name: s.query, value: s.count, textStyle: { fontSize: Math.max(12, Math.round(48 * (s.count / maxCount))) } }))
    }]
  };
});

const topProjectsOption = computed(() => ({
  tooltip: { trigger: 'axis' as const, axisPointer: { type: 'shadow' as const }, backgroundColor: cardBg.value, borderColor: splitLineColor.value, textStyle: { color: textColor.value } },
  legend: { data: ['点击', '下载'], textStyle: { color: axisLabelColor.value }, top: 0 },
  grid: { left: 100, right: 40, top: 36, bottom: 8 },
  xAxis: { type: 'value' as const, axisLabel: { color: axisLabelColor.value, fontSize: 10 }, splitLine: { lineStyle: { color: splitLineColor.value } } },
  yAxis: { type: 'category' as const, data: [...(data.value?.topProjects ?? [])].reverse().map(p => p.name.length > 12 ? p.name.slice(0, 12) + '…' : p.name), axisLabel: { color: axisLabelColor.value, fontSize: 10 }, axisLine: { lineStyle: { color: splitLineColor.value } } },
  series: [
    { name: '点击', type: 'bar' as const, stack: 'total', data: [...(data.value?.topProjects ?? [])].reverse().map(p => p.clicks), itemStyle: { color: '#10b981', borderRadius: [0, 0, 0, 0] } },
    { name: '下载', type: 'bar' as const, stack: 'total', data: [...(data.value?.topProjects ?? [])].reverse().map(p => p.downloads), itemStyle: { color: '#6366f1', borderRadius: [0, 4, 4, 0] } }
  ]
}));

const weeklyRadarOption = computed(() => {
  const weekdays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  const pvByDay = new Map(data.value?.weeklyDistribution.map(w => [w.weekday, w.pv]) ?? []);
  const values = [1, 2, 3, 4, 5, 6, 7].map(d => pvByDay.get(d) ?? 0);
  const maxVal = Math.max(...values, 1);
  return {
    tooltip: { backgroundColor: cardBg.value, borderColor: splitLineColor.value, textStyle: { color: textColor.value } },
    radar: {
      indicator: weekdays.map(name => ({ name, max: maxVal })),
      shape: 'polygon' as const,
      splitNumber: 4,
      axisName: { color: axisLabelColor.value, fontSize: 11 },
      splitLine: { lineStyle: { color: splitLineColor.value } },
      splitArea: { areaStyle: { color: isDark.value ? ['rgba(99,102,241,0.02)', 'rgba(99,102,241,0.05)'] : ['rgba(99,102,241,0.02)', 'rgba(99,102,241,0.06)'] } },
      axisLine: { lineStyle: { color: splitLineColor.value } }
    },
    series: [{
      type: 'radar' as const,
      data: [{
        value: values,
        name: '浏览量',
        areaStyle: { color: 'rgba(99,102,241,0.2)' },
        lineStyle: { color: '#6366f1', width: 2 },
        itemStyle: { color: '#6366f1' }
      }]
    }]
  };
});

const categoryOption = computed(() => ({
  tooltip: { trigger: 'item' as const, formatter: (info: any) => `${info.name}: ${info.value} (${info.percent}%)`, backgroundColor: cardBg.value, borderColor: splitLineColor.value, textStyle: { color: textColor.value } },
  legend: { orient: 'vertical' as const, right: 0, top: 'center', textStyle: { color: axisLabelColor.value, fontSize: 11 }, itemWidth: 10, itemHeight: 10 },
  series: [{
    type: 'pie' as const,
    radius: ['30%', '65%'],
    center: ['35%', '50%'],
    roseType: 'radius' as const,
    label: { show: false },
    emphasis: { label: { show: true, fontSize: 12, fontWeight: 'bold' } },
    data: data.value?.categoryDistribution.map(c => ({ name: c.category, value: c.count })) ?? [],
    itemStyle: { borderRadius: 6, borderColor: isDark.value ? '#1e293b' : '#fff', borderWidth: 2 }
  }]
}));

async function fetchData() {
  loading.value = true;
  try {
    const res = await adminFetch(`/api/admin/analytics?days=${days.value}`);
    if (res.ok) data.value = await res.json();
  } catch (e) {
    console.error('Analytics fetch error:', e);
  } finally {
    loading.value = false;
  }
}

watch(days, () => { void fetchData(); });
onMounted(() => { void fetchData(); });
</script>
