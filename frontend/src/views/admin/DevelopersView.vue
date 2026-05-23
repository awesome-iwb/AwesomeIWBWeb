<template>
  <div class="h-full min-h-0 flex flex-col space-y-4">
    <div class="shrink-0 flex flex-wrap gap-2">
      <button
        v-if="hasCapability('dev:developer_manage')"
        @click="goTab('developers')"
        class="px-5 py-2.5 rounded-xl text-base sm:text-sm font-bold transition-colors min-h-[44px] min-w-[44px]"
        :class="activeTab === 'developers' ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20' : 'bg-secondary text-muted-foreground hover:bg-accent'"
      >开发者</button>
      <button
        v-if="hasCapability('org:review')"
        @click="goTab('organizations')"
        class="px-5 py-2.5 rounded-xl text-base sm:text-sm font-bold transition-colors min-h-[44px] min-w-[44px]"
        :class="activeTab === 'organizations' ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20' : 'bg-secondary text-muted-foreground hover:bg-accent'"
      >组织</button>
      <button
        v-if="hasCapability('claim:review')"
        @click="goTab('claims')"
        class="px-4 py-2 rounded-xl text-base sm:text-xs font-semibold transition-colors border border-transparent min-h-[44px] min-w-[44px]"
        :class="activeTab === 'claims' ? 'bg-muted text-foreground border-slate-300 dark:border-slate-500' : 'bg-card/80 text-muted-foreground hover:bg-accent border-border'"
      >认领审核</button>
    </div>

    <div v-show="activeTab === 'developers'" class="flex-1 min-h-0">
      <ui-ListDetailLayout
        :selected-id="selectedDevId"
        :selected-item-label="selectedDev?.name"
        :selected-item-icon="UsersIcon"
        :searchable="false"
        :page="devsPage.page"
        :total="devsPage.total"
        :page-size="devsPage.pageSize"
        list-title="开发者列表"
        detail-title="开发者详情"
        @update:page="onDevPageChange"
        @back="selectedDevId = null, selectedDev = null"
      >
        <template #detail>
          <div v-if="selectedDev" class="bg-card rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col">
            <div class="p-4 sm:p-5 lg:p-6 border-b border-border bg-accent/50 dark:bg-slate-900/50">
              <div class="flex items-center gap-4">
                <div class="w-14 h-14 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xl font-bold shrink-0">
                  <img v-if="selectedDev.avatar_url" :src="selectedDev.avatar_url" class="w-full h-full rounded-full object-cover" />
                  <span v-else>{{ (selectedDev.name || '?').charAt(0).toUpperCase() }}</span>
                </div>
                <div class="min-w-0">
                  <h2 class="text-lg lg:text-xl font-bold text-foreground truncate">{{ selectedDev.name }}</h2>
                  <div v-if="selectedDev.email" class="text-base sm:text-sm text-muted-foreground truncate">{{ selectedDev.email }}</div>
                  <div v-if="selectedDev.created_at" class="text-base sm:text-xs text-muted-foreground mt-0.5">加入时间: {{ new Date(selectedDev.created_at).toLocaleDateString() }}</div>
                </div>
              </div>
            </div>
            <div class="flex-1 overflow-y-auto p-4 sm:p-5 lg:p-8 space-y-4 lg:space-y-6">
              <div class="space-y-2">
                <div class="text-base sm:text-sm font-extrabold text-muted-foreground">关联组织 ({{ devOrgs.length }})</div>
                <div v-if="devOrgs.length" class="space-y-2">
                  <div v-for="org in devOrgs" :key="org.id" class="flex items-center gap-3 p-3 rounded-xl bg-card/50 min-h-[48px]">
                    <div class="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold shrink-0">
                      <img v-if="org.avatar_url" :src="org.avatar_url" class="w-full h-full rounded-full object-cover" />
                      <span v-else>{{ (org.name || '?').charAt(0).toUpperCase() }}</span>
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="text-base sm:text-sm font-bold text-foreground truncate">{{ org.name }}</div>
                      <div class="text-base sm:text-xs text-muted-foreground">{{ org.slug }}</div>
                    </div>
                    <span v-if="org.role" class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">{{ org.role }}</span>
                  </div>
                </div>
                <div v-else class="text-base sm:text-sm text-slate-400 py-2">暂无关联组织</div>
              </div>
              <div class="space-y-2">
                <div class="text-base sm:text-sm font-extrabold text-muted-foreground">关联项目 ({{ devProjects.length }})</div>
                <div v-if="devProjects.length" class="space-y-2">
                  <div v-for="proj in devProjects" :key="proj.id || proj.name" class="flex items-center gap-3 p-3 rounded-xl bg-card/50 min-h-[48px]">
                    <div class="w-8 h-8 rounded bg-muted flex items-center justify-center text-xs font-bold text-slate-500 shrink-0">
                      <img v-if="proj.icon" :src="proj.icon" class="w-full h-full rounded object-contain p-0.5" />
                      <span v-else>{{ (proj.name || '?').charAt(0) }}</span>
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="text-base sm:text-sm font-bold text-foreground truncate">{{ proj.name }}</div>
                      <div class="text-base sm:text-xs text-muted-foreground">{{ proj.role || '成员' }}</div>
                    </div>
                  </div>
                </div>
                <div v-else class="text-base sm:text-sm text-slate-400 py-2">暂无关联项目</div>
              </div>
            </div>
          </div>
        </template>

        <template #empty-detail>
          <div class="flex items-center justify-center border-2 border-dashed border-border rounded-2xl min-h-[400px]">
            <div class="text-center">
              <p class="text-slate-400 mb-2">从列表选择开发者</p>
            </div>
          </div>
        </template>

        <template #list-toolbar>
          <input v-model="devQuery" @keyup.enter="fetchDevs" type="text" class="w-full px-3 py-3 sm:py-2.5 rounded-xl border border-border bg-card outline-none focus:border-emerald-500 text-base sm:text-sm min-h-[48px] sm:min-h-[40px]" placeholder="搜索开发者名称" />
        </template>

        <template #list>
          <div class="space-y-1.5">
              <div
                v-for="dev in devsPage.items"
                :key="dev.id"
                @click="selectDev(dev)"
                class="p-3 rounded-xl border cursor-pointer transition-all duration-200 flex items-center gap-3 min-h-[48px]"
                :class="selectedDevId === dev.id ? 'bg-[var(--color-brand-50)] dark:bg-[var(--color-brand-500)]/10 border-l-[3px] border-l-[var(--color-brand-500)] border-y border-r border-transparent' : 'bg-card/50 border-transparent hover:bg-accent/80'"
              >
                <div class="w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-xs font-bold shrink-0">
                  <img v-if="dev.avatar_url" :src="dev.avatar_url" class="w-full h-full rounded-full object-cover" />
                  <span v-else>{{ (dev.name || '?').charAt(0).toUpperCase() }}</span>
                </div>
                <div class="flex-1 min-w-0">
                  <div class="font-medium text-base sm:text-sm truncate text-foreground">{{ dev.name }}</div>
                  <div class="text-base sm:text-xs text-muted-foreground truncate mt-0.5">
                    <span>{{ dev.org_count ?? 0 }} 个组织</span>
                    <span class="mx-1">·</span>
                    <span>{{ dev.project_count ?? 0 }} 个项目</span>
                  </div>
                </div>
              </div>
              <ui-EmptyState v-if="devsPage.items.length === 0" :icon="UsersIcon" title="暂无开发者" />
            </div>
        </template>
      </ui-ListDetailLayout>
    </div>

    <div v-show="activeTab === 'organizations'" class="flex-1 min-h-0">
      <AdminOrganizationsView />
    </div>

    <div v-show="activeTab === 'claims'" class="flex-1 min-h-0">
      <AdminClaimsView />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuth } from '../../composables/useAuth';
