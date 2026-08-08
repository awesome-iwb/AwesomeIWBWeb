<template>
  <div v-if="visibleItems.length" aria-live="polite">
    <div v-if="firstItem" class="fixed left-3 right-3 z-[60] md:hidden" style="top: calc(env(safe-area-inset-top) + 4.75rem)">
      <article
        class="overflow-hidden rounded-xl border bg-white/95 shadow-xl backdrop-blur dark:bg-slate-950/95"
        :class="levelClasses(firstItem).border"
      >
        <div class="flex items-start gap-3 p-3">
          <component :is="levelIcon(firstItem)" class="mt-0.5 h-5 w-5 shrink-0" :class="levelClasses(firstItem).icon" />
          <div class="min-w-0 flex-1">
            <h2 class="break-words text-sm font-bold text-foreground">{{ firstItem.title }}</h2>
            <p class="mt-1 whitespace-pre-line break-words text-sm leading-5 text-muted-foreground">{{ firstItem.body }}</p>
            <a
              v-if="actionUrl(firstItem)"
              :href="actionUrl(firstItem) || undefined"
              target="_blank"
              rel="noopener noreferrer"
              class="mt-3 inline-flex min-h-[40px] items-center rounded-lg bg-blue-500 px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-600"
            >
              {{ firstItem.data?.action_label || '查看详情' }}
            </a>
          </div>
          <button
            type="button"
            class="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label="关闭通知"
            @click="dismiss(firstItem.id)"
          >
            <X class="h-4 w-4" />
          </button>
        </div>
      </article>
    </div>

    <div class="fixed right-5 top-24 z-[60] hidden w-[min(380px,calc(100vw-2rem))] space-y-3 md:block">
      <transition-group name="notice-stack">
        <article
          v-for="item in visibleItems"
          :key="item.id"
          class="overflow-hidden rounded-xl border bg-white/95 shadow-xl shadow-slate-900/10 backdrop-blur dark:bg-slate-950/95 dark:shadow-black/30"
          :class="levelClasses(item).border"
        >
          <div class="flex items-start gap-3 p-4">
            <component :is="levelIcon(item)" class="mt-0.5 h-5 w-5 shrink-0" :class="levelClasses(item).icon" />
            <div class="min-w-0 flex-1">
              <h2 class="break-words text-sm font-bold text-foreground">{{ item.title }}</h2>
              <p class="mt-1 whitespace-pre-line break-words text-sm leading-5 text-muted-foreground">{{ item.body }}</p>
              <a
                v-if="actionUrl(item)"
                :href="actionUrl(item) || undefined"
                target="_blank"
                rel="noopener noreferrer"
                class="mt-3 inline-flex min-h-[40px] items-center rounded-lg bg-blue-500 px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-600"
              >
                {{ item.data?.action_label || '查看详情' }}
              </a>
            </div>
            <button
              type="button"
              class="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              aria-label="关闭通知"
              @click="dismiss(item.id)"
            >
              <X class="h-4 w-4" />
            </button>
          </div>
        </article>
      </transition-group>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-vue-next';
import { API } from '../api/endpoints';
import { readJsonOrThrow, useApi } from '../composables/useApi';
import { useAuth } from '../composables/useAuth';

type UserNotice = {
  id: string;
  type: string;
  title: string;
  body: string;
  data?: {
    level?: 'info' | 'success' | 'warning' | 'danger';
    action_url?: string;
    action_label?: string;
  };
  is_read: boolean;
  created_at: string;
};

const { apiFetch } = useApi();
const { isAuthenticated } = useAuth();

const notices = ref<UserNotice[]>([]);
const loading = ref(false);
let pollTimer: ReturnType<typeof setInterval> | null = null;

const visibleItems = computed(() => notices.value.filter(item => !item.is_read).slice(0, 3));
const firstItem = computed(() => visibleItems.value[0] ?? null);

async function loadNotices() {
  if (!isAuthenticated.value || loading.value) return;
  loading.value = true;
  try {
    const qs = new URLSearchParams({ unreadOnly: 'true', pageSize: '5' });
    const payload = await readJsonOrThrow<{ items?: UserNotice[] }>(
      await apiFetch(`${API.notifications.list}?${qs.toString()}`),
    );
    notices.value = Array.isArray(payload.items) ? payload.items : [];
  } catch {
    notices.value = [];
  } finally {
    loading.value = false;
  }
}

async function dismiss(id: string) {
  const before = notices.value;
  notices.value = notices.value.filter(item => item.id !== id);
  try {
    await apiFetch(API.notifications.markRead(id), { method: 'PATCH' });
  } catch {
    notices.value = before;
  }
}

function onWindowFocus() {
  void loadNotices();
}

function installPolling() {
  if (pollTimer != null) return;
  pollTimer = window.setInterval(() => void loadNotices(), 60_000);
}

function disposePolling() {
  if (pollTimer == null) return;
  clearInterval(pollTimer);
  pollTimer = null;
}

function levelOf(item: UserNotice) {
  return item.data?.level ?? 'info';
}

function actionUrl(item: UserNotice) {
  const value = item.data?.action_url;
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function levelIcon(item: UserNotice) {
  const level = levelOf(item);
  if (level === 'success') return CheckCircle2;
  if (level === 'warning') return AlertTriangle;
  if (level === 'danger') return XCircle;
  return Info;
}

function levelClasses(item: UserNotice) {
  const level = levelOf(item);
  if (level === 'success') return { border: 'border-emerald-200 dark:border-emerald-500/30', icon: 'text-emerald-500' };
  if (level === 'warning') return { border: 'border-amber-200 dark:border-amber-500/30', icon: 'text-amber-500' };
  if (level === 'danger') return { border: 'border-rose-200 dark:border-rose-500/30', icon: 'text-rose-500' };
  return { border: 'border-blue-200 dark:border-blue-500/30', icon: 'text-blue-500' };
}

watch(
  isAuthenticated,
  (authed) => {
    if (authed) {
      void loadNotices();
      if (typeof window !== 'undefined') installPolling();
    } else {
      notices.value = [];
      disposePolling();
    }
  },
  { immediate: true },
);

onMounted(() => {
  window.addEventListener('focus', onWindowFocus);
  window.addEventListener('auth:updated', onWindowFocus);
  if (isAuthenticated.value) {
    void loadNotices();
    installPolling();
  }
});

onBeforeUnmount(() => {
  disposePolling();
  window.removeEventListener('focus', onWindowFocus);
  window.removeEventListener('auth:updated', onWindowFocus);
});
</script>

<style scoped>
.notice-stack-enter-active,
.notice-stack-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.notice-stack-enter-from,
.notice-stack-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
