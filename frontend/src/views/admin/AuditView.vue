<template>
  <div class="h-full min-h-0">
    <ui-ListDetailLayout
      :selected-id="selectedLogId"
      :selected-item-label="selectedLog?.action"
      :selected-item-icon="ScrollText"
      list-title="审计日志"
      detail-title="审计详情"
      :searchable="false"
      :page="auditPage.page"
      :total="auditPage.total"
      :page-size="auditPage.pageSize"
      @update:page="onAuditPageChange"
      @back="selectedLogId = null"
    >
      <template #list-toolbar>
        <button
          type="button"
          class="w-full px-3 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-bold transition-colors"
          :disabled="loading"
          @click="fetchAuditLogs"
        >
          {{ loading ? '刷新中…' : '刷新列表' }}
        </button>
      </template>

      <template #list>
        <div v-if="loading" class="py-10 text-center text-slate-400 text-sm">加载中…</div>
        <div v-else-if="error" class="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-300 text-sm">
          {{ error }}
        </div>
        <div v-else class="space-y-1.5">
          <div
            v-for="l in auditPage.items"
            :key="l.id"
            class="w-full text-left p-3 rounded-xl border cursor-pointer transition-all duration-200 flex gap-3"
            :class="selectedLogId === l.id
              ? 'bg-[var(--color-brand-50)] dark:bg-[var(--color-brand-500)]/10 border-l-[3px] border-l-[var(--color-brand-500)] border-y border-r border-transparent'
              : 'bg-card/50 border-transparent hover:bg-accent/80'"
            @click="selectLog(l)"
          >
            <div
              class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              :class="present(l).iconClass"
            >
              <component :is="present(l).icon" class="w-4 h-4" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="font-medium text-sm truncate text-foreground">{{ present(l).title }}</div>
              <div class="text-xs text-muted-foreground truncate mt-0.5">
                {{ present(l).actorLabel }} · {{ formatDateTime(l.created_at) }}
              </div>
              <div
                v-if="present(l).changeLines[0]"
                class="text-xs text-slate-400 truncate mt-0.5"
              >
                {{ present(l).changeLines[0] }}
              </div>
            </div>
          </div>
          <ui-EmptyState v-if="auditPage.items.length === 0" :icon="ScrollText" title="暂无日志" />
        </div>
      </template>

      <template #detail>
        <div
          v-if="selectedLog"
          :key="selectedLog.id"
          class="bg-card rounded-2xl border border-border shadow-sm overflow-hidden"
        >
          <div class="p-4 lg:p-6 border-b border-border bg-accent/50 dark:bg-slate-900/50">
            <div class="flex items-start gap-4">
              <div
                class="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                :class="present(selectedLog).iconClass"
              >
                <component :is="present(selectedLog).icon" class="w-6 h-6" />
              </div>
              <div class="flex-1 min-w-0">
                <h2 class="text-lg lg:text-xl font-bold text-foreground leading-snug">
                  {{ present(selectedLog).title }}
                </h2>
                <p class="text-sm text-muted-foreground mt-1">
                  {{ present(selectedLog).subtitle }}
                </p>
                <div class="flex flex-wrap items-center gap-2 mt-3 text-xs text-muted-foreground">
                  <span class="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-secondary/80">
                    <User class="w-3.5 h-3.5" />
                    {{ present(selectedLog).actorLabel }}
                  </span>
                  <span class="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-secondary/80">
                    <Clock class="w-3.5 h-3.5" />
                    {{ formatDateTime(selectedLog.created_at) }}
                  </span>
                  <span class="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-secondary/80">
                    <component :is="entityTypeIcon(selectedLog.entity_type)" class="w-3.5 h-3.5" />
                    {{ present(selectedLog).objectLabel }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div class="p-4 lg:p-6 space-y-5">
            <section v-if="present(selectedLog).changeLines.length">
              <h3 class="text-sm font-extrabold text-foreground mb-2">变更摘要</h3>
              <ul class="space-y-2">
                <li
                  v-for="(line, i) in present(selectedLog).changeLines"
                  :key="i"
                  class="flex items-start gap-2 text-sm text-foreground p-3 rounded-xl bg-card/50 border border-border"
                >
                  <Pencil class="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>{{ line }}</span>
                </li>
              </ul>
            </section>
            <section v-else class="text-sm text-muted-foreground py-2">
              本条记录未包含结构化变更字段，可展开下方技术详情查看原始数据。
            </section>

            <section class="rounded-xl border border-border overflow-hidden">
              <button
                type="button"
                class="w-full flex items-center justify-between gap-2 px-4 py-3 text-sm font-bold text-foreground bg-card/50 hover:bg-accent transition-colors"
                @click="showTechnical = !showTechnical"
              >
                <span class="inline-flex items-center gap-2">
                  <Code2 class="w-4 h-4 text-slate-400" />
                  技术详情
                </span>
                <ChevronDown class="w-4 h-4 transition-transform duration-200" :class="showTechnical ? 'rotate-180' : ''" />
              </button>
              <div v-show="showTechnical" class="p-4 border-t border-border bg-slate-950 text-slate-200 text-xs font-mono overflow-x-auto max-h-80 overflow-y-auto">
                <pre class="whitespace-pre-wrap break-all">{{ formatAuditDiffJson(selectedLog.diff) }}</pre>
                <div class="mt-3 pt-3 border-t border-slate-700 text-slate-400 space-y-1">
                  <div>action: {{ selectedLog.action }}</div>
                  <div>entity_type: {{ selectedLog.entity_type }}</div>
                  <div>entity_id: {{ selectedLog.entity_id || '—' }}</div>
                  <div>id: {{ selectedLog.id }}</div>
                </div>
              </div>
            </section>
          </div>
        </div>

    </template>

    <template #empty-detail>
      <div class="flex items-center justify-center border-2 border-dashed border-border rounded-2xl min-h-[400px]">
        <div class="text-center px-6">
          <ScrollText class="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p class="text-slate-400 mb-2">从左侧选择一条审计记录</p>
          <p class="text-xs text-slate-400">展示操作者、时间、对象与变更摘要</p>
        </div>
      </div>
    </template>
    </ui-ListDetailLayout>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import {
  ScrollText,
  User,
  Clock,
  Pencil,
  Code2,
  ChevronDown,
} from 'lucide-vue-next';
import { adminFetch, formatAdminError, formatDateTime } from '../../composables/useAdminFetch';
import {
  presentAuditLog,
  entityTypeIcon,
  formatAuditDiffJson,
  type AuditLogRow,
} from '../../composables/useAuditLogPresentation';
import { ListDetailLayout as uiListDetailLayout, EmptyState as uiEmptyState } from '../../components/ui';

interface AuditPage {
  items: AuditLogRow[];
  page: number;
  pageSize: number;
  total: number;
}

const auditPage = ref<AuditPage>({ items: [], page: 1, pageSize: 50, total: 0 });
const loading = ref(false);
const error = ref('');
const selectedLogId = ref<string | null>(null);
const showTechnical = ref(false);

const selectedLog = computed(() =>
  auditPage.value.items.find((l) => l.id === selectedLogId.value) ?? null
);

const present = (row: AuditLogRow) => presentAuditLog(row);

const selectLog = (row: AuditLogRow) => {
  selectedLogId.value = row.id;
  showTechnical.value = false;
};

const onAuditPageChange = async (newPage: number) => {
  auditPage.value.page = newPage;
  await fetchAuditLogs();
};

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
    const data = (await res.json()) as AuditPage;
    auditPage.value = data;
    if (selectedLogId.value && !data.items.some((l) => l.id === selectedLogId.value)) {
      selectedLogId.value = data.items[0]?.id ?? null;
    } else if (!selectedLogId.value && data.items[0]) {
      selectedLogId.value = data.items[0].id;
    }
  } catch (e: unknown) {
    error.value = formatAdminError({ message: e instanceof Error ? e.message : '' }, '获取审计日志失败');
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchAuditLogs();
});
</script>
