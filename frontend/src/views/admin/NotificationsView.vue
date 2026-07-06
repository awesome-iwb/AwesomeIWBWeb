<template>
  <div class="h-full min-h-0 overflow-y-auto p-4 lg:p-6">
    <div class="mx-auto grid h-full min-h-[720px] max-w-7xl grid-cols-1 gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
      <section class="min-h-0 rounded-2xl border border-border bg-white/78 shadow-sm backdrop-blur dark:bg-slate-900/70">
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
          <div>
            <h1 class="text-lg font-bold text-foreground">通知管理</h1>
            <p class="text-xs text-muted-foreground">共 {{ total }} 条</p>
          </div>
          <button
            type="button"
            class="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition-colors hover:bg-emerald-600"
            @click="createDraft"
          >
            <Plus class="h-4 w-4" />
            新建
          </button>
        </div>

        <div class="flex gap-2 border-b border-border p-3">
          <button
            v-for="item in statusTabs"
            :key="item.value"
            type="button"
            class="min-h-[40px] flex-1 rounded-xl px-3 py-2 text-sm font-bold transition-colors"
            :class="statusFilter === item.value ? 'bg-emerald-500 text-white' : 'bg-secondary text-muted-foreground hover:bg-accent'"
            @click="statusFilter = item.value"
          >
            {{ item.label }}
          </button>
        </div>

        <div class="max-h-[calc(100vh-250px)] min-h-[360px] overflow-y-auto p-3">
          <div v-if="isLoading" class="py-10 text-center text-sm text-muted-foreground">加载中...</div>
          <div v-else-if="!campaigns.length" class="py-10 text-center text-sm text-muted-foreground">暂无通知</div>
          <button
            v-for="item in campaigns"
            :key="item.id"
            type="button"
            class="mb-2 w-full rounded-xl border p-3 text-left transition-colors"
            :class="selected?.id === item.id ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' : 'border-border bg-card hover:bg-accent'"
            @click="selectCampaign(item)"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="truncate text-sm font-bold text-foreground">{{ item.title }}</div>
                <div class="mt-1 line-clamp-2 text-xs text-muted-foreground">{{ item.body }}</div>
              </div>
              <span
                class="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold"
                :class="item.status === 'sent' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'"
              >
                {{ item.status === 'sent' ? '已发送' : '草稿' }}
              </span>
            </div>
            <div class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              <span>{{ audienceLabel(item) }}</span>
              <span>{{ formatDateTime(item.sent_at || item.updated_at) }}</span>
            </div>
          </button>
        </div>
      </section>

      <section class="min-h-0 rounded-2xl border border-border bg-white/78 shadow-sm backdrop-blur dark:bg-slate-900/70">
        <div v-if="!draft" class="flex h-full min-h-[420px] items-center justify-center p-8 text-center text-sm text-muted-foreground">
          选择一条通知，或新建草稿
        </div>

        <form v-else class="flex h-full min-h-0 flex-col" @submit.prevent="saveDraft">
          <div class="flex flex-wrap items-start justify-between gap-3 border-b border-border p-4 lg:p-5">
            <div class="min-w-0">
              <h2 class="text-lg font-bold text-foreground">{{ draft.id ? '编辑通知' : '新建通知' }}</h2>
              <p v-if="selected?.status === 'sent'" class="text-xs text-muted-foreground">
                由 {{ selected.sent_by || '-' }} 发送，投递 {{ selected.sent_count }} 人
              </p>
            </div>
            <div class="flex flex-wrap gap-2">
              <button
                type="submit"
                class="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
                :disabled="isReadonly || isSaving"
              >
                <Save class="h-4 w-4" />
                {{ isSaving ? '保存中...' : '保存' }}
              </button>
              <button
                type="button"
                class="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-blue-500 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-600 disabled:opacity-50"
                :disabled="isReadonly || !draft.id || isSending"
                @click="sendDraft"
              >
                <Send class="h-4 w-4" />
                {{ isSending ? '发送中...' : '发送' }}
              </button>
            </div>
          </div>

          <div class="flex-1 space-y-5 overflow-y-auto p-4 lg:p-6">
            <div v-if="error" class="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
              {{ error }}
            </div>

            <fieldset :disabled="isReadonly" class="space-y-5 disabled:opacity-75">
              <div class="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <label class="block">
                  <span class="mb-2 block text-sm font-bold text-muted-foreground">标题</span>
                  <input
                    v-model="draft.title"
                    maxlength="80"
                    class="w-full rounded-xl border border-border bg-card px-4 py-3 text-base outline-none transition-colors focus:border-emerald-500"
                    placeholder="例如：站点维护提醒"
                  />
                </label>

                <label class="block">
                  <span class="mb-2 block text-sm font-bold text-muted-foreground">级别</span>
                  <select
                    v-model="draft.level"
                    class="w-full rounded-xl border border-border bg-card px-4 py-3 text-base outline-none transition-colors focus:border-emerald-500"
                  >
                    <option value="info">信息</option>
                    <option value="success">成功</option>
                    <option value="warning">提醒</option>
                    <option value="danger">重要</option>
                  </select>
                </label>
              </div>

              <label class="block">
                <span class="mb-2 block text-sm font-bold text-muted-foreground">正文</span>
                <textarea
                  v-model="draft.body"
                  maxlength="800"
                  rows="7"
                  class="w-full resize-none rounded-xl border border-border bg-card px-4 py-3 text-base outline-none transition-colors focus:border-emerald-500"
                  placeholder="写下要展示给用户的通知内容"
                />
                <span class="mt-1 block text-right text-xs text-muted-foreground">{{ draft.body.length }}/800</span>
              </label>

              <div class="rounded-2xl border border-border bg-card/80 p-4">
                <div class="mb-3 text-sm font-bold text-muted-foreground">接收范围</div>
                <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label class="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl border border-border px-4 py-3">
                    <input v-model="draft.audience_kind" type="radio" value="all" class="h-4 w-4" />
                    <span class="text-sm font-bold">全站广播</span>
                  </label>
                  <label class="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl border border-border px-4 py-3">
                    <input v-model="draft.audience_kind" type="radio" value="users" class="h-4 w-4" />
                    <span class="text-sm font-bold">指定用户</span>
                  </label>
                </div>

                <label v-if="draft.audience_kind === 'users'" class="mt-4 block">
                  <span class="mb-2 block text-sm font-bold text-muted-foreground">用户名</span>
                  <textarea
                    v-model="targetUsersText"
                    rows="5"
                    class="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-base outline-none transition-colors focus:border-emerald-500"
                    placeholder="每行一个用户名，也可以用逗号分隔"
                  />
                  <span class="mt-1 block text-xs text-muted-foreground">预计投递 {{ targetUserNames.length }} 个用户</span>
                </label>
                <p v-else class="mt-4 text-sm text-muted-foreground">发送给所有启用账户。</p>
              </div>
            </fieldset>

            <div v-if="selected?.status === 'sent'" class="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
              <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>发送人：{{ selected.sent_by || '-' }}</div>
                <div>发送时间：{{ formatDateTime(selected.sent_at) }}</div>
                <div>投递数量：{{ selected.sent_count }}</div>
                <div>接收范围：{{ audienceLabel(selected) }}</div>
              </div>
            </div>
          </div>
        </form>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { Plus, Save, Send } from 'lucide-vue-next';
