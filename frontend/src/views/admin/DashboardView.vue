<template>
  <div class="space-y-4 lg:space-y-6 max-w-full overflow-x-hidden">
    <ui-LoadingSpinner v-if="loading" brand="admin" />

    <template v-else>
      <div class="flex gap-2 overflow-x-auto pb-1 -webkit-overflow-scrolling-touch lg:hidden max-w-full">
        <div v-if="hasCapability('project:read')" class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex-shrink-0">
          <Package class="w-3.5 h-3.5" /><span class="text-xs font-bold">{{ data.projects?.total ?? '—' }}</span><span class="text-[10px]">项目</span>
        </div>
        <div v-if="hasCapability('submission:read')" class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 flex-shrink-0">
          <ClipboardCheck class="w-3.5 h-3.5" /><span class="text-xs font-bold">{{ data.pendingSubmissions?.count ?? '—' }}</span><span class="text-[10px]">待审</span>
        </div>
        <div v-if="hasCapability('moderation:read')" class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 flex-shrink-0">
          <Shield class="w-3.5 h-3.5" /><span class="text-xs font-bold">{{ moderationTotal }}</span><span class="text-[10px]">举报</span>
        </div>
        <div v-if="hasCapability('feedback:manage')" class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 flex-shrink-0">
          <MessageSquare class="w-3.5 h-3.5" /><span class="text-xs font-bold">{{ data.openFeedback?.count ?? '—' }}</span><span class="text-[10px]">反馈</span>
        </div>
        <div v-if="hasCapability('user:read')" class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400 flex-shrink-0">
          <Users class="w-3.5 h-3.5" /><span class="text-xs font-bold">{{ data.users?.total ?? '—' }}</span><span class="text-[10px]">用户</span>
        </div>
        <div v-if="hasCapability('media:read')" class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex-shrink-0">
          <ImageIcon class="w-3.5 h-3.5" /><span class="text-xs font-bold">{{ data.media?.total ?? '—' }}</span><span class="text-[10px]">媒体</span>
        </div>
        <div v-if="hasCapability('story:manage')" class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex-shrink-0">
          <FileText class="w-3.5 h-3.5" /><span class="text-xs font-bold">{{ data.stories?.total ?? '—' }}</span><span class="text-[10px]">文章</span>
        </div>
        <div v-if="canViewAnalytics && analytics" class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex-shrink-0">
          <BarChart3 class="w-3.5 h-3.5" /><span class="text-xs font-bold">{{ analytics.pv.today }}</span><span class="text-[10px]">今日PV</span>
        </div>
      </div>

      <div class="hidden lg:grid lg:grid-cols-4 gap-4">
        <DashboardCard v-if="hasCapability('project:read')" label="项目总数" :main-value="data.projects?.total ?? '—'" :sub-value="data.projects ? `本周新增 ${data.projects.newThisWeek}` : ''" :icon="Package" color="blue" />
        <DashboardCard v-if="hasCapability('submission:read')" label="待审核提交" :main-value="data.pendingSubmissions?.count ?? '—'" :icon="ClipboardCheck" color="amber" />
        <DashboardCard v-if="hasCapability('moderation:read')" label="待审核内容" :main-value="moderationTotal" :sub-value="data.pendingModeration ? `评论 ${data.pendingModeration.comments} / Bug ${data.pendingModeration.bugs}` : ''" :icon="Shield" color="rose" />
        <DashboardCard v-if="hasCapability('feedback:manage')" label="待处理反馈" :main-value="data.openFeedback?.count ?? '—'" :icon="MessageSquare" color="purple" />
        <DashboardCard v-if="hasCapability('user:read')" label="用户总数" :main-value="data.users?.total ?? '—'" :sub-value="data.users ? `本周注册 ${data.users.newThisWeek}` : ''" :icon="Users" color="teal" />
        <DashboardCard v-if="hasCapability('media:read')" label="媒体资产" :main-value="data.media?.total ?? '—'" :sub-value="data.media ? formatBytes(data.media.totalSize) : ''" :icon="ImageIcon" color="emerald" />
        <DashboardCard v-if="hasCapability('story:manage')" label="文章数" :main-value="data.stories?.total ?? '—'" :icon="FileText" color="blue" />
        <DashboardCard v-if="canViewAnalytics && analytics" label="今日浏览" :main-value="analytics.pv.today" :sub-value="`本周 ${analytics.pv.thisWeek}`" :icon="BarChart3" color="indigo" />
      </div>

      <LazySection v-if="canViewAnalytics" @visible="visibleSections.analytics = true">
        <div v-if="visibleSections.analytics" class="bg-white/72 dark:bg-slate-900/62 backdrop-blur-lg rounded-3xl border border-white/70 dark:border-slate-700/70 shadow-xl shadow-slate-900/8 dark:shadow-black/30 overflow-hidden">
          <div class="px-4 lg:px-5 py-3 lg:py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <h3 class="font-bold text-sm lg:text-base flex items-center gap-2"><BarChart3 class="w-4 h-4 text-indigo-500" />数据分析</h3>
            <router-link to="/admin/analytics" class="text-xs text-emerald-600 dark:text-emerald-400 font-medium">查看完整分析 →</router-link>
          </div>

          <div v-if="analyticsLoading" class="flex items-center justify-center py-16">
            <div class="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          </div>

          <div v-else-if="analytics" class="p-4 lg:p-5 space-y-4">
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div class="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3">
                <div class="text-[10px] lg:text-xs text-slate-500 dark:text-slate-400 mb-0.5">页面浏览</div>
                <div class="text-lg lg:text-2xl font-bold text-slate-900 dark:text-white">{{ formatNum(analytics.pv.total) }}</div>
                <div class="text-[10px] text-slate-400 mt-0.5">今日 {{ formatNum(analytics.pv.today) }} · 本周 {{ formatNum(analytics.pv.thisWeek) }}</div>
              </div>
              <div class="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3">
                <div class="text-[10px] lg:text-xs text-slate-500 dark:text-slate-400 mb-0.5">独立访客</div>
                <div class="text-lg lg:text-2xl font-bold text-slate-900 dark:text-white">{{ formatNum(analytics.uv.total) }}</div>
                <div class="text-[10px] text-slate-400 mt-0.5">今日 {{ formatNum(analytics.uv.today) }} · 本周 {{ formatNum(analytics.uv.thisWeek) }}</div>
              </div>
              <div class="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3">
                <div class="text-[10px] lg:text-xs text-slate-500 dark:text-slate-400 mb-0.5">项目点击</div>
                <div class="text-lg lg:text-2xl font-bold text-slate-900 dark:text-white">{{ formatNum(analytics.clicks.total) }}</div>
                <div class="text-[10px] text-slate-400 mt-0.5">今日 {{ formatNum(analytics.clicks.today) }}</div>
              </div>
              <div class="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3">
                <div class="text-[10px] lg:text-xs text-slate-500 dark:text-slate-400 mb-0.5">搜索次数</div>
                <div class="text-lg lg:text-2xl font-bold text-slate-900 dark:text-white">{{ formatNum(analytics.searches.total) }}</div>
                <div class="text-[10px] text-slate-400 mt-0.5">今日 {{ formatNum(analytics.searches.today) }}</div>
              </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <h4 class="font-semibold text-xs lg:text-sm mb-2 text-slate-700 dark:text-slate-300">浏览趋势</h4>
                <div class="h-48 lg:h-56">
                  <VChart :option="pvTrendOption" autoresize class="w-full h-full" />
                </div>
              </div>
              <div>
                <h4 class="font-semibold text-xs lg:text-sm mb-2 text-slate-700 dark:text-slate-300">页面热力图</h4>
                <div class="h-48 lg:h-56">
                  <VChart :option="heatmapOption" autoresize class="w-full h-full" />
                </div>
              </div>
            </div>
          </div>

          <div v-else-if="analyticsError" class="text-center py-12 text-rose-500 dark:text-rose-400 text-sm">{{ analyticsError }}</div>
          <div v-else class="text-center py-12 text-slate-400 text-sm">暂无分析数据</div>
      </div>
      </LazySection>

      <LazySection v-if="hasCapability('story:manage') && data.stories?.recent?.length" @visible="visibleSections.stories = true">
        <div v-if="visibleSections.stories" class="bg-white/72 dark:bg-slate-900/62 backdrop-blur-lg rounded-3xl border border-white/70 dark:border-slate-700/70 shadow-xl shadow-slate-900/8 dark:shadow-black/30 overflow-hidden">
          <div class="px-4 lg:px-5 py-3 lg:py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <h3 class="font-bold text-sm lg:text-base flex items-center gap-2"><FileText class="w-4 h-4 text-blue-500" />最近文章</h3>
            <router-link to="/admin/stories" class="text-xs text-emerald-600 dark:text-emerald-400 font-medium">全部 →</router-link>
          </div>
          <div class="divide-y divide-slate-100 dark:divide-slate-700">
            <router-link v-for="story in data.stories.recent" :key="story.id" to="/admin/stories" class="flex items-center gap-3 px-4 lg:px-5 py-3 active:bg-slate-100 dark:active:bg-slate-700 transition-colors">
              <div v-if="story.cover" class="w-12 h-12 lg:w-14 lg:h-14 rounded-lg lg:rounded-xl overflow-hidden flex-shrink-0 bg-slate-100 dark:bg-slate-700">
                <img :src="story.cover" :alt="story.title" class="w-full h-full object-cover" loading="lazy" decoding="async" />
              </div>
              <div v-else class="w-12 h-12 lg:w-14 lg:h-14 rounded-lg lg:rounded-xl flex-shrink-0 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/40 dark:to-indigo-900/40 flex items-center justify-center">
                <FileText class="w-5 h-5 text-blue-400" />
              </div>
              <div class="flex-1 min-w-0">
                <div class="font-semibold text-sm truncate text-slate-900 dark:text-white">{{ story.title }}</div>
                <div class="text-xs text-slate-400 mt-0.5">
                  <span v-if="story.author">{{ story.author }}</span>
                  <span v-if="story.author && story.created_at"> · </span>
                  <span v-if="story.created_at">{{ formatDate(story.created_at) }}</span>
                </div>
              </div>
            </router-link>
          </div>
        </div>
      </LazySection>

      <LazySection v-if="hasCapability('project:read') && data.projects?.recent?.length" @visible="visibleSections.projects = true">
        <div v-if="visibleSections.projects" class="bg-white/72 dark:bg-slate-900/62 backdrop-blur-lg rounded-3xl border border-white/70 dark:border-slate-700/70 shadow-xl shadow-slate-900/8 dark:shadow-black/30 overflow-hidden">
          <div class="px-4 lg:px-5 py-3 lg:py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <h3 class="font-bold text-sm lg:text-base flex items-center gap-2"><Package class="w-4 h-4 text-blue-500" />最近项目</h3>
            <router-link to="/admin/projects" class="text-xs text-emerald-600 dark:text-emerald-400 font-medium">全部 →</router-link>
          </div>
          <div class="divide-y divide-slate-100 dark:divide-slate-700">
            <router-link v-for="proj in data.projects.recent" :key="proj.slug" to="/admin/projects" class="flex items-center gap-3 px-4 lg:px-5 py-3 active:bg-slate-100 dark:active:bg-slate-700 transition-colors">
              <div class="w-9 h-9 lg:w-10 lg:h-10 rounded-lg lg:rounded-xl overflow-hidden flex-shrink-0 bg-slate-100 dark:bg-slate-700">
                <img v-if="proj.icon" :src="proj.icon" :alt="proj.name" class="w-full h-full object-cover" loading="lazy" decoding="async" />
                <div v-else class="w-full h-full flex items-center justify-center text-slate-400"><Package class="w-4 h-4" /></div>
              </div>
              <div class="flex-1 min-w-0">
                <div class="font-semibold text-sm truncate text-slate-900 dark:text-white">{{ proj.name }}</div>
                <div class="text-xs text-slate-400 mt-0.5 truncate">{{ proj.description || proj.developer }}</div>
              </div>
              <div class="hidden sm:flex items-center gap-2 flex-shrink-0">
                <span v-if="proj.stars" class="text-xs text-amber-500 font-medium">⭐ {{ proj.stars }}</span>
                <span v-if="proj.language" class="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 font-mono">{{ proj.language }}</span>
              </div>
            </router-link>
          </div>
        </div>
      </LazySection>

      <LazySection v-if="hasCapability('submission:read') && data.pendingSubmissions?.recent?.length" @visible="visibleSections.submissions = true">
        <div v-if="visibleSections.submissions" class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div class="px-4 lg:px-5 py-3 lg:py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <h3 class="font-bold text-sm lg:text-base flex items-center gap-2"><ClipboardCheck class="w-4 h-4 text-amber-500" />最近提交</h3>
            <router-link to="/admin/review?tab=projects" class="text-xs text-emerald-600 dark:text-emerald-400 font-medium">全部 →</router-link>
          </div>
          <div class="divide-y divide-slate-100 dark:divide-slate-700">
            <router-link v-for="sub in data.pendingSubmissions.recent" :key="sub.id" to="/admin/review?tab=projects" class="flex items-center gap-3 px-4 lg:px-5 py-3 active:bg-slate-100 dark:active:bg-slate-700 transition-colors">
              <div class="w-9 h-9 rounded-lg flex-shrink-0 flex items-center justify-center" :class="sub.status === 'pending' ? 'bg-amber-100 dark:bg-amber-500/20' : sub.status === 'approved' ? 'bg-emerald-100 dark:bg-emerald-500/20' : 'bg-rose-100 dark:bg-rose-500/20'">
                <ClipboardCheck class="w-4 h-4" :class="sub.status === 'pending' ? 'text-amber-500' : sub.status === 'approved' ? 'text-emerald-500' : 'text-rose-500'" />
              </div>
              <div class="flex-1 min-w-0">
                <div class="font-semibold text-sm truncate text-slate-900 dark:text-white">{{ sub.payload?.name || '未命名提交' }}</div>
                <div class="text-xs text-slate-400 mt-0.5">{{ sub.payload?.developer || '' }} · {{ formatTime(sub.created_at) }}</div>
              </div>
              <ui-StatusBadge :status="sub.status" />
            </router-link>
          </div>
        </div>
      </LazySection>

      <LazySection v-if="hasCapability('media:read') && data.media?.recent?.length" @visible="visibleSections.media = true">
        <div v-if="visibleSections.media" class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div class="px-4 lg:px-5 py-3 lg:py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <h3 class="font-bold text-sm lg:text-base flex items-center gap-2"><ImageIcon class="w-4 h-4 text-emerald-500" />最近上传</h3>
            <router-link to="/admin/media" class="text-xs text-emerald-600 dark:text-emerald-400 font-medium">全部 →</router-link>
          </div>
          <div class="p-3 lg:p-4 grid grid-cols-3 lg:grid-cols-6 gap-2 lg:gap-3">
            <div v-for="img in mobileMedia" :key="img.id" class="aspect-square rounded-lg lg:rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-700">
              <img :src="img.url" alt="" class="w-full h-full object-cover" loading="lazy" decoding="async" />
            </div>
          </div>
        </div>
      </LazySection>

      <LazySection v-if="hasCapability('user:read') && data.users?.recent?.length" @visible="visibleSections.users = true">
        <div v-if="visibleSections.users" class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div class="px-4 lg:px-5 py-3 lg:py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <h3 class="font-bold text-sm lg:text-base flex items-center gap-2"><Users class="w-4 h-4 text-teal-500" />最近用户</h3>
            <router-link to="/admin/users" class="text-xs text-emerald-600 dark:text-emerald-400 font-medium">全部 →</router-link>
          </div>
          <div class="divide-y divide-slate-100 dark:divide-slate-700">
            <router-link v-for="u in data.users.recent" :key="u.id" to="/admin/users" class="flex items-center gap-3 px-4 lg:px-5 py-2.5 active:bg-slate-100 dark:active:bg-slate-700 transition-colors">
              <div class="w-7 h-7 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-700 flex-shrink-0">
                <img v-if="u.avatar_url" :src="u.avatar_url" :alt="u.name" class="w-full h-full object-cover" loading="lazy" decoding="async" />
                <div v-else class="w-full h-full flex items-center justify-center text-[10px] font-bold text-slate-400">{{ (u.name || '?')[0].toUpperCase() }}</div>
              </div>
              <span class="font-medium text-sm text-slate-900 dark:text-white flex-1 min-w-0 truncate">{{ u.name }}</span>
              <span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 font-medium flex-shrink-0">{{ u.role }}</span>
              <span class="text-xs text-slate-400 flex-shrink-0 hidden sm:inline">{{ formatTime(u.created_at) }}</span>
            </router-link>
          </div>
        </div>
      </LazySection>

      <LazySection v-if="hasCapability('feedback:manage') && data.openFeedback?.recent?.length" @visible="visibleSections.feedback = true">
        <div v-if="visibleSections.feedback" class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div class="px-4 lg:px-5 py-3 lg:py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <h3 class="font-bold text-sm lg:text-base flex items-center gap-2"><MessageSquare class="w-4 h-4 text-purple-500" />最近反馈</h3>
            <router-link to="/admin/review?tab=bugs" class="text-xs text-emerald-600 dark:text-emerald-400 font-medium">全部 →</router-link>
          </div>
          <div class="divide-y divide-slate-100 dark:divide-slate-700">
            <router-link v-for="fb in data.openFeedback.recent" :key="fb.id" to="/admin/review?tab=bugs" class="flex items-start gap-2.5 px-4 lg:px-5 py-2.5 active:bg-slate-100 dark:active:bg-slate-700 transition-colors">
              <div class="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center mt-0.5" :class="fb.kind === 'bug' ? 'bg-rose-100 dark:bg-rose-500/20' : 'bg-blue-100 dark:bg-blue-500/20'">
                <Bug v-if="fb.kind === 'bug'" class="w-3.5 h-3.5 text-rose-500" />
                <MessageSquare v-else class="w-3.5 h-3.5 text-blue-500" />
              </div>
              <div class="flex-1 min-w-0">
                <div class="font-semibold text-sm text-slate-900 dark:text-white truncate">{{ fb.title || fb.body?.slice(0, 50) || '无标题' }}</div>
                <div class="text-xs text-slate-400 mt-0.5">{{ fb.project_name }} · {{ fb.actor_username }}</div>
              </div>
            </router-link>
          </div>
        </div>
      </LazySection>

      <LazySection v-if="hasCapability('audit:read') && data.recentActivity?.length" @visible="visibleSections.audit = true">
        <div v-if="visibleSections.audit" class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div class="px-4 lg:px-5 py-3 lg:py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <h3 class="font-bold text-sm lg:text-base flex items-center gap-2"><ScrollText class="w-4 h-4 text-slate-400" />审计日志</h3>
            <router-link to="/admin/audit" class="text-xs text-emerald-600 dark:text-emerald-400 font-medium">全部 →</router-link>
          </div>
          <div class="divide-y divide-slate-100 dark:divide-slate-700">
            <div v-for="(item, i) in data.recentActivity" :key="i" class="flex items-center gap-2.5 px-4 lg:px-5 py-2 text-sm">
              <div class="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center" :class="activityIconClass(item.action)">
                <component :is="activityIcon(item.action)" class="w-3 h-3" />
              </div>
              <span class="text-slate-700 dark:text-slate-300 font-medium text-xs">{{ item.actor }}</span>
              <span class="text-slate-500 dark:text-slate-400 text-xs truncate">{{ item.action }}</span>
              <span class="text-slate-400 text-[10px] ml-auto whitespace-nowrap flex-shrink-0">{{ formatTime(item.created_at) }}</span>
            </div>
          </div>
        </div>
      </LazySection>

      <ui-EmptyState v-if="!hasAnyData" :icon="LayoutDashboard" title="暂无数据" description="请检查权限配置" container-class="py-20" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, reactive, defineComponent, h, onBeforeUnmount } from 'vue';
