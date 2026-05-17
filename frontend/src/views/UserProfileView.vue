<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useHead } from '@unhead/vue';
import { MessageSquare, FolderKanban, Building2, Calendar, Pencil, ChevronLeft, ChevronRight } from 'lucide-vue-next';
import { useAuth } from '../composables/useAuth';
import { useApi } from '../composables/useApi';
import { API } from '../api/endpoints';
import MarkdownIt from 'markdown-it';
import DOMPurify from 'dompurify';

const route = useRoute();
const router = useRouter();
const { user, isAuthenticated } = useAuth();
const { apiFetch } = useApi();

const userName = computed(() => decodeURIComponent(String(route.params.name ?? '')));

useHead(computed(() => ({
  title: `${userName.value} - Awesome IWB`,
  meta: [{ name: 'description', content: `${userName.value} 的个人主页` }]
})));

type UserProfile = {
  name: string;
  avatar_url: string;
  role_label: string;
  project_count: number;
  organization_count: number;
  joined_at: string;
};

type UserComment = {
  id: string;
  project_name: string;
  body: string;
  created_at: string;
};

type UserProject = {
  project_name: string;
  display_name: string;
  icon_url: string;
  description: string;
  role: string;
};

type UserOrganization = {
  id: string;
  name: string;
  slug: string;
  avatar_url: string;
  description: string;
  role: string;
};

const profile = ref<UserProfile | null>(null);
const isLoading = ref(true);
const notFound = ref(false);

const activeTab = ref<'comments' | 'projects' | 'organizations'>('comments');

const comments = ref<UserComment[]>([]);
const commentsPage = ref(1);
const commentsTotal = ref(0);
const commentsPageSize = 20;
const isLoadingComments = ref(false);

const projects = ref<UserProject[]>([]);
const isLoadingProjects = ref(false);

const organizations = ref<UserOrganization[]>([]);
const isLoadingOrganizations = ref(false);

const md = new MarkdownIt({ breaks: true, linkify: true });
const renderMarkdown = (text: string) => {
  if (!text) return '';
  return DOMPurify.sanitize(md.render(text));
};

const isSelf = computed(() => isAuthenticated.value && user.value?.name === userName.value);

const formatTime = (iso: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins} 分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
};

const roleBadgeClass = computed(() => {
  if (!profile.value) return '';
  const label = profile.value.role_label;
  if (label === '超级管理员') return 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300';
  if (label === '运维') return 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300';
  if (label === '编者') return 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300';
  if (label === '开发者') return 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300';
  return 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300';
});

const fetchProfile = async () => {
  isLoading.value = true;
  notFound.value = false;
  profile.value = null;
  try {
    const res = await apiFetch(API.users.profile(userName.value));
    if (res.status === 404) {
      notFound.value = true;
      return;
    }
    if (!res.ok) throw new Error('load failed');
    profile.value = await res.json();
  } catch {
    notFound.value = true;
  } finally {
    isLoading.value = false;
  }
};

const fetchComments = async () => {
  isLoadingComments.value = true;
  try {
    const res = await apiFetch(`${API.users.comments(userName.value)}?page=${commentsPage.value}&pageSize=${commentsPageSize}`);
    const json = await res.json();
    if (!res.ok) throw new Error('load failed');
    comments.value = json.items ?? [];
    commentsTotal.value = json.total ?? 0;
  } catch {
    comments.value = [];
  } finally {
    isLoadingComments.value = false;
  }
};

const fetchProjects = async () => {
  isLoadingProjects.value = true;
  try {
    const res = await apiFetch(API.users.projects(userName.value));
    const json = await res.json();
    if (!res.ok) throw new Error('load failed');
    projects.value = Array.isArray(json) ? json : [];
  } catch {
    projects.value = [];
  } finally {
    isLoadingProjects.value = false;
  }
};

const fetchOrganizations = async () => {
  isLoadingOrganizations.value = true;
  try {
    const res = await apiFetch(API.users.organizations(userName.value));
    const json = await res.json();
    if (!res.ok) throw new Error('load failed');
    organizations.value = Array.isArray(json) ? json : [];
  } catch {
    organizations.value = [];
  } finally {
    isLoadingOrganizations.value = false;
  }
};

const loadTab = (tab: 'comments' | 'projects' | 'organizations') => {
  activeTab.value = tab;
  if (tab === 'comments' && comments.value.length === 0) fetchComments();
  if (tab === 'projects' && projects.value.length === 0) fetchProjects();
  if (tab === 'organizations' && organizations.value.length === 0) fetchOrganizations();
};

const totalPages = computed(() => Math.max(1, Math.ceil(commentsTotal.value / commentsPageSize)));

const onAuthUpdated = () => {
  if (!isSelf.value) return;
  void fetchProfile();
};