import { API } from '../../api/endpoints';
import { adminFetch, formatAdminError, formatDateTime } from '../../composables/useAdminFetch';

type CampaignStatus = 'draft' | 'sent';
type CampaignLevel = 'info' | 'success' | 'warning' | 'danger';
type AudienceKind = 'all' | 'users';

type NotificationCampaign = {
  id: string;
  title: string;
  body: string;
  level: CampaignLevel;
  audience_kind: AudienceKind;
  target_user_names: string[];
  status: CampaignStatus;
  sent_count: number;
  created_by: string;
  updated_by: string;
  sent_by: string;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
};

type Draft = {
  id?: string;
  title: string;
  body: string;
  level: CampaignLevel;
  audience_kind: AudienceKind;
};

const statusTabs: Array<{ label: string; value: CampaignStatus | '' }> = [
  { label: '全部', value: '' },
  { label: '草稿', value: 'draft' },
  { label: '已发送', value: 'sent' },
];

const campaigns = ref<NotificationCampaign[]>([]);
const selected = ref<NotificationCampaign | null>(null);
const draft = ref<Draft | null>(null);
const targetUsersText = ref('');
const statusFilter = ref<CampaignStatus | ''>('');
const total = ref(0);
const isLoading = ref(false);
const isSaving = ref(false);
const isSending = ref(false);
const error = ref('');