import { useAuth } from '../../composables/useAuth';
import { adminFetch, formatBytes } from '../../composables/useAdminFetch';
import { LoadingSpinner as uiLoadingSpinner, EmptyState as uiEmptyState, StatusBadge as uiStatusBadge } from '../../components/ui';
import DashboardCard from '../../components/admin/DashboardCard.vue';
import { Package, ClipboardCheck, Shield, MessageSquare, Users, Image as ImageIcon, FileText, ScrollText, LayoutDashboard, Bug, Eye, Trash2, Edit3, Plus, CheckCircle, XCircle, BarChart3 } from 'lucide-vue-next';
import * as echarts from 'echarts/core';
import { LineChart, BarChart, PieChart, TreemapChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent, VisualMapComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import VChart from 'vue-echarts';

echarts.use([LineChart, BarChart, PieChart, TreemapChart, GridComponent, TooltipComponent, LegendComponent, VisualMapComponent, CanvasRenderer]);

const LazySection = defineComponent({
  props: { threshold: { type: Number, default: 0.1 } },
  emits: ['visible'],
  setup(props, { slots, emit }) {
    const root = ref<HTMLElement | null>(null);
    const visible = ref(false);
    let observer: IntersectionObserver | null = null;

    onMounted(() => {
      if (!root.value) return;
      observer = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) { visible.value = true; emit('visible'); observer?.disconnect(); } },
        { threshold: props.threshold, rootMargin: '100px' }
      );
      observer.observe(root.value);
    });

    onBeforeUnmount(() => observer?.disconnect());

    return () => h('div', { ref: root }, visible.value ? slots.default?.() : h('div', { class: 'h-4' }));
  }
});

