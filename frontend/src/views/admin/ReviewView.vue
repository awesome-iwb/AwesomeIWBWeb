<template>
  <div class="flex flex-col h-full min-h-0 gap-4">
    <div class="shrink-0 flex flex-wrap gap-2">
      <button
        v-if="hasCapability('submission:read')"
        type="button"
        @click="goTab('projects')"
        class="px-5 py-2.5 rounded-xl text-sm font-bold transition-colors"
        :class="activeTab === 'projects' ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'"
      >
        项目
      </button>
      <button
        v-if="hasCapability('moderation:read')"
        type="button"
        @click="goTab('comments')"
        class="px-5 py-2.5 rounded-xl text-sm font-bold transition-colors"
        :class="activeTab === 'comments' ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'"
      >
        评论
      </button>
      <button
        v-if="hasCapability('moderation:read') || hasCapability('feedback:manage')"
        type="button"
        @click="goTab('bugs')"
        class="px-5 py-2.5 rounded-xl text-sm font-bold transition-colors"
        :class="activeTab === 'bugs' ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'"
      >
        Bug / 反馈
      </button>
    </div>

    <div v-if="activeTab === 'projects'" class="flex-1 min-h-0 overflow-hidden">
      <SubmissionsView />
    </div>

    <div v-else-if="activeTab === 'comments'" class="flex-1 min-h-0 overflow-y-auto">
      <ModerationView locked-kind="comment" />
    </div>

    <div v-else-if="activeTab === 'bugs'" class="flex-1 min-h-0 overflow-y-auto space-y-8">
      <ModerationView v-if="hasCapability('moderation:read')" locked-kind="bug" />
      <div v-if="hasCapability('feedback:manage')" class="max-w-5xl mx-auto">
        <p v-if="hasCapability('moderation:read')" class="text-sm font-bold text-slate-600 dark:text-slate-300 mb-2">
          反馈跟进（全站工单）
        </p>
        <CommentPanel project-name="__admin__" variant="ops" initial-tab="bug" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuth } from '../../composables/useAuth';
import SubmissionsView from './SubmissionsView.vue';
import ModerationView from './ModerationView.vue';
import CommentPanel from '../../components/CommentPanel.vue';

const route = useRoute();
const router = useRouter();
const { hasCapability, capabilities } = useAuth();

type TabId = 'projects' | 'comments' | 'bugs';
const activeTab = ref<TabId>('projects');

function allowedTabs(): TabId[] {
  const keys: TabId[] = [];
  if (hasCapability('submission:read')) keys.push('projects');
  if (hasCapability('moderation:read')) keys.push('comments');
  if (hasCapability('moderation:read') || hasCapability('feedback:manage')) keys.push('bugs');
  return keys;
}

function resolveTab(): TabId {
  const keys = allowedTabs();
  const q = route.query.tab as string | undefined;
  if (q === 'comments' && keys.includes('comments')) return 'comments';
  if (q === 'bugs' && keys.includes('bugs')) return 'bugs';
  if (q === 'projects' && keys.includes('projects')) return 'projects';
  return keys[0] ?? 'projects';
}

watch(
  () => [route.query.tab, [...capabilities.value].sort().join(',')],
  () => {
    activeTab.value = resolveTab();
  },
  { immediate: true }
);

const goTab = (t: TabId) => {
  router.replace({ path: '/admin/review', query: { ...route.query, tab: t } });
};
</script>