onMounted(async () => {
  window.addEventListener('auth:updated', onAuthUpdated as EventListener);
  await fetchProfile();
  if (profile.value) fetchComments();
});

onUnmounted(() => {
  window.removeEventListener('auth:updated', onAuthUpdated as EventListener);
});

watch(() => route.params.name, async () => {
  if (route.name !== 'user-profile') return;
  comments.value = [];
  projects.value = [];
  organizations.value = [];
  commentsPage.value = 1;
  activeTab.value = 'comments';
  await fetchProfile();
  if (profile.value) fetchComments();
});
</script>

<template>
  <div class="min-h-screen bg-[#F8FAFC] dark:bg-[#0B1120] text-slate-900 dark:text-slate-100 font-sans pb-24">
    <main class="pt-24 px-6 max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out-expo">

      <!-- Loading -->
      <div v-if="isLoading" class="flex items-center justify-center py-20">
        <div class="w-8 h-8 border-3 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
      </div>

      <!-- 404 -->
      <div v-else-if="notFound" class="text-center py-20">
        <div class="text-6xl mb-4">🔍</div>
        <h2 class="text-2xl font-extrabold text-slate-900 dark:text-white mb-2">用户不存在</h2>
        <p class="text-slate-500 dark:text-slate-400 mb-6">找不到名为「{{ userName }}」的用户</p>
        <button @click="router.push('/')" class="px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-colors">返回首页</button>
      </div>

      <!-- Profile -->
      <div v-else-if="profile">
        <!-- Self notice -->
        <div v-if="isSelf" class="mb-6 p-4 rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-between">
          <span class="text-sm text-emerald-700 dark:text-emerald-300 font-medium">这是你的公开主页</span>
          <button @click="router.push('/me')" class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition-colors">
            <Pencil class="w-3.5 h-3.5" />
            编辑资料
          </button>
        </div>

        <!-- Header -->
        <div class="bg-white dark:bg-[#111827] rounded-3xl p-6 sm:p-10 border border-slate-200/80 dark:border-slate-800/80 shadow-xl shadow-slate-200/50 dark:shadow-none mb-6">
          <div class="flex items-center gap-5">
            <div class="w-20 h-20 rounded-full bg-slate-200/70 dark:bg-slate-700/70 overflow-hidden shrink-0">
              <img v-if="profile.avatar_url" :src="profile.avatar_url" :alt="profile.name" class="w-full h-full object-cover" />
              <div v-else class="w-full h-full flex items-center justify-center text-2xl font-extrabold text-slate-400">{{ profile.name.charAt(0).toUpperCase() }}</div>
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-3 flex-wrap">
                <h1 class="text-2xl font-extrabold text-slate-900 dark:text-white truncate">{{ profile.name }}</h1>
                <span class="inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold" :class="roleBadgeClass">{{ profile.role_label }}</span>
              </div>
              <div class="flex items-center gap-3 mt-2 text-sm text-slate-500 dark:text-slate-400 flex-wrap">
                <span class="inline-flex items-center gap-1"><FolderKanban class="w-3.5 h-3.5" /> {{ profile.project_count }} 个项目</span>
                <span>·</span>
                <span class="inline-flex items-center gap-1"><Building2 class="w-3.5 h-3.5" /> {{ profile.organization_count }} 个组织</span>
                <span>·</span>
                <span class="inline-flex items-center gap-1"><Calendar class="w-3.5 h-3.5" /> {{ formatTime(profile.joined_at) }}加入</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Tabs -->
        <div class="bg-white dark:bg-[#111827] rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-xl shadow-slate-200/50 dark:shadow-none overflow-hidden">
          <div class="flex border-b border-slate-200 dark:border-slate-800">
            <button
              v-for="tab in (['comments', 'projects', 'organizations'] as const)"
              :key="tab"
              @click="loadTab(tab)"
              class="flex-1 px-4 py-4 text-sm font-bold transition-colors relative"
              :class="activeTab === tab ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'"
            >
              <span class="inline-flex items-center gap-1.5">
                <MessageSquare v-if="tab === 'comments'" class="w-4 h-4" />
                <FolderKanban v-else-if="tab === 'projects'" class="w-4 h-4" />
                <Building2 v-else class="w-4 h-4" />
                {{ tab === 'comments' ? '评论' : tab === 'projects' ? '项目' : '组织' }}
              </span>
              <div v-if="activeTab === tab" class="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-0.5 bg-emerald-500 rounded-full"></div>
            </button>
          </div>

          <div class="p-6">
            <!-- Comments Tab -->
            <div v-if="activeTab === 'comments'">
              <div v-if="isLoadingComments" class="flex items-center justify-center py-10">
                <div class="w-6 h-6 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
              </div>
              <div v-else-if="comments.length === 0" class="text-center py-10 text-slate-400 dark:text-slate-500">
                <MessageSquare class="w-10 h-10 mx-auto mb-3 opacity-50" />
                <p class="text-sm">暂无公开评论</p>
              </div>
              <div v-else class="space-y-4">
                <div v-for="c in comments" :key="c.id" class="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30">
                  <div class="prose prose-sm dark:prose-invert max-w-none text-slate-700 dark:text-slate-300" v-html="renderMarkdown(c.body)"></div>
                  <div class="flex items-center gap-2 mt-3 text-xs text-slate-500 dark:text-slate-400">
                    <router-link :to="'/project/' + encodeURIComponent(c.project_name)" class="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-emerald-100 dark:hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors font-medium">
                      <FolderKanban class="w-3 h-3" />
                      {{ c.project_name }}
                    </router-link>
                    <span>{{ formatTime(c.created_at) }}</span>
                  </div>
                </div>
              </div>
              <!-- Pagination -->
              <div v-if="commentsTotal > commentsPageSize" class="flex items-center justify-between mt-6 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  @click="commentsPage--; fetchComments()"
                  :disabled="commentsPage <= 1"
                  class="inline-flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-bold bg-slate-100 dark:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  <ChevronLeft class="w-4 h-4" /> 上一页
                </button>
                <span class="text-sm text-slate-500 dark:text-slate-400">{{ commentsPage }} / {{ totalPages }}</span>
                <button
                  @click="commentsPage++; fetchComments()"
                  :disabled="commentsPage >= totalPages"
                  class="inline-flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-bold bg-slate-100 dark:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  下一页 <ChevronRight class="w-4 h-4" />
                </button>
              </div>
            </div>

            <!-- Projects Tab -->
            <div v-if="activeTab === 'projects'">
              <div v-if="isLoadingProjects" class="flex items-center justify-center py-10">
                <div class="w-6 h-6 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
              </div>
              <div v-else-if="projects.length === 0" class="text-center py-10 text-slate-400 dark:text-slate-500">
                <FolderKanban class="w-10 h-10 mx-auto mb-3 opacity-50" />
                <p class="text-sm">暂无参与的项目</p>
              </div>
              <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <router-link
                  v-for="p in projects"
                  :key="p.project_name"
                  :to="'/project/' + encodeURIComponent(p.project_name)"
                  class="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30 hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors group"
                >
                  <div class="flex items-center gap-3 mb-2">
                    <img v-if="p.icon_url" :src="p.icon_url" :alt="p.display_name" class="w-8 h-8 rounded-lg object-cover" />
                    <div v-else class="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 text-xs font-bold">{{ (p.display_name || p.project_name).charAt(0) }}</div>
                    <div class="min-w-0 flex-1">
                      <div class="text-sm font-extrabold text-slate-900 dark:text-white truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">{{ p.display_name || p.project_name }}</div>
                    </div>
                    <span class="text-[10px] px-2 py-0.5 rounded-md font-bold shrink-0" :class="p.role === 'owner' ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'">{{ p.role === 'owner' ? '负责人' : '协作者' }}</span>
                  </div>
                  <p v-if="p.description" class="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{{ p.description }}</p>
                </router-link>
              </div>
            </div>

            <!-- Organizations Tab -->
            <div v-if="activeTab === 'organizations'">
              <div v-if="isLoadingOrganizations" class="flex items-center justify-center py-10">
                <div class="w-6 h-6 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
              </div>
              <div v-else-if="organizations.length === 0" class="text-center py-10 text-slate-400 dark:text-slate-500">
                <Building2 class="w-10 h-10 mx-auto mb-3 opacity-50" />
                <p class="text-sm">暂无所属组织</p>
              </div>
              <div v-else class="space-y-3">
                <div
                  v-for="o in organizations"
                  :key="o.id"
                  class="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30"
                >
                  <div class="flex items-center gap-3">
                    <img v-if="o.avatar_url" :src="o.avatar_url" :alt="o.name" class="w-10 h-10 rounded-xl object-cover" />
                    <div v-else class="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 text-sm font-bold">{{ o.name.charAt(0) }}</div>
                    <div class="min-w-0 flex-1">
                      <div class="text-sm font-extrabold text-slate-900 dark:text-white truncate">{{ o.name }}</div>
                      <p v-if="o.description" class="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{{ o.description }}</p>
                    </div>
                    <span class="text-[10px] px-2 py-0.5 rounded-md font-bold shrink-0" :class="o.role === 'owner' ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300' : o.role === 'admin' ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'">{{ o.role === 'owner' ? '所有者' : o.role === 'admin' ? '管理员' : '成员' }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>
