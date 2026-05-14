<template>
  <div class="space-y-6">
    <div v-if="loading" class="flex items-center justify-center py-20">
      <div class="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
    </div>

    <template v-else>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <DashboardCard v-if="hasCapability('project:read')" label="项目总数" :main-value="data.projects?.total ?? '—'" :sub-value="data.projects ? `本周新增 ${data.projects.newThisWeek}` : ''" :icon="Package" color="blue" />
        <DashboardCard v-if="hasCapability('submission:read')" label="待审核提交" :main-value="data.pendingSubmissions?.count ?? '—'" :icon="ClipboardCheck" color="amber" />
        <DashboardCard v-if="hasCapability('moderation:read')" label="待审核内容" :main-value="moderationTotal" :sub-value="data.pendingModeration ? `评论 ${data.pendingModeration.comments} / Bug ${data.pendingModeration.bugs}` : ''" :icon="Shield" color="rose" />
        <DashboardCard v-if="hasCapability('feedback:manage')" label="待处理反馈" :main-value="data.openFeedback?.count ?? '—'" :icon="MessageSquare" color="purple" />
        <DashboardCard v-if="hasCapability('user:read')" label="用户总数" :main-value="data.users?.total ?? '—'" :sub-value="data.users ? `本周注册 ${data.users.newThisWeek}` : ''" :icon="Users" color="teal" />
        <DashboardCard v-if="hasCapability('media:read')" label="媒体资产" :main-value="data.media?.total ?? '—'" :sub-value="data.media ? formatBytes(data.media.totalSize) : ''" :icon="ImageIcon" color="emerald" />
        <DashboardCard v-if="hasCapability('story:manage')" label="文章数" :main-value="data.stories?.total ?? '—'" :icon="FileText" color="blue" />
      </div>

      <div v-if="hasCapability('story:manage') && data.stories?.recent?.length" class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div class="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <h3 class="font-bold text-base flex items-center gap-2"><FileText class="w-4 h-4 text-blue-500" />最近文章</h3>
          <router-link to="/admin/stories" class="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-medium">查看全部 →</router-link>
        </div>
        <div class="divide-y divide-slate-100 dark:divide-slate-700">
          <router-link v-for="story in data.stories.recent" :key="story.id" to="/admin/stories" class="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
            <div v-if="story.cover" class="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-slate-100 dark:bg-slate-700">
              <img :src="story.cover" :alt="story.title" class="w-full h-full object-cover" loading="lazy" />
            </div>
            <div v-else class="w-14 h-14 rounded-xl flex-shrink-0 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/40 dark:to-indigo-900/40 flex items-center justify-center">
              <FileText class="w-6 h-6 text-blue-400" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="font-semibold text-sm truncate text-slate-900 dark:text-white">{{ story.title }}</div>
              <div class="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                <span v-if="story.author">{{ story.author }}</span>
                <span v-if="story.created_at">{{ formatDate(story.created_at) }}</span>
              </div>
            </div>
          </router-link>
        </div>
      </div>

      <div v-if="hasCapability('project:read') && data.projects?.recent?.length" class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div class="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <h3 class="font-bold text-base flex items-center gap-2"><Package class="w-4 h-4 text-blue-500" />最近项目</h3>
          <router-link to="/admin/projects" class="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-medium">查看全部 →</router-link>
        </div>
        <div class="divide-y divide-slate-100 dark:divide-slate-700">
          <router-link v-for="proj in data.projects.recent" :key="proj.slug" to="/admin/projects" class="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
            <div class="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 bg-slate-100 dark:bg-slate-700">
              <img v-if="proj.icon" :src="proj.icon" :alt="proj.name" class="w-full h-full object-cover" loading="lazy" />
              <div v-else class="w-full h-full flex items-center justify-center text-slate-400"><Package class="w-5 h-5" /></div>
            </div>
            <div class="flex-1 min-w-0">
              <div class="font-semibold text-sm truncate text-slate-900 dark:text-white">{{ proj.name }}</div>
              <div class="text-xs text-slate-400 mt-0.5 truncate">{{ proj.description || proj.developer }}</div>
            </div>
            <div class="flex items-center gap-3 flex-shrink-0">
              <span v-if="proj.stars" class="text-xs text-amber-500 font-medium flex items-center gap-0.5">⭐ {{ proj.stars }}</span>
              <span v-if="proj.language" class="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 font-mono">{{ proj.language }}</span>
            </div>
          </router-link>
        </div>
      </div>

      <div v-if="hasCapability('submission:read') && data.pendingSubmissions?.recent?.length" class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div class="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <h3 class="font-bold text-base flex items-center gap-2"><ClipboardCheck class="w-4 h-4 text-amber-500" />最近提交</h3>
          <router-link to="/admin/submissions" class="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-medium">查看全部 →</router-link>
        </div>
        <div class="divide-y divide-slate-100 dark:divide-slate-700">
          <router-link v-for="sub in data.pendingSubmissions.recent" :key="sub.id" to="/admin/submissions" class="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
            <div class="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center" :class="sub.status === 'pending' ? 'bg-amber-100 dark:bg-amber-500/20' : sub.status === 'approved' ? 'bg-emerald-100 dark:bg-emerald-500/20' : 'bg-rose-100 dark:bg-rose-500/20'">
              <ClipboardCheck class="w-5 h-5" :class="sub.status === 'pending' ? 'text-amber-500' : sub.status === 'approved' ? 'text-emerald-500' : 'text-rose-500'" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="font-semibold text-sm truncate text-slate-900 dark:text-white">{{ sub.payload?.name || '未命名提交' }}</div>
              <div class="text-xs text-slate-400 mt-0.5">{{ sub.payload?.developer || '' }} · {{ formatTime(sub.created_at) }}</div>
            </div>
            <span class="text-[10px] px-2 py-0.5 rounded-full font-medium" :class="sub.status === 'pending' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' : sub.status === 'approved' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400'">{{ sub.status === 'pending' ? '待审核' : sub.status === 'approved' ? '已通过' : '已拒绝' }}</span>
          </router-link>
        </div>
      </div>

      <div v-if="hasCapability('media:read') && data.media?.recent?.length" class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div class="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <h3 class="font-bold text-base flex items-center gap-2"><ImageIcon class="w-4 h-4 text-emerald-500" />最近上传</h3>
          <router-link to="/admin/media" class="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-medium">查看全部 →</router-link>
        </div>
        <div class="p-4 grid grid-cols-3 sm:grid-cols-6 gap-3">
          <div v-for="img in data.media.recent" :key="img.id" class="aspect-square rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-700 group cursor-pointer relative">
            <img :src="img.url" alt="" class="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
            <div class="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-end">
              <div class="w-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <div class="text-[10px] text-white font-medium truncate">{{ formatBytes(img.size) }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="hasCapability('user:read') && data.users?.recent?.length" class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div class="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <h3 class="font-bold text-base flex items-center gap-2"><Users class="w-4 h-4 text-teal-500" />最近注册用户</h3>
          <router-link to="/admin/users" class="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-medium">查看全部 →</router-link>
        </div>
        <div class="divide-y divide-slate-100 dark:divide-slate-700">
          <router-link v-for="u in data.users.recent" :key="u.id" to="/admin/users" class="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
            <div class="w-8 h-8 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-700 flex-shrink-0">
              <img v-if="u.avatar_url" :src="u.avatar_url" :alt="u.name" class="w-full h-full object-cover" loading="lazy" />
              <div v-else class="w-full h-full flex items-center justify-center text-xs font-bold text-slate-400">{{ (u.name || '?')[0].toUpperCase() }}</div>
            </div>
            <div class="flex-1 min-w-0">
              <span class="font-medium text-sm text-slate-900 dark:text-white">{{ u.name }}</span>
            </div>
            <span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 font-medium">{{ u.role }}</span>
            <span class="text-xs text-slate-400">{{ formatTime(u.created_at) }}</span>
          </router-link>
        </div>
      </div>

      <div v-if="hasCapability('feedback:manage') && data.openFeedback?.recent?.length" class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div class="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <h3 class="font-bold text-base flex items-center gap-2"><MessageSquare class="w-4 h-4 text-purple-500" />最近反馈</h3>
          <router-link to="/admin/feedback" class="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-medium">查看全部 →</router-link>
        </div>
        <div class="divide-y divide-slate-100 dark:divide-slate-700">
          <router-link v-for="fb in data.openFeedback.recent" :key="fb.id" to="/admin/feedback" class="flex items-start gap-3 px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
            <div class="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center mt-0.5" :class="fb.kind === 'bug' ? 'bg-rose-100 dark:bg-rose-500/20' : 'bg-blue-100 dark:bg-blue-500/20'">
              <Bug v-if="fb.kind === 'bug'" class="w-4 h-4 text-rose-500" />
              <MessageSquare v-else class="w-4 h-4 text-blue-500" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="font-semibold text-sm text-slate-900 dark:text-white truncate">{{ fb.title || fb.body?.slice(0, 50) || '无标题' }}</div>
              <div class="text-xs text-slate-400 mt-0.5">{{ fb.project_name }} · {{ fb.actor_username }} · {{ formatTime(fb.created_at) }}</div>
            </div>
          </router-link>
        </div>
      </div>

      <div v-if="hasCapability('audit:read') && data.recentActivity?.length" class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div class="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <h3 class="font-bold text-base flex items-center gap-2"><ScrollText class="w-4 h-4 text-slate-400" />审计日志</h3>
          <router-link to="/admin/audit" class="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-medium">查看全部 →</router-link>
        </div>
        <div class="divide-y divide-slate-100 dark:divide-slate-700">
          <div v-for="(item, i) in data.recentActivity" :key="i" class="flex items-center gap-3 px-5 py-2.5 text-sm">
            <div class="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center" :class="activityIconClass(item.action)">
              <component :is="activityIcon(item.action)" class="w-3 h-3" />
            </div>
            <span class="text-slate-700 dark:text-slate-300 font-medium">{{ item.actor }}</span>
            <span class="text-slate-500 dark:text-slate-400">{{ item.action }}</span>
            <span class="text-slate-400 text-xs">{{ item.entity_type }}</span>
            <span class="text-slate-400 text-xs ml-auto whitespace-nowrap">{{ formatTime(item.created_at) }}</span>
          </div>
        </div>
      </div>

      <div v-if="!hasAnyData" class="text-center py-20 text-slate-400">
        <LayoutDashboard class="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p class="text-sm">暂无数据，请检查权限配置</p>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useAuth } from '../../composables/useAuth';
