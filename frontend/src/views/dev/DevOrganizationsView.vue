<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-bold text-slate-900 dark:text-white">我的组织</h2>
      <router-link to="/dev/organizations/create" class="px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold shadow-lg shadow-blue-500/20 transition-all">
        创建组织
      </router-link>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-20">
      <div class="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
    </div>

    <div v-else-if="organizations.length === 0" class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-10 text-center">
      <Building2 class="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
      <p class="text-slate-500 dark:text-slate-400 text-sm">暂无组织</p>
      <p class="text-xs text-slate-400 mt-1">创建或加入组织后即可在此管理</p>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <router-link
        v-for="org in organizations"
        :key="org.id"
        :to="`/dev/organizations/${org.id}`"
        class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 hover:shadow-md transition-shadow flex flex-col gap-3"
      >
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 bg-slate-100 dark:bg-slate-700">
            <img v-if="org.avatar_url" :src="org.avatar_url" :alt="org.name" class="w-full h-full object-cover" loading="lazy" />
            <div v-else class="w-full h-full flex items-center justify-center text-slate-400 text-sm font-bold">{{ (org.name || '?')[0] }}</div>
          </div>
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
          <span class="text-[10px] px-1.5 py-0.5 rounded font-medium" :class="org.status === 'approved' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : org.status === 'pending' ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400'">
            {{ org.status === 'approved' ? '已通过' : org.status === 'pending' ? '审核中' : org.status === 'rejected' ? '已拒绝' : '已暂停' }}
          </span>
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

const organizations = ref<any[]>([]);
const loading = ref(true);

onMounted(async () => {
  try {
    const res = await adminFetch(API.dev.organizations);
    if (res.ok) {
      organizations.value = await res.json();
    }
  } catch (e) {
    console.error('Fetch dev organizations error:', e);
  } finally {
    loading.value = false;
  }
});
</script>