const isReadonly = computed(() => selected.value?.status === 'sent');

const targetUserNames = computed(() => {
  const seen = new Set<string>();
  return targetUsersText.value
    .split(/[\n,，]/)
    .map(v => v.trim())
    .filter(Boolean)
    .filter(name => {
      const key = name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
});

const audienceLabel = (item: Pick<NotificationCampaign, 'audience_kind' | 'target_user_names'>) => {
  if (item.audience_kind === 'all') return '全站广播';
  return `指定用户 ${item.target_user_names.length} 人`;
};

function campaignToDraft(item: NotificationCampaign): Draft {
  return {
    id: item.id,
    title: item.title,
    body: item.body,
    level: item.level,
    audience_kind: item.audience_kind,
  };
}

function createDraft() {
  selected.value = null;
  draft.value = { title: '', body: '', level: 'info', audience_kind: 'all' };
  targetUsersText.value = '';
  error.value = '';
}

function selectCampaign(item: NotificationCampaign) {
  selected.value = item;
  draft.value = campaignToDraft(item);
  targetUsersText.value = item.target_user_names.join('\n');
  error.value = '';
}

async function loadCampaigns() {
  isLoading.value = true;
  error.value = '';
  try {
    const qs = new URLSearchParams({ pageSize: '50' });
    if (statusFilter.value) qs.set('status', statusFilter.value);
    const res = await adminFetch(`${API.admin.notifications}?${qs.toString()}`);
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(formatAdminError(payload, '加载通知失败', res.status));
    campaigns.value = Array.isArray(payload.items) ? payload.items : [];
    total.value = Number(payload.total ?? campaigns.value.length);
    if (selected.value) {
      const fresh = campaigns.value.find(item => item.id === selected.value?.id);
      if (fresh) selectCampaign(fresh);
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载通知失败';
  } finally {
    isLoading.value = false;
  }
}

function buildPayload() {
  if (!draft.value) return null;
  return {
    title: draft.value.title,
    body: draft.value.body,
    level: draft.value.level,
    audience: {
      kind: draft.value.audience_kind,
      userNames: draft.value.audience_kind === 'users' ? targetUserNames.value : [],
    },
  };
}

async function saveDraft() {
  if (!draft.value || isReadonly.value) return;
  isSaving.value = true;
  error.value = '';
  try {
    const payload = buildPayload();
    const url = draft.value.id ? API.admin.notificationDetail(draft.value.id) : API.admin.notifications;
    const method = draft.value.id ? 'PATCH' : 'POST';
    const res = await adminFetch(url, { method, body: JSON.stringify(payload) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(formatAdminError(json, '保存通知失败', res.status));
    selected.value = json;
    draft.value = campaignToDraft(json);
    targetUsersText.value = json.target_user_names?.join('\n') ?? '';
    await loadCampaigns();
  } catch (e) {
    error.value = e instanceof Error ? e.message : '保存通知失败';
  } finally {
    isSaving.value = false;
  }
}

async function sendDraft() {
  if (!draft.value?.id || isReadonly.value) return;
  const target = draft.value.audience_kind === 'all' ? '所有启用用户' : `${targetUserNames.value.length} 个指定用户`;
  if (!window.confirm(`确认发送给${target}？发送后不能编辑或重复发送。`)) return;
  isSending.value = true;
  error.value = '';
  try {
    const res = await adminFetch(API.admin.notificationSend(draft.value.id), { method: 'POST' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(formatAdminError(json, '发送通知失败', res.status));
    if (json.campaign) selectCampaign(json.campaign);
    await loadCampaigns();
  } catch (e) {
    error.value = e instanceof Error ? e.message : '发送通知失败';
  } finally {
    isSending.value = false;
  }
}

watch(statusFilter, () => {
  void loadCampaigns();
});

onMounted(() => {
  void loadCampaigns();
});
</script>
