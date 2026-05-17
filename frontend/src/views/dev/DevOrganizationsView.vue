<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-bold text-slate-900 dark:text-white">我的组织</h2>
      <router-link to="/dev/organizations/create" class="px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold shadow-lg shadow-blue-500/20 transition-all">
        创建组织
      </router-link>
    </div>

    <ui-LoadingSpinner v-if="loading" brand="dev" />

    <div v-else-if="organizations.length === 0" class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
      <ui-EmptyState :icon="Building2" title="暂无组织" description="创建或加入组织后即可在此管理" containerClass="p-10" />
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <router-link
        v-for="org in organizations"
        :key="org.id"
        :to="`/dev/organizations/${org.id}`"
        class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 hover:shadow-md transition-shadow flex flex-col gap-3"
      >
        <div class="flex items-center gap-3">
          <ui-Avatar :src="org.avatar_url" :name="org.name" size="md" rounded="default" />
          <div class="flex-1 min-w-0">
            <div class="font-bold text-sm truncate text-slate-900 dark:text-white">{{ org.name }}</div>
            <div class="text-xs text-slate-400 truncate">{{ org.slug }}</div>
          </div>
        </div>
        <p class="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{{ org.description || '暂无描述' }}</p>
        <div class="flex items-center gap-2 mt-auto">
          <span class="text-[10px] px-1.5 py-0.5 rounded font-medium" :class="org.member_role === 'owner' ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400' : org.member_role === 'admin' ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'">
            {{ org.member_role === 'owner' ? '所有者' : org.member_role === 'admin' ? '管理员' : '成员' }}
          </span>
          <ui-StatusBadge :status="org.status" :label="orgStatusLabel(org.status)" />
        </div>
      </router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { adminFetch } from '../../composables/useAdminFetch';
import { API } from '../../api/endpoints';
import { Building2 } from 'lucide-vue-next';
import { LoadingSpinner as uiLoadingSpinner, EmptyState as uiEmptyState, StatusBadge as uiStatusBadge, Avatar as uiAvatar } from '../../components/ui';

const organizations = ref<any[]>([]);
const loading = ref(true);

const orgStatusLabel = (s: string) => {
  if (s === 'pending') return '审核中';
  if (s === 'suspended') return '已暂停';
  return undefined;
};

onMounted(async () => {
  try {
    const res = await adminFetch(API.dev.organizations);
    if (res.ok) {
      const json = await res.json();
      organizations.value = Array.isArray(json) ? json : (json.items ?? []);
    }
  } catch (e) {
    console.error('Fetch dev organizations error:', e);
  } finally {
    loading.value = false;
  }
});
</script>