const { hasCapability } = useAuth();
const canViewAnalytics = computed(() => hasCapability('analytics:read') || hasCapability('admin_panel_access'));

const data = ref<Record<string, any>>({});
const loading = ref(true);
const visibleSections = reactive<Record<string, boolean>>({
  stories: false, projects: false, submissions: false, media: false, users: false, feedback: false, audit: false, analytics: false,
});

type AnalyticsData = {
  pv: { total: number; today: number; thisWeek: number };
  uv: { total: number; today: number; thisWeek: number };
  clicks: { total: number; today: number };
  searches: { total: number; today: number };
  dailyPvTrend: Array<{ date: string; pv: number; uv: number }>;
  topPages: Array<{ path: string; count: number }>;
  topProjects: Array<{ slug: string; clicks: number; downloads: number }>;
  topSearches: Array<{ query: string; count: number; avgResults: number }>;
  categoryDistribution: Array<{ category: string; count: number }>;
};

const analytics = ref<AnalyticsData | null>(null);
const analyticsLoading = ref(false);
const analyticsError = ref('');
const analyticsFetched = ref(false);

const formatNum = (n: number) => {
  if (n >= 10000) return (n / 10000).toFixed(1) + 'w';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
};

async function fetchAnalytics() {
  if (!canViewAnalytics.value) return;
  analyticsLoading.value = true;
  analyticsError.value = '';
  try {
    const res = await adminFetch(`/api/admin/analytics?days=7`);
    if (res.ok) {
      analytics.value = await res.json();
      analyticsFetched.value = true;
    } else {
      analyticsError.value = `加载失败 (${res.status})`;
    }
  } catch (e) {
    console.error('Analytics fetch error:', e);
    analyticsError.value = '加载失败，请稍后重试';
  } finally {
    analyticsLoading.value = false;
  }
}

