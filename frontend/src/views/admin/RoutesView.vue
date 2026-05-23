<template>
  <div class="h-full min-h-0">
    <ui-ListDetailLayout
      :selected-id="selectedPageId"
      :searchable="true"
      search-placeholder="搜索路由..."
      :search-model="searchQuery"
      list-title="路由管理"
      :selected-item-label="selectedPage?.title"
      :selected-item-icon="Route"
      @update:search-model="searchQuery = $event"
    >
      <template #list-toolbar>
        <div class="flex items-center gap-2">
          <select
            v-model="groupFilter"
            class="flex-1 px-3 py-2 rounded-xl border border-border bg-card text-sm outline-none focus:border-[var(--color-brand-500)] transition-colors"
          >
            <option value="">全部分组</option>
            <option v-for="g in groups" :key="g" :value="g">{{ g }}</option>
          </select>
          <button
            type="button"
            class="px-3 py-2 rounded-xl text-sm font-bold bg-[var(--color-brand-500)] text-white hover:bg-[var(--color-brand-600)] transition-colors"
            :disabled="syncing"
            @click="handleSync"
          >
            {{ syncing ? '同步中...' : '同步路由' }}
          </button>
        </div>
      </template>

      <template #list>
        <div v-if="loading" class="py-10 flex justify-center">
          <ui-LoadingSpinner brand="admin" />
        </div>
        <div v-else class="space-y-1.5">
          <div
            v-for="page in filteredPages"
            :key="page.id"
            @click="selectPage(page)"
            class="p-3 rounded-xl border cursor-pointer transition-all duration-200 flex items-center gap-3"
            :class="selectedPageId === page.id
              ? 'bg-[var(--color-brand-50)] dark:bg-[var(--color-brand-500)]/10 border-l-[3px] border-l-[var(--color-brand-500)] border-y border-r border-transparent'
              : 'bg-card/50 border-transparent hover:bg-accent/80'"
          >
            <component :is="iconComponent(page.icon)" class="w-5 h-5 text-slate-400 shrink-0" />
            <div class="flex-1 min-w-0">
              <div class="font-medium text-sm truncate text-foreground">{{ page.title }}</div>
              <div class="text-xs text-muted-foreground truncate mt-0.5">{{ page.path }}</div>
            </div>
            <span
              v-if="page.required_capability"
              class="text-[10px] px-1.5 py-0.5 rounded-md bg-secondary text-muted-foreground shrink-0"
            >{{ page.required_capability }}</span>
          </div>
          <ui-EmptyState v-if="filteredPages.length === 0" :icon="Route" title="暂无路由" />
        </div>
      </template>

      <template #detail>
        <div v-if="selectedPage" class="p-4 lg:p-6 space-y-4 lg:space-y-6">
          <div class="flex items-center justify-between">
            <h2 class="text-base font-bold text-foreground">{{ selectedPage.title }}</h2>
            <button
              type="button"
              class="px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors"
              @click="handleDelete"
            >删除</button>
          </div>

          <div class="space-y-3">
            <div>
              <label class="block text-xs font-bold text-muted-foreground mb-1">路径</label>
              <input
                v-model="draft.path"
                type="text"
                class="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-sm outline-none focus:border-[var(--color-brand-500)] transition-colors"
              />
            </div>

            <div>
              <label class="block text-xs font-bold text-muted-foreground mb-1">标题</label>
              <input
                v-model="draft.title"
                type="text"
                class="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-sm outline-none focus:border-[var(--color-brand-500)] transition-colors"
              />
            </div>

            <div>
              <label class="block text-xs font-bold text-muted-foreground mb-1">备注</label>
              <textarea
                v-model="draft.description"
                rows="3"
                class="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-sm outline-none focus:border-[var(--color-brand-500)] transition-colors resize-none"
              />
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-bold text-muted-foreground mb-1">分组</label>
                <input
                  v-model="draft.group"
                  type="text"
                  class="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-sm outline-none focus:border-[var(--color-brand-500)] transition-colors"
                />
              </div>
              <div>
                <label class="block text-xs font-bold text-muted-foreground mb-1">图标</label>
                <input
                  v-model="draft.icon"
                  type="text"
                  class="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-sm outline-none focus:border-[var(--color-brand-500)] transition-colors"
                  placeholder="Lucide icon name"
                />
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-bold text-muted-foreground mb-1">所需权限</label>
                <input
                  v-model="draft.required_capability"
                  type="text"
                  class="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-sm outline-none focus:border-[var(--color-brand-500)] transition-colors"
                  placeholder="如 admin_panel_access"
                />
              </div>
              <div>
                <label class="block text-xs font-bold text-muted-foreground mb-1">排序</label>
                <input
                  v-model.number="draft.sort_index"
                  type="number"
                  class="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-sm outline-none focus:border-[var(--color-brand-500)] transition-colors"
                />
              </div>
            </div>

            <div class="flex items-center gap-3">
              <label class="text-xs font-bold text-muted-foreground">导航可见</label>
              <button
                type="button"
                class="relative w-10 h-6 rounded-full transition-colors duration-200"
                :class="draft.is_visible ? 'bg-[var(--color-brand-500)]' : 'bg-muted'"
                @click="draft.is_visible = !draft.is_visible"
              >
                <span
                  class="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200"
                  :class="draft.is_visible ? 'translate-x-4' : 'translate-x-0'"
                />
              </button>
            </div>
          </div>

          <div class="flex items-center gap-3 pt-2">
            <button
              type="button"
              class="px-4 py-2 rounded-xl text-sm font-bold bg-[var(--color-brand-500)] text-white hover:bg-[var(--color-brand-600)] transition-colors"
              @click="handleSave"
            >保存修改</button>
            <span v-if="saveMsg" class="text-xs text-slate-500">{{ saveMsg }}</span>
          </div>
        </div>
      </template>
    </ui-ListDetailLayout>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { Route } from 'lucide-vue-next';