import { adminFetch } from '../../composables/useAdminFetch';
import AdminOrganizationsView from './AdminOrganizationsView.vue';
import AdminClaimsView from './AdminClaimsView.vue';
const _tabOrgs = AdminOrganizationsView;
const _tabClaims = AdminClaimsView;
void _tabOrgs; void _tabClaims;

import { ListDetailLayout as uiListDetailLayout, EmptyState as uiEmptyState } from '../../components/ui';
import { Users as UsersIcon } from 'lucide-vue-next';

const route = useRoute();
const router = useRouter();
const { hasCapability, capabilities } = useAuth();

type TabId = 'developers' | 'organizations' | 'claims';
const activeTab = ref<TabId>('developers');

function allowedTabs(): TabId[] {
  const keys: TabId[] = [];
  if (hasCapability('dev:developer_manage')) keys.push('developers');
  if (hasCapability('org:review')) keys.push('organizations');
  if (hasCapability('claim:review')) keys.push('claims');
  return keys;
}

function resolveTab(): TabId {
  const keys = allowedTabs();
  const q = route.query.tab as string | undefined;
  if (q === 'organizations' && keys.includes('organizations')) return 'organizations';
  if (q === 'claims' && keys.includes('claims')) return 'claims';
  if (q === 'developers' && keys.includes('developers')) return 'developers';
  return keys[0] ?? 'developers';
}

watch(
  () => [route.query.tab, [...capabilities.value].sort().join(',')],
  () => {
    activeTab.value = resolveTab();
  },
  { immediate: true }
);

const goTab = (t: TabId) => {
  router.replace({ path: '/admin/developers', query: { ...route.query, tab: t } });
};

const devsPage = ref<{ items: any[]; page: number; pageSize: number; total: number }>({ items: [], page: 1, pageSize: 20, total: 0 });
const devQuery = ref('');
const selectedDevId = ref<string | null>(null);
const selectedDev = ref<any | null>(null);
const devOrgs = ref<any[]>([]);
const devProjects = ref<any[]>([]);

const fetchDevs = async () => {
  try {
    const qs = new URLSearchParams();
    if (devQuery.value) qs.set('q', devQuery.value);
    qs.set('page', String(devsPage.value.page));
    qs.set('pageSize', String(devsPage.value.pageSize));
    const res = await adminFetch(`/api/admin/developers?${qs.toString()}`);
    if (!res.ok) return;
    devsPage.value = await res.json();
  } catch {}
};

const selectDev = async (dev: any) => {
  selectedDevId.value = dev.id;
  selectedDev.value = dev;
  devOrgs.value = dev.organizations ?? [];
  devProjects.value = dev.projects ?? [];
  try {
    const res = await adminFetch(`/api/admin/developers/${encodeURIComponent(dev.id)}`);
    if (res.ok) {
      const detail = await res.json();
      selectedDev.value = detail;
      devOrgs.value = detail.organizations ?? [];
      devProjects.value = detail.projects ?? [];
    }
  } catch {}
};

const onDevPageChange = async (newPage: number) => {
  devsPage.value.page = newPage;
  await fetchDevs();
};

onMounted(() => { fetchDevs(); });
</script>
