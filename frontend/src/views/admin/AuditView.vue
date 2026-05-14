<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h2 class="text-xl font-extrabold text-slate-900 dark:text-white">审计日志</h2>
      <button @click="fetchAuditLogs" class="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
        刷新
      </button>
    </div>

    <div class="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
      <div v-if="loading" class="p-10 text-center text-slate-400">加载中...</div>
      <div v-else-if="error" class="p-6">
        <div class="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-300 text-sm">{{ error }}</div>
      </div>
      <div v-else>
        <div class="divide-y divide-slate-100 dark:divide-slate-700">
          <div
            v-for="l in auditPage.items"
            :key="l.id"
            class="p-4 lg:p-5 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors"
          >
            <div class="flex items-center justify-between gap-4">
              <div class="font-bold text-sm lg:text-base text-slate-900 dark:text-white">{{ l.action }}</div>
              <div class="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{{ formatDateTime(l.created_at) }}</div>
            </div>
            <div class="text-sm text-slate-700 dark:text-slate-200 mt-1">{{ l.entity_type }} {{ l.entity_id }}</div>
          </div>
          <div v-if="auditPage.items.length === 0" class="p-10 text-center text-slate-400">暂无日志</div>
        </div>

        <div class="p-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-sm">
          <button
            @click="prevPage"
            :disabled="auditPage.page <= 1"
            class="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            上一页
          </button>
          <div class="text-slate-500 dark:text-slate-300">
            {{ auditPage.page }} / {{ totalPages }}
          </div>
          <button
            @click="nextPage"
            :disabled="auditPage.page >= totalPages"
            class="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            下一页
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { adminFetch, formatAdminError, formatDateTime } from '../../composables/useAdminFetch';

interface AuditPage {
  items: any[];
  page: number;
  pageSize: number;
  total: number;
}

const auditPage = ref<AuditPage>({ items: [], page: 1, pageSize: 50, total: 0 });
const loading = ref(false);
const error = ref('');

const totalPages = computed(() => Math.max(1, Math.ceil(auditPage.value.total / auditPage.value.pageSize)));

const fetchAuditLogs = async () => {
  loading.value = true;
  error.value = '';
  try {
    const qs = new URLSearchParams();
    qs.set('page', String(auditPage.value.page));
    qs.set('pageSize', String(auditPage.value.pageSize));
    const res = await adminFetch(`/api/admin/audit-logs?${qs.toString()}`);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(formatAdminError(json, '获取审计日志失败', res.status));
    }
    auditPage.value = await res.json();
  } catch (e: unknown) {
    error.value = formatAdminError({ message: e instanceof Error ? e.message : '' }, '获取审计日志失败');
  } finally {
    loading.value = false;
  }
};

const prevPage = async () => {
  if (auditPage.value.page <= 1) return;
  auditPage.value.page -= 1;
  await fetchAuditLogs();
};

const nextPage = async () => {
  if (auditPage.value.page >= totalPages.value) return;
  auditPage.value.page += 1;
  await fetchAuditLogs();
};

onMounted(() => {
  fetchAuditLogs();
});
</script>
