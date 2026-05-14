<template>
  <div class="space-y-6">
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <DashboardCard v-if="hasCapability('project:read')" label="项目总数" :main-value="data.projects?.total ?? '—'" :sub-value="data.projects ? `本周新增 ${data.projects.newThisWeek}` : ''" :icon="Package" color="blue" />
      <DashboardCard v-if="hasCapability('submission:read')" label="待审核提交" :main-value="data.pendingSubmissions ?? '—'" :icon="ClipboardCheck" color="amber" />
      <DashboardCard v-if="hasCapability('moderation:read')" label="待审核内容" :main-value="moderationTotal" :sub-value="data.pendingModeration ? `评论 ${data.pendingModeration.comments} / Bug ${data.pendingModeration.bugs}` : ''" :icon="Shield" color="rose" />
      <DashboardCard v-if="hasCapability('feedback:manage')" label="待处理反馈" :main-value="data.openFeedback ?? '—'" :icon="MessageSquare" color="purple" />
      <DashboardCard v-if="hasCapability('user:read')" label="用户总数" :main-value="data.users?.total ?? '—'" :sub-value="data.users ? `本周注册 ${data.users.newThisWeek}` : ''" :icon="Users" color="teal" />
      <DashboardCard v-if="hasCapability('media:read')" label="媒体资产" :main-value="data.media?.total ?? '—'" :sub-value="data.media ? formatBytes(data.media.totalSize) : ''" :icon="ImageIcon" color="emerald" />
      <DashboardCard v-if="hasCapability('story:manage')" label="文章数" :main-value="data.stories ?? '—'" :icon="FileText" color="blue" />
    </div>

    <div v-if="hasCapability('audit:read') && data.recentActivity?.length" class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm">
      <h3 class="font-bold text-base mb-4">最近活动</h3>
      <div class="space-y-3">
        <div v-for="(item, i) in data.recentActivity" :key="i" class="flex items-start gap-3 text-sm">
          <span class="text-slate-400 whitespace-nowrap">{{ formatTime(item.created_at) }}</span>
          <span class="text-slate-700 dark:text-slate-300">{{ item.actor }}</span>
          <span class="text-slate-500 dark:text-slate-400">{{ item.action }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useAuth } from '../../composables/useAuth';
import { adminFetch, formatBytes } from '../../composables/useAdminFetch';
import DashboardCard from '../../components/admin/DashboardCard.vue';
import { Package, ClipboardCheck, Shield, MessageSquare, Users, Image as ImageIcon, FileText } from 'lucide-vue-next';

const { hasCapability } = useAuth();

const data = ref<Record<string, any>>({});

const moderationTotal = computed(() => {
  const m = data.value.pendingModeration;
  if (!m) return '—';
  return (m.comments + m.bugs);
});

const formatTime = (v: string) => {
  try {
    const d = new Date(v);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return '刚刚';
    if (diffMin < 60) return `${diffMin}分钟前`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}小时前`;
    return d.toLocaleDateString('zh-CN');
  } catch {
    return v;
  }
};

onMounted(async () => {
  try {
    const res = await adminFetch('/api/admin/dashboard');
    if (res.ok) {
      data.value = await res.json();
    }
  } catch {}
});
</script>