const isDark = computed(() => {
  if (typeof window === 'undefined') return false;
  return document.documentElement.classList.contains('dark');
});

const axisLabelColor = computed(() => isDark.value ? '#94a3b8' : '#64748b');
const splitLineColor = computed(() => isDark.value ? '#334155' : '#e2e8f0');

const pvTrendOption = computed(() => ({
  tooltip: { trigger: 'axis' as const, backgroundColor: isDark.value ? '#1e293b' : '#fff', borderColor: isDark.value ? '#334155' : '#e2e8f0', textStyle: { color: isDark.value ? '#e2e8f0' : '#334155' } },
  legend: { data: ['PV', 'UV'], textStyle: { color: axisLabelColor.value }, top: 0 },
  grid: { left: 40, right: 16, top: 32, bottom: 24 },
  xAxis: { type: 'category' as const, data: analytics.value?.dailyPvTrend.map(d => d.date.slice(5)) ?? [], axisLabel: { color: axisLabelColor.value, fontSize: 10 }, axisLine: { lineStyle: { color: splitLineColor.value } } },
  yAxis: { type: 'value' as const, axisLabel: { color: axisLabelColor.value, fontSize: 10 }, splitLine: { lineStyle: { color: splitLineColor.value } } },
  series: [
    { name: 'PV', type: 'line' as const, data: analytics.value?.dailyPvTrend.map(d => d.pv) ?? [], smooth: true, areaStyle: { opacity: 0.15 }, itemStyle: { color: '#10b981' } },
    { name: 'UV', type: 'line' as const, data: analytics.value?.dailyPvTrend.map(d => d.uv) ?? [], smooth: true, areaStyle: { opacity: 0.1 }, itemStyle: { color: '#6366f1' } }
  ]
}));

