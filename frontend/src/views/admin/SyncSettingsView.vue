<template>
  <div class="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
    <div>
      <h1 class="text-xl font-bold">GitHub 数据同步</h1>
      <p class="text-sm text-muted-foreground mt-1">
        定时从 GitHub 拉取项目 Stars、版本、最近更新与 Release 信息。
      </p>
    </div>

    <div
      v-if="status && !status.github_token_configured"
      class="rounded-xl border border-amber-300/70 bg-amber-50 dark:bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200"
    >
      未检测到 <code class="font-mono text-xs">GITHUB_TOKEN</code>，同步可能受 API 速率限制。请在服务端
      <code class="font-mono text-xs">backend.env</code> 中配置 Token 后重启后端。
    </div>

    <div v-if="loading && !status" class="text-muted-foreground text-sm">加载中…</div>

    <template v-else-if="status">
      <div class="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-4">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div class="text-xs text-muted-foreground">上次同步</div>
            <div class="font-bold text-lg mt-0.5">{{ lastRunRelative }}</div>
            <div class="text-xs text-muted-foreground mt-1">{{ lastRunAbsolute }}</div>
          </div>
          <span
            v-if="status.last_run_status"
            class="text-xs font-bold px-2.5 py-1 rounded-full"
            :class="statusBadgeClass"
          >
            {{ statusLabel }}
          </span>
        </div>

        <div v-if="status.last_run_summary" class="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div class="rounded-xl bg-secondary/60 p-3">
            <div class="text-[10px] text-muted-foreground">总计</div>
            <div class="text-lg font-bold">{{ status.last_run_summary.total }}</div>
          </div>
          <div class="rounded-xl bg-emerald-500/10 p-3">
            <div class="text-[10px] text-emerald-700 dark:text-emerald-300">已更新</div>
            <div class="text-lg font-bold text-emerald-700 dark:text-emerald-300">{{ status.last_run_summary.updated }}</div>
          </div>
          <div class="rounded-xl bg-rose-500/10 p-3">
            <div class="text-[10px] text-rose-700 dark:text-rose-300">失败</div>
            <div class="text-lg font-bold text-rose-700 dark:text-rose-300">{{ status.last_run_summary.failed }}</div>
          </div>
          <div class="rounded-xl bg-secondary/60 p-3">
            <div class="text-[10px] text-muted-foreground">跳过</div>
            <div class="text-lg font-bold">{{ status.last_run_summary.skipped }}</div>
          </div>
        </div>

        <div v-if="status.last_run_summary?.error_snippet" class="text-xs text-rose-600 dark:text-rose-400 font-mono break-all">
          {{ status.last_run_summary.error_snippet }}
        </div>

        <div class="text-sm text-muted-foreground">
          预计下次同步：<span class="font-medium text-foreground">{{ nextRunText }}</span>
        </div>
      </div>

      <div class="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-4">
        <h2 class="font-bold text-sm">同步设置</h2>

        <div class="flex items-center justify-between gap-4">
          <div>
            <div class="font-medium text-sm">启用定时同步</div>
            <div class="text-xs text-muted-foreground mt-0.5">关闭后仅可手动触发</div>
          </div>
          <button
            type="button"
            role="switch"
            :aria-checked="draftEnabled"
            class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            :class="draftEnabled ? 'bg-emerald-500' : 'bg-input'"
            :disabled="saving"
            @click="toggleEnabled"
          >
            <span
              class="pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg transition-transform"
              :class="draftEnabled ? 'translate-x-5' : 'translate-x-0'"
            />
          </button>
        </div>

        <div>
          <label class="text-sm font-medium">同步频率</label>
          <select
            v-model.number="draftInterval"
            class="w-full mt-2 px-3 py-2 rounded-xl border border-border bg-card text-sm"
            :disabled="saving"
            @change="saveSettings"
          >
            <option v-for="opt in intervalOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
        </div>

        <div class="flex flex-wrap gap-2 pt-1">
          <Button :disabled="syncing || status.running" @click="triggerSync">
            <RefreshCw class="w-4 h-4 mr-2" :class="{ 'animate-spin': syncing || status.running }" />
            {{ syncing || status.running ? '同步中…' : '立即同步' }}
          </Button>
        </div>

        <p v-if="message" class="text-sm" :class="messageError ? 'text-rose-600' : 'text-emerald-600'">{{ message }}</p>
      </div>
    </template>

    <div v-else-if="error" class="text-sm text-rose-600">{{ error }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { RefreshCw } from 'lucide-vue-next';
import { adminFetch, formatAdminError, formatDateTime } from '../../composables/useAdminFetch';
import { API } from '../../api/endpoints';
import { Button } from '../../components/ui/button';

type SyncRunSummary = {
  total: number;
  updated: number;
  failed: number;
  skipped: number;
  error_snippet?: string;
};

type SyncStatus = {
  enabled: boolean;
  interval_hours: number;
  interval_options: number[];
  last_run_at: string | null;
  last_run_status: 'success' | 'partial' | 'failed' | null;
  last_run_summary: SyncRunSummary | null;
  next_run_at: string | null;
  github_token_configured: boolean;
  running: boolean;
};

const INTERVAL_LABELS: Record<number, string> = {
  6: '每 6 小时',
  12: '每 12 小时',
  24: '每天',
  48: '每 2 天',
  168: '每周',
};

const loading = ref(true);
const saving = ref(false);
const syncing = ref(false);
const error = ref('');
const message = ref('');
const messageError = ref(false);
const status = ref<SyncStatus | null>(null);
const draftEnabled = ref(true);
const draftInterval = ref(24);
let pollTimer: ReturnType<typeof setInterval> | null = null;

const intervalOptions = computed(() =>
  (status.value?.interval_options ?? [6, 12, 24, 48, 168]).map((value) => ({
    value,
    label: INTERVAL_LABELS[value] ?? `每 ${value} 小时`,
  }))
);

const lastRunRelative = computed(() => {
  if (!status.value?.last_run_at) return '尚未同步';
  return formatRelative(status.value.last_run_at);
});

const lastRunAbsolute = computed(() => {
  if (!status.value?.last_run_at) return '';
  return formatDateTime(status.value.last_run_at);
});

const nextRunText = computed(() => {
  if (!status.value?.enabled) return '已禁用';
  if (!status.value.next_run_at) return status.value.last_run_at ? '即将执行' : '等待首次同步';
  return `${formatRelative(status.value.next_run_at)}（${formatDateTime(status.value.next_run_at)}）`;
});

const statusLabel = computed(() => {
  const s = status.value?.last_run_status;
  if (s === 'success') return '成功';
  if (s === 'partial') return '部分成功';
  if (s === 'failed') return '失败';
  return '';
});

const statusBadgeClass = computed(() => {
  const s = status.value?.last_run_status;
  if (s === 'success') return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';
  if (s === 'partial') return 'bg-amber-500/15 text-amber-700 dark:text-amber-300';
  return 'bg-rose-500/15 text-rose-700 dark:text-rose-300';
});

function formatRelative(value: string) {
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  const diffMs = dt.getTime() - Date.now();
  const absSec = Math.abs(Math.round(diffMs / 1000));
  const rtf = new Intl.RelativeTimeFormat('zh-CN', { numeric: 'auto' });
  if (absSec < 60) return rtf.format(Math.round(diffMs / 1000), 'second');
  const absMin = Math.abs(Math.round(diffMs / 60000));
  if (absMin < 60) return rtf.format(Math.round(diffMs / 60000), 'minute');
  const absHour = Math.abs(Math.round(diffMs / 3600000));
  if (absHour < 48) return rtf.format(Math.round(diffMs / 3600000), 'hour');
  return rtf.format(Math.round(diffMs / 86400000), 'day');
}

async function fetchStatus() {
  try {
    const res = await adminFetch(API.admin.syncGithub);
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      error.value = formatAdminError(payload, '加载同步状态失败', res.status);
      return;
    }
    status.value = payload as SyncStatus;
    draftEnabled.value = payload.enabled;
    draftInterval.value = payload.interval_hours;
    error.value = '';
  } finally {
    loading.value = false;
  }
}