import { adminFetch, formatBytes } from '../../composables/useAdminFetch';
import DashboardCard from '../../components/admin/DashboardCard.vue';
import { Package, ClipboardCheck, Shield, MessageSquare, Users, Image as ImageIcon, FileText, ScrollText, LayoutDashboard, Bug, Eye, Trash2, Edit3, Plus, CheckCircle, XCircle } from 'lucide-vue-next';

const { hasCapability } = useAuth();

const data = ref<Record<string, any>>({});
const loading = ref(true);

const moderationTotal = computed(() => {
  const m = data.value.pendingModeration;
  if (!m) return '—';
  return (m.comments + m.bugs) || '—';
});

const hasAnyData = computed(() => {
  const d = data.value;
  return d.projects?.total || d.pendingSubmissions?.count || d.openFeedback?.count || d.users?.total || d.media?.total || d.stories?.total;
});

const formatTime = (v: string) => {
  try {
    const d = new Date(v);
    if (isNaN(d.getTime())) return v;
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return '刚刚';
    if (diffMin < 60) return `${diffMin}分钟前`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}小时前`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 30) return `${diffDay}天前`;
    return d.toLocaleDateString('zh-CN');
  } catch {
    return v;
  }
};

const formatDate = (v: string) => {
  try {
    const d = new Date(v);
    if (isNaN(d.getTime())) return v;
    return d.toLocaleDateString('zh-CN');
  } catch {
    return v;
  }
};

const activityIcon = (action: string) => {
  if (action.includes('create') || action.includes('add')) return Plus;
  if (action.includes('update') || action.includes('edit')) return Edit3;
  if (action.includes('delete') || action.includes('remove')) return Trash2;
  if (action.includes('approve')) return CheckCircle;
  if (action.includes('reject')) return XCircle;
  return Eye;
};

const activityIconClass = (action: string) => {
  if (action.includes('create') || action.includes('add')) return 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-500';
  if (action.includes('update') || action.includes('edit')) return 'bg-blue-100 dark:bg-blue-500/20 text-blue-500';
  if (action.includes('delete') || action.includes('remove')) return 'bg-rose-100 dark:bg-rose-500/20 text-rose-500';
  if (action.includes('approve')) return 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-500';
  if (action.includes('reject')) return 'bg-amber-100 dark:bg-amber-500/20 text-amber-500';
  return 'bg-slate-100 dark:bg-slate-700 text-slate-400';
};

onMounted(async () => {
  try {
    const res = await adminFetch('/api/admin/dashboard');
    if (res.ok) {
      data.value = await res.json();
    }
  } catch (e) {
    console.error('Dashboard fetch error:', e);
  } finally {
    loading.value = false;
  }
});
</script>
