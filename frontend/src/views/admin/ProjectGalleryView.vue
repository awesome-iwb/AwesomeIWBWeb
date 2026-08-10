<template>
  <div class="space-y-4">
    <!-- 数据概览（累计曝光 / 点击） -->
    <div class="bg-card rounded-2xl border border-border shadow-sm p-4 sm:p-6">
      <div class="flex items-center justify-between mb-3">
        <h3 class="font-bold text-sm text-muted-foreground">详情图数据概览（累计曝光 / 点击）</h3>
        <button @click="loadStats" class="text-xs text-blue-500 hover:underline">刷新</button>
      </div>
      <div v-if="statsLoading" class="text-sm text-muted-foreground">加载中...</div>
      <div v-else-if="stats.length === 0" class="text-sm text-muted-foreground">暂无统计数据。</div>
      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left text-muted-foreground">
              <th class="py-2 pr-4 font-medium">项目</th>
              <th class="py-2 pr-4 font-medium">素材</th>
              <th class="py-2 pr-4 font-medium">类型</th>
              <th class="py-2 pr-4 font-medium text-right">曝光</th>
              <th class="py-2 font-medium text-right">点击</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in stats" :key="s.item_id" class="border-t border-border">
              <td class="py-2 pr-4 truncate max-w-[160px]">{{ s.project_name || '-' }}</td>
              <td class="py-2 pr-4 truncate max-w-[200px]">{{ s.title || '(无标题)' }}</td>
              <td class="py-2 pr-4">{{ mediaTypeLabel(s.media_type) }}</td>
              <td class="py-2 pr-4 text-right tabular-nums">{{ s.impressions }}</td>
              <td class="py-2 text-right tabular-nums">{{ s.clicks }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <ListDetailLayout
      :selected-id="selectedProjectId"
      list-title="选择项目"
      searchable
      :search-model="projectSearch"
      search-placeholder="搜索项目..."
      @update:search-model="onSearchInput"
      @select="selectProject"
    >
      <template #list>
        <div v-if="projectLoading" class="text-sm text-muted-foreground">加载中...</div>
        <button
          v-for="p in projectList"
          :key="p.id"
          @click="selectProject(p.id)"
          class="w-full text-left px-3 py-3 rounded-xl border border-border hover:bg-accent transition-colors"
          :class="p.id === selectedProjectId ? 'border-blue-500 bg-blue-500/10' : ''"
        >
          <div class="text-sm font-bold text-foreground truncate">{{ p.name }}</div>
          <div class="text-xs text-muted-foreground truncate">@{{ p.slug }}</div>
        </button>
        <div v-if="!projectLoading && projectList.length === 0" class="text-sm text-muted-foreground text-center py-4">无匹配项目</div>
      </template>

      <template #detail>
        <ProjectGalleryEditor v-if="selectedProjectId" mode="admin" :project-id="selectedProjectId" />
      </template>
    </ListDetailLayout>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { adminFetch } from '../../composables/useAdminFetch';
import { API } from '../../api/endpoints';
import { ListDetailLayout } from '../../components/ui';
import ProjectGalleryEditor from '../../components/projects/ProjectGalleryEditor.vue';

interface GalleryStatsRow {
  item_id: string;
  project_id: string;
  project_name: string;
  project_slug: string;
  media_type: 'image' | 'text' | 'video_embed';
  title: string;
  impressions: number;
  clicks: number;
}

interface ProjectSummary {
  id: string;
  name: string;
  slug: string;
}

const selectedProjectId = ref<string | null>(null);
const projectSearch = ref('');
const projectList = ref<ProjectSummary[]>([]);
const projectLoading = ref(false);
const stats = ref<GalleryStatsRow[]>([]);
const statsLoading = ref(true);

let searchTimer: ReturnType<typeof setTimeout> | null = null;

function mediaTypeLabel(t: GalleryStatsRow['media_type']): string {
  return t === 'image' ? '图片' : t === 'text' ? '文字' : '视频';
}

const loadProjects = async (q = '') => {
  projectLoading.value = true;
  try {
    const res = await fetch('/api/projects', { cache: 'no-store' });
    if (!res.ok) {
      projectList.value = [];
      return;
    }
    const data = await res.json();
    const cats = Array.isArray(data?.categories) ? data.categories : [];
    const all: any[] = [];
    for (const c of cats) if (Array.isArray(c.projects)) all.push(...c.projects);
    const qt = q.trim().toLowerCase();
    projectList.value = all
      .filter((p) => !qt || (p.name || '').toLowerCase().includes(qt) || (p.slug || '').toLowerCase().includes(qt))
      .slice(0, 100)
      .map((p) => ({ id: String(p.id), name: p.name || '', slug: p.slug || '' }));
  } catch {
    projectList.value = [];
  } finally {
    projectLoading.value = false;
  }
};

const onSearchInput = (val: string) => {
  projectSearch.value = val;
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => loadProjects(projectSearch.value), 300);
};

const selectProject = (id: string) => {
  selectedProjectId.value = id;
};

const loadStats = async () => {
  statsLoading.value = true;
  try {
    const res = await adminFetch(API.admin.projectGalleryStats);
    if (res.ok) {
      const json = await res.json();
      stats.value = (json.items ?? []) as GalleryStatsRow[];
    }
  } catch (e) {
    console.error('Load gallery stats error:', e);
  } finally {
    statsLoading.value = false;
  }
};

onMounted(() => {
  loadProjects();
  loadStats();
});
</script>
