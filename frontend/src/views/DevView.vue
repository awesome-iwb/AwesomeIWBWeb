<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { MessageSquare, PencilLine, Send, X } from 'lucide-vue-next';
import { useAuth } from '../composables/useAuth';
import { formatApiError, readJsonOrThrow, useApi } from '../composables/useApi';
import { API } from '../api/endpoints';
import CommentPanel from '../components/CommentPanel.vue';


type DevLink = { username: string; stcn_user_id?: string; hzzc_user_id?: string };

type Project = {
  name: string;
  github_url?: string;
  description?: string;
  keywords?: string[] | string;
  icon?: string;
  banner?: string;
  platform_developers?: DevLink[];
};

type Catalog = { categories: Array<{ projects: Project[] }> };

const router = useRouter();
const { user } = useAuth();
const { apiFetch } = useApi();

const activeTab = ref<'projects' | 'feedback'>('projects');
const catalog = ref<Catalog | null>(null);
const isLoading = ref(false);
const loadError = ref('');

const selectedProject = ref<Project | null>(null);
const isEditOpen = ref(false);
const editDraft = ref<{ description: string; keywords: string }>({ description: '', keywords: '' });
const submitError = ref('');
const isSubmitting = ref(false);
const submissionId = ref('');

const myProjects = computed(() => {
  const uname = user.value?.name?.toLowerCase();
  if (!uname) return [];
  const all = (catalog.value?.categories ?? []).flatMap((c) => c.projects ?? []);
  return all.filter((p) => (p.platform_developers ?? []).some((d) => String(d.username ?? '').toLowerCase() === uname));
});

const openEdit = (p: Project) => {
  selectedProject.value = p;
  editDraft.value = {
    description: p.description ?? '',
    keywords: Array.isArray(p.keywords) ? p.keywords.join(', ') : String(p.keywords ?? '')
  };
  submitError.value = '';
  submissionId.value = '';
  isEditOpen.value = true;
};

const closeEdit = () => {
  isEditOpen.value = false;
};

