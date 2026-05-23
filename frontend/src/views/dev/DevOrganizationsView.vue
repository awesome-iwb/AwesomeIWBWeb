<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-bold text-foreground">我的组织</h2>
      <router-link to="/dev/organizations/create" class="px-4 py-3 sm:py-2 min-h-[48px] sm:min-h-[44px] rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold shadow-lg shadow-blue-500/20 transition-all inline-flex items-center justify-center">
        创建组织
      </router-link>
    </div>

    <ui-LoadingSpinner v-if="loading" brand="dev" />

    <div v-else-if="organizations.length === 0" class="bg-card rounded-2xl border border-border shadow-sm">
      <ui-EmptyState :icon="Building2" title="暂无组织" description="创建或加入组织后即可在此管理" containerClass="p-10" />
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <router-link
        v-for="org in organizations"
        :key="org.id"
        :to="`/dev/organizations/${org.id}`"
        class="bg-card rounded-2xl border border-border shadow-sm p-4 sm:p-5 hover:shadow-md transition-shadow flex flex-col gap-3"
      >
        <div class="flex items-center gap-3">
          <Avatar class="w-10 h-10 rounded-xl">
            <AvatarImage :src="org.avatar_url" :alt="org.name" />
            <AvatarFallback>{{ org.name?.charAt(0)?.toUpperCase() || '?' }}</AvatarFallback>
          </Avatar>
          <div class="flex-1 min-w-0">
            <div class="font-bold text-sm truncate text-foreground">{{ org.name }}</div>
            <div class="text-xs text-slate-400 truncate">{{ org.slug }}</div>
          </div>
        </div>
        <p class="text-xs text-muted-foreground line-clamp-2">{{ org.description || '暂无描述' }}</p>
        <div class="flex items-center gap-2 mt-auto">
          <span class="text-[10px] px-1.5 py-0.5 rounded font-medium" :class="org.member_role === 'owner' ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400' : org.member_role === 'admin' ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'bg-secondary text-slate-500'">
            {{ org.member_role === 'owner' ? '所有者' : org.member_role === 'admin' ? '管理员' : '成员' }}
          </span>
          <Badge :variant="getStatusConfig(org.status).variant" :class="getStatusConfig(org.status).class">
            {{ orgStatusLabel(org.status) || getStatusConfig(org.status).label }}
          </Badge>
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
import { LoadingSpinner as uiLoadingSpinner, EmptyState as uiEmptyState } from '../../components/ui';
import { Badge, getStatusConfig } from '../../components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '../../components/ui/avatar';

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