const heatmapOption = computed(() => {
  const pages = analytics.value?.topPages ?? [];
  const maxVal = Math.max(...pages.map(p => p.count), 1);
  return {
    tooltip: { formatter: (info: any) => `${info.name}<br/>浏览量: ${info.value}` },
    series: [{
      type: 'treemap' as const,
      data: pages.map(p => ({ name: (p as { path: string; count: number; displayName?: string }).displayName ?? p.path, value: p.count })),
      roam: false,
      nodeClick: false,
      breadcrumb: { show: false },
      label: { show: true, formatter: (info: any) => info.name.length > 14 ? info.name.slice(0, 14) + '…' : info.name, fontSize: 10, color: '#fff' },
      itemStyle: { borderColor: isDark.value ? '#1e293b' : '#fff', borderWidth: 2, gapWidth: 2 },
      visualMin: 0,
      visualMax: maxVal,
      colorMappingBy: 'value' as const
    }],
    visualMap: {
      show: false,
      min: 0,
      max: maxVal,
      inRange: { color: ['#818cf8', '#6366f1', '#4f46e5', '#4338ca'] }
    }
  };
});

const moderationTotal = computed(() => {
  const m = data.value.pendingModeration;
  if (!m) return '—';
  return (m.comments + m.bugs) || '—';
});

const hasAnyData = computed(() => {
  const d = data.value;
  return d.projects?.total || d.pendingSubmissions?.count || d.openFeedback?.count || d.users?.total || d.media?.total || d.stories?.total;
});

const mobileMedia = computed(() => {
  const list = data.value.media?.recent || [];
  return list.slice(0, 3);
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
  } catch { return v; }
};

const formatDate = (v: string) => {
  try {
    const d = new Date(v);
    if (isNaN(d.getTime())) return v;
    return d.toLocaleDateString('zh-CN');
  } catch { return v; }
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
    if (res.ok) data.value = await res.json();
  } catch (e) {
    console.error('Dashboard fetch error:', e);
  } finally {
    loading.value = false;
  }
  if (canViewAnalytics.value) void fetchAnalytics();
});
</script>
