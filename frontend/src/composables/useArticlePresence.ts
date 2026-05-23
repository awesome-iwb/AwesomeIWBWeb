import { ref, onMounted, onUnmounted, type Ref } from 'vue';
import { adminFetch } from './useAdminFetch';
import { API } from '../api/endpoints';

interface ActiveEditor {
  user_id: string;
  user_name: string;
  user_avatar_url: string;
  last_heartbeat: string;
}

export function useArticlePresence(articleId: Ref<string>, currentUserId?: Ref<string | undefined>) {
  const activeEditors = ref<ActiveEditor[]>([]);
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  async function sendHeartbeat() {
    if (!articleId.value) return;
    try {
      await adminFetch(API.admin.articlePresenceHeartbeat(articleId.value), { method: 'POST' });
    } catch {}
  }

  async function fetchEditors() {
    if (!articleId.value) return;
    try {
      const res = await adminFetch(API.admin.articlePresence(articleId.value));
      if (res.ok) {
        const data = await res.json();
        let editors: ActiveEditor[] = data.editors ?? [];
        if (currentUserId?.value) {
          editors = editors.filter((e) => e.user_id !== currentUserId.value);
        }
        activeEditors.value = editors;
      }
    } catch {}
  }

  async function leave() {
    if (!articleId.value) return;
    try {
      await adminFetch(API.admin.articlePresence(articleId.value), { method: 'DELETE' });
    } catch {}
  }

  function startPresence() {
    void sendHeartbeat();
    void fetchEditors();
    heartbeatTimer = setInterval(sendHeartbeat, 15000);
    pollTimer = setInterval(fetchEditors, 10000);
  }

  function stopPresence() {
    if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    void leave();
  }

  onMounted(() => {
    if (articleId.value) startPresence();
  });

  onUnmounted(() => {
    stopPresence();
  });

  return { activeEditors, startPresence, stopPresence };
}