async function saveSettings() {
  if (!status.value) return;
  saving.value = true;
  message.value = '';
  messageError.value = false;
  try {
    const res = await adminFetch(API.admin.syncGithub, {
      method: 'PATCH',
      body: JSON.stringify({
        enabled: draftEnabled.value,
        interval_hours: draftInterval.value,
      }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      message.value = formatAdminError(payload, '保存设置失败', res.status);
      messageError.value = true;
      return;
    }
    status.value = payload as SyncStatus;
    draftEnabled.value = payload.enabled;
    draftInterval.value = payload.interval_hours;
    message.value = '设置已保存';
  } finally {
    saving.value = false;
  }
}

async function toggleEnabled() {
  draftEnabled.value = !draftEnabled.value;
  await saveSettings();
}

async function triggerSync() {
  syncing.value = true;
  message.value = '';
  messageError.value = false;
  try {
    const res = await adminFetch(API.admin.syncGithub, { method: 'POST' });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      message.value = formatAdminError(payload, '同步失败', res.status);
      messageError.value = true;
      return;
    }
    message.value = `同步完成：更新 ${payload.updated ?? 0}，失败 ${payload.failed ?? 0}`;
    await fetchStatus();
  } finally {
    syncing.value = false;
  }
}

function setupPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(() => {
    if (status.value?.running || syncing.value) {
      void fetchStatus();
    }
  }, 5000);
}

watch(
  () => status.value?.running,
  (running) => {
    if (running) setupPolling();
  }
);

onMounted(async () => {
  await fetchStatus();
  setupPolling();
});

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer);
});
</script>