const submitUpdate = async () => {
  if (!selectedProject.value) return;
  isSubmitting.value = true;
  submitError.value = '';
  try {
    const payload = {
      kind: 'project_update',
      project_name: selectedProject.value.name,
      patch: {
        description: editDraft.value.description,
        keywords: editDraft.value.keywords
      },
      actor: {
        username: user.value?.name ?? '',
        stcn_user_id: user.value?.stcn_user_id ?? '',
        hzzc_user_id: user.value?.hzzc_user_id ?? ''
      }
    };
    const res = await apiFetch(API.submissions.dev, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await readJsonOrThrow<any>(res);
    submissionId.value = json?.submissionId ?? '';
  } catch (e: unknown) {
    submitError.value = formatApiError(e, '提交失败');
  } finally {
    isSubmitting.value = false;
  }
};

const fetchCatalog = async () => {
  isLoading.value = true;
  loadError.value = '';
  try {
    const res = await apiFetch(API.catalog.projects);
    catalog.value = await readJsonOrThrow<Catalog>(res);
  } catch (e: unknown) {
    loadError.value = formatApiError(e, '加载失败');
  } finally {
    isLoading.value = false;
  }
};

onMounted(fetchCatalog);
</script>

<template>
  <div class="min-h-screen bg-[#F8FAFC] dark:bg-[#0B1120] text-foreground font-sans pb-24">
    <main class="pt-24 px-6 max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out-expo">
      <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 mb-10">
        <div>
          <h1 class="text-4xl font-extrabold tracking-tight text-foreground mb-2">开发者后台</h1>
          <p class="text-muted-foreground">账号：{{ user?.name || '-' }}</p>
        </div>
        <button @click="router.push('/me')" class="px-4 py-2 rounded-xl bg-secondary text-foreground font-bold hover:bg-accent transition-colors">
          个人中心
        </button>
      </div>

      <div class="flex flex-wrap gap-2 mb-8">
        <button @click="activeTab = 'projects'" class="px-4 py-2 rounded-full font-extrabold transition-colors" :class="activeTab === 'projects' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'bg-white/70 dark:bg-slate-900/30 border border-border text-muted-foreground hover:bg-accent'">
          我的项目
        </button>
        <button @click="activeTab = 'feedback'" class="px-4 py-2 rounded-full font-extrabold transition-colors inline-flex items-center gap-2" :class="activeTab === 'feedback' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'bg-white/70 dark:bg-slate-900/30 border border-border text-muted-foreground hover:bg-accent'">
          <MessageSquare class="w-4 h-4" /> 评论与反馈
        </button>
      </div>

      <div v-if="activeTab === 'projects'" class="space-y-4">
        <div v-if="isLoading" class="text-muted-foreground">加载中…</div>
        <div v-else-if="loadError" class="text-rose-500 font-bold">{{ loadError }}</div>
        <div v-else-if="myProjects.length === 0" class="bg-white/60 dark:bg-slate-900/30 backdrop-blur-md border border-white/70 dark:border-slate-800/70 rounded-3xl p-8">
          <div class="text-lg font-extrabold mb-2">暂无绑定项目</div>
          <div class="text-muted-foreground">需要运维在项目里关联你的账号后，你才能在这里看到并发起变更申请。</div>
        </div>
        <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div v-for="p in myProjects" :key="p.name" class="bg-white/60 dark:bg-slate-900/30 backdrop-blur-md border border-white/70 dark:border-slate-800/70 rounded-3xl p-6 flex gap-4">
            <div class="h-12 w-12 rounded-2xl bg-muted overflow-hidden shrink-0">
              <img v-if="p.icon" :src="p.icon" class="h-full w-full object-contain bg-white" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="text-lg font-extrabold truncate">{{ p.name }}</div>
              <div class="text-xs text-muted-foreground truncate">{{ p.github_url || '' }}</div>
              <div class="mt-4 flex gap-2">
                <button @click="openEdit(p)" class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold transition-colors">
                  <PencilLine class="w-4 h-4" />
                  发起变更
                </button>
                <CommentPanel :project-name="p.name" variant="dev" initial-tab="bug" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-else-if="activeTab === 'feedback'">
        <CommentPanel project-name="__dev__" variant="dev" initial-tab="comment" />
      </div>

      <div v-if="isEditOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div class="w-full max-w-2xl bg-white dark:bg-[#0B1120] rounded-3xl border border-border shadow-2xl overflow-hidden">
          <div class="p-6 border-b border-border flex items-center justify-between">
            <div class="text-xl font-extrabold truncate">发起变更：{{ selectedProject?.name }}</div>
            <button @click="closeEdit" class="p-2 rounded-xl hover:bg-accent transition-colors">
              <X class="w-5 h-5" />
            </button>
          </div>
          <div class="p-6 space-y-5">
            <div class="space-y-2">
              <label class="text-sm font-bold text-muted-foreground">简介</label>
              <textarea v-model="editDraft.description" rows="4" class="w-full px-4 py-3 rounded-2xl border border-border bg-card outline-none focus:border-emerald-500 resize-none"></textarea>
            </div>
            <div class="space-y-2">
              <label class="text-sm font-bold text-muted-foreground">关键词（逗号分隔）</label>
              <input v-model="editDraft.keywords" type="text" class="w-full px-4 py-3 rounded-2xl border border-border bg-card outline-none focus:border-emerald-500" />
            </div>

            <div v-if="submitError" class="p-4 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 font-bold">
              {{ submitError }}
            </div>
            <div v-if="submissionId" class="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold">
              已提交变更申请：{{ submissionId }}
            </div>

            <div class="flex flex-col sm:flex-row gap-3">
              <button
                @click="submitUpdate"
                :disabled="isSubmitting"
                class="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Send class="w-4 h-4" />
                {{ isSubmitting ? '提交中…' : '提交审核' }}
              </button>
              <button @click="closeEdit" class="flex-1 px-4 py-3 rounded-2xl bg-secondary text-foreground font-extrabold hover:bg-accent transition-colors">
                取消
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>