import * as lucideIcons from 'lucide-vue-next';
import { adminFetch } from '../../composables/useAdminFetch';

type PageItem = {
  id: string;
  path: string;
  title: string;
  description: string;
  group: string;
  icon: string;
  required_capability: string;
  is_visible: boolean;
  sort_index: number;
  created_at: string;
  updated_at: string;
};

const pages = ref<PageItem[]>([]);
const loading = ref(true);
const selectedPageId = ref<string | null>(null);
const searchQuery = ref('');
const groupFilter = ref('');
const syncing = ref(false);
const saveMsg = ref('');

const draft = ref({
  path: '',
  title: '',
  description: '',
  group: '',
  icon: '',
  required_capability: '',
  is_visible: true,
  sort_index: 0,
});

const groups = computed(() => {
  const set = new Set(pages.value.map(p => p.group).filter(Boolean));
  return Array.from(set).sort();
});

const filteredPages = computed(() => {
  let result = pages.value;
  if (groupFilter.value) {
    result = result.filter(p => p.group === groupFilter.value);
  }
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase();
    result = result.filter(p =>
      p.path.toLowerCase().includes(q) ||
      p.title.toLowerCase().includes(q) ||
      p.required_capability.toLowerCase().includes(q)
    );
  }
  return result;
});

const selectedPage = computed(() =>
  pages.value.find(p => p.id === selectedPageId.value) ?? null
);

function selectPage(page: PageItem) {
  selectedPageId.value = page.id;
}

watch(selectedPage, (page) => {
  if (page) {
    draft.value = {
      path: page.path,
      title: page.title,
      description: page.description,
      group: page.group,
      icon: page.icon,
      required_capability: page.required_capability,
      is_visible: page.is_visible,
      sort_index: page.sort_index,
    };
  }
  saveMsg.value = '';
});

function iconComponent(iconName: string) {
  if (!iconName) return Route;
  return (lucideIcons as any)[iconName] ?? Route;
}

async function fetchPages() {
  loading.value = true;
  try {
    const params = new URLSearchParams();
    if (groupFilter.value) params.set('group', groupFilter.value);
    const res = await adminFetch(`/api/admin/pages?${params}`);
    if (res.ok) {
      const data = await res.json();
      pages.value = data.items ?? [];
    }
  } finally {
    loading.value = false;
  }
}

async function handleSave() {
  if (!selectedPageId.value) return;
  saveMsg.value = '';
  const res = await adminFetch(`/api/admin/pages/${selectedPageId.value}`, {
    method: 'PUT',
    body: JSON.stringify(draft.value),
  });
  if (res.ok) {
    saveMsg.value = '已保存';
    await fetchPages();
  } else {
    saveMsg.value = '保存失败';
  }
}

async function handleDelete() {
  if (!selectedPageId.value) return;
  if (!confirm('确定删除此路由记录？')) return;
  const res = await adminFetch(`/api/admin/pages/${selectedPageId.value}`, { method: 'DELETE' });
  if (res.ok) {
    selectedPageId.value = null;
    await fetchPages();
  }
}

async function handleSync() {
  syncing.value = true;
  try {
    const res = await adminFetch('/api/admin/pages/sync', { method: 'POST' });
    if (res.ok) {
      const result = await res.json();
      await fetchPages();
      saveMsg.value = `同步完成：新增 ${result.created}，更新 ${result.updated}`;
    }
  } finally {
    syncing.value = false;
  }
}

onMounted(() => { fetchPages(); });
</script>
